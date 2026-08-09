/**
 * Demo simulation: creates a Bangalore→Mysore trip with 4 bot riders
 * that move in real-time so the user can see the tracking screen in action.
 */
import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, tripsTable, tripMembersTable } from "@workspace/db";
import { authRequired, currentUser } from "../lib/auth";
import { haversineM } from "../lib/geo";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ──────────────────────────────────────────
// Pre-baked Bangalore → Mysore route (NH275)
// ──────────────────────────────────────────
const DEMO_ROUTE: { lat: number; lng: number }[] = [
  { lat: 12.9716, lng: 77.5946 }, // Bangalore city centre
  { lat: 12.9450, lng: 77.5550 },
  { lat: 12.9100, lng: 77.5050 },
  { lat: 12.8700, lng: 77.4500 },
  { lat: 12.8300, lng: 77.4100 },
  { lat: 12.7990, lng: 77.3924 }, // Bidadi
  { lat: 12.7600, lng: 77.3400 },
  { lat: 12.7300, lng: 77.3100 },
  { lat: 12.7158, lng: 77.2849 }, // Ramnagar
  { lat: 12.6900, lng: 77.2500 },
  { lat: 12.6700, lng: 77.2200 },
  { lat: 12.6508, lng: 77.2055 }, // Channapatna
  { lat: 12.6300, lng: 77.1600 },
  { lat: 12.6100, lng: 77.1100 },
  { lat: 12.5877, lng: 77.0474 }, // Maddur
  { lat: 12.5700, lng: 76.9900 },
  { lat: 12.5500, lng: 76.9300 },
  { lat: 12.5300, lng: 76.9000 },
  { lat: 12.5217, lng: 76.8952 }, // Mandya
  { lat: 12.5000, lng: 76.8400 },
  { lat: 12.4700, lng: 76.7900 },
  { lat: 12.4400, lng: 76.7400 },
  { lat: 12.4185, lng: 76.6988 }, // Srirangapatna
  { lat: 12.3900, lng: 76.6750 },
  { lat: 12.3600, lng: 76.6600 },
  { lat: 12.3300, lng: 76.6500 },
  { lat: 12.2958, lng: 76.6394 }, // Mysore
];

// Cumulative distances along DEMO_ROUTE
const ROUTE_DISTANCES: number[] = (() => {
  const d = [0];
  for (let i = 1; i < DEMO_ROUTE.length; i++) {
    d.push(d[i - 1]! + haversineM(DEMO_ROUTE[i - 1]!, DEMO_ROUTE[i]!));
  }
  return d;
})();
const TOTAL_ROUTE_M = ROUTE_DISTANCES[ROUTE_DISTANCES.length - 1]!;

/** Interpolate a lat/lng at a given metre offset along DEMO_ROUTE */
function posAtM(m: number): { lat: number; lng: number } {
  const capped = Math.min(Math.max(m, 0), TOTAL_ROUTE_M);
  for (let i = 1; i < ROUTE_DISTANCES.length; i++) {
    if (ROUTE_DISTANCES[i]! >= capped) {
      const seg = ROUTE_DISTANCES[i]! - ROUTE_DISTANCES[i - 1]!;
      const t = seg === 0 ? 0 : (capped - ROUTE_DISTANCES[i - 1]!) / seg;
      const a = DEMO_ROUTE[i - 1]!;
      const b = DEMO_ROUTE[i]!;
      return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
    }
  }
  return DEMO_ROUTE[DEMO_ROUTE.length - 1]!;
}

// ──────────────────────────────────────────
// Bot definitions
// ──────────────────────────────────────────
type BotDef = {
  name: string;
  phone: string;
  color: string;
  initial: string;
  vehicleType: "bike" | "car";
  /** starting progress 0..1 */
  startFraction: number;
  /** m/s — 0 = stopped */
  speedMps: number;
  role: "leader" | "member";
};

const BOT_DEFS: BotDef[] = [
  {
    name: "Rahul K",
    phone: "+91-9000000001",
    color: "#EA4335",
    initial: "R",
    vehicleType: "bike",
    startFraction: 0.72,
    speedMps: 16.7, // ~60 km/h
    role: "member",
  },
  {
    name: "Priya M",
    phone: "+91-9000000002",
    color: "#34A853",
    initial: "P",
    vehicleType: "car",
    startFraction: 0.50,
    speedMps: 13.9, // ~50 km/h
    role: "member",
  },
  {
    name: "Karan S",
    phone: "+91-9000000003",
    color: "#F9AB00",
    initial: "K",
    vehicleType: "bike",
    startFraction: 0.30,
    speedMps: 0, // stopped
    role: "member",
  },
  {
    name: "Amit D",
    phone: "+91-9000000004",
    color: "#A142F4",
    initial: "A",
    vehicleType: "car",
    startFraction: 0.12,
    speedMps: 12.5, // ~45 km/h
    role: "member",
  },
];

// ──────────────────────────────────────────
// Active simulation registry
// ──────────────────────────────────────────
/** tripId → { botMemberIds, progressM[], timer } */
const activeSims = new Map<
  number,
  { botMemberIds: number[]; progressM: number[]; timer: ReturnType<typeof setInterval> }
>();

const SIM_TICK_MS = 5000; // advance bots every 5 s
// Add tiny jitter so bots don't all update at the exact same millisecond
function jitter(base: number, fraction = 0.1) {
  return base + (Math.random() * 2 - 1) * base * fraction;
}

function stopSim(tripId: number) {
  const sim = activeSims.get(tripId);
  if (sim) {
    clearInterval(sim.timer);
    activeSims.delete(tripId);
  }
}

async function tickSim(tripId: number) {
  const sim = activeSims.get(tripId);
  if (!sim) return;

  // Stop sim if trip is no longer active
  const [trip] = await db
    .select({ status: tripsTable.status })
    .from(tripsTable)
    .where(eq(tripsTable.id, tripId))
    .limit(1);
  if (!trip || trip.status !== "active") {
    stopSim(tripId);
    return;
  }

  const now = new Date();
  const updates: Promise<unknown>[] = [];

  for (let i = 0; i < sim.botMemberIds.length; i++) {
    const memberId = sim.botMemberIds[i]!;
    const def = BOT_DEFS[i]!;
    const prevM = sim.progressM[i]!;
    const advanceM = def.speedMps * (jitter(SIM_TICK_MS) / 1000);
    const newM = Math.min(prevM + advanceM, TOTAL_ROUTE_M);
    sim.progressM[i] = newM;

    const pos = posAtM(newM);
    const prevPos = posAtM(prevM);

    updates.push(
      db
        .update(tripMembersTable)
        .set({
          prevLat: prevPos.lat,
          prevLng: prevPos.lng,
          prevFixAt: new Date(now.getTime() - jitter(SIM_TICK_MS)),
          lastLat: pos.lat,
          lastLng: pos.lng,
          lastFixAt: now,
          sharing: true,
          avgSpeedMps: def.speedMps > 0 ? def.speedMps + (Math.random() - 0.5) * 2 : 0,
          lastMovedAt: def.speedMps > 0 ? now : new Date(now.getTime() - 4 * 60 * 1000), // Karan stopped 4 min ago
        })
        .where(eq(tripMembersTable.id, memberId)),
    );
  }

  await Promise.all(updates).catch((err) =>
    logger.warn({ err, tripId }, "demo tick failed"),
  );
}

// ──────────────────────────────────────────
// Endpoint: POST /api/demo/create
// ──────────────────────────────────────────
router.post("/demo/create", authRequired, async (req, res): Promise<void> => {
  const user = currentUser(res);
  const userId = user.id;

  // Stop any existing demo sim for this user (best-effort: find most recent demo trip)
  const existingDemoTrips = await db
    .select({ id: tripsTable.id, status: tripsTable.status })
    .from(tripsTable)
    .where(eq(tripsTable.createdByUserId, userId));
  for (const t of existingDemoTrips) {
    if (activeSims.has(t.id)) stopSim(t.id);
  }

  const joinCode = `DEMO${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  const now = new Date();

  // Create the demo trip
  const [trip] = await db
    .insert(tripsTable)
    .values({
      name: "Bangalore → Mysore Demo",
      status: "active",
      startLat: DEMO_ROUTE[0]!.lat,
      startLng: DEMO_ROUTE[0]!.lng,
      startLabel: "Bangalore",
      destLat: DEMO_ROUTE[DEMO_ROUTE.length - 1]!.lat,
      destLng: DEMO_ROUTE[DEMO_ROUTE.length - 1]!.lng,
      destLabel: "Mysore",
      scheduledAt: now,
      routeGeometry: DEMO_ROUTE,
      routeDistanceM: TOTAL_ROUTE_M,
      routeDurationS: TOTAL_ROUTE_M / 13.9, // ~50 km/h average
      joinCode,
      createdByUserId: userId,
      startedAt: now,
    })
    .returning();

  if (!trip) {
    res.status(500).json({ error: "Failed to create demo trip" });
    return;
  }

  // Add the real user as leader (at start point, not sharing yet — they'll share via normal flow)
  const [me] = await db
    .select()
    .from(tripMembersTable)
    .where(eq(tripMembersTable.userId, userId))
    .limit(1);

  const leaderName = me?.name ?? "You";
  await db.insert(tripMembersTable).values({
    tripId: trip.id,
    userId,
    name: leaderName,
    phone: me?.phone ?? "+91-0000000000",
    role: "leader",
    color: "#4285F4",
    initial: leaderName[0]?.toUpperCase() ?? "Y",
    vehicleType: "bike",
    joinStatus: "joined",
    sharing: false,
  });

  // Insert bot members with their starting positions
  const botIds: number[] = [];
  for (const def of BOT_DEFS) {
    const startM = def.startFraction * TOTAL_ROUTE_M;
    const pos = posAtM(startM);
    const prevPos = posAtM(Math.max(0, startM - def.speedMps * SIM_TICK_MS / 1000));

    const [bot] = await db
      .insert(tripMembersTable)
      .values({
        tripId: trip.id,
        userId: null,
        name: def.name,
        phone: def.phone,
        role: def.role,
        color: def.color,
        initial: def.initial,
        vehicleType: def.vehicleType,
        joinStatus: "joined",
        sharing: true,
        lastLat: pos.lat,
        lastLng: pos.lng,
        lastFixAt: new Date(now.getTime() - 2000),
        prevLat: prevPos.lat,
        prevLng: prevPos.lng,
        prevFixAt: new Date(now.getTime() - SIM_TICK_MS - 2000),
        avgSpeedMps: def.speedMps,
        lastMovedAt:
          def.speedMps > 0
            ? new Date(now.getTime() - 3000)
            : new Date(now.getTime() - 4 * 60 * 1000), // Karan: stopped 4 min ago
        lastSeenLabel: null,
      })
      .returning({ id: tripMembersTable.id });

    if (bot) botIds.push(bot.id);
  }

  // Start simulation loop
  const progressM = BOT_DEFS.map((d) => d.startFraction * TOTAL_ROUTE_M);
  const timer = setInterval(() => void tickSim(trip.id), SIM_TICK_MS);
  activeSims.set(trip.id, { botMemberIds: botIds, progressM, timer });

  // Auto-stop after 2 hours to avoid orphaned intervals
  setTimeout(() => stopSim(trip.id), 2 * 60 * 60 * 1000);

  res.json({ tripId: trip.id });
});

// Endpoint to stop a demo (called when user leaves the demo trip)
router.delete("/demo/:tripId", authRequired, async (req, res): Promise<void> => {
  const tripId = Number(req.params["tripId"]);
  stopSim(tripId);
  res.json({ ok: true });
});

export default router;
export { stopSim };
