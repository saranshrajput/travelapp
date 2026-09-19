import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import {
  db,
  tripsTable,
  tripMembersTable,
  pitstopsTable,
  pitstopResponsesTable,
  messagesTable,
  type TripMemberRow,
} from "@workspace/db";
import {
  DropPitstopParams,
  DropPitstopBody,
  DropPitstopResponse,
  CancelPitstopParams,
  CancelPitstopResponse,
  GetActivePitstopParams,
  GetActivePitstopResponse,
  ListPitstopsParams,
  ListPitstopsResponse,
  RespondToPitstopParams,
  RespondToPitstopBody,
  RespondToPitstopResponse,
} from "@workspace/api-zod";
import { authRequired, currentUser } from "../lib/auth";
import { findSelf, getRoster } from "../lib/convoy";

const router: IRouter = Router();

router.use(
  [
    "/trips/:tripId/pitstop",
    "/trips/:tripId/pitstops",
    "/trips/:tripId/pitstop/respond",
  ],
  authRequired,
);

async function getActivePitstopRow(tripId: number) {
  const [pitstop] = await db
    .select()
    .from(pitstopsTable)
    .where(
      and(eq(pitstopsTable.tripId, tripId), eq(pitstopsTable.status, "active")),
    )
    .limit(1);
  return pitstop ?? null;
}

async function pitstopToApi(
  pitstop: typeof pitstopsTable.$inferSelect,
  byId: Map<number, TripMemberRow>,
) {
  const dropper = byId.get(pitstop.droppedByMemberId);
  const responses = await db
    .select()
    .from(pitstopResponsesTable)
    .where(eq(pitstopResponsesTable.pitstopId, pitstop.id));

  return {
    id: pitstop.id,
    tripId: pitstop.tripId,
    droppedByMemberId: pitstop.droppedByMemberId,
    droppedByName: dropper?.name ?? "Leader",
    lat: pitstop.lat,
    lng: pitstop.lng,
    label: pitstop.label ?? null,
    status: pitstop.status as "active" | "cancelled",
    responses: responses.map((r) => {
      const member = byId.get(r.memberId);
      return {
        memberId: r.memberId,
        name: member?.name ?? "Member",
        color: member?.color ?? "#9AA0A6",
        initial: member?.initial ?? "?",
        response: r.response as "on_my_way" | "already_there",
      };
    }),
    createdAt: pitstop.createdAt.toISOString(),
  };
}

router.get("/trips/:tripId/pitstop", async (req, res): Promise<void> => {
  const user = currentUser(res);
  const params = GetActivePitstopParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const roster = await getRoster(params.data.tripId);
  const self = findSelf(roster, user.id);
  if (!self || self.joinStatus !== "joined") {
    res.status(403).json({ error: "You are not a member of this trip" });
    return;
  }
  const pitstop = await getActivePitstopRow(params.data.tripId);
  if (!pitstop) {
    res.status(404).json({ error: "No active pitstop" });
    return;
  }
  const byId = new Map(roster.map((m) => [m.id, m]));
  res
    .status(200)
    .json(GetActivePitstopResponse.parse(await pitstopToApi(pitstop, byId)));
});

router.post("/trips/:tripId/pitstop", async (req, res): Promise<void> => {
  const user = currentUser(res);
  const params = DropPitstopParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = DropPitstopBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [trip] = await db
    .select()
    .from(tripsTable)
    .where(eq(tripsTable.id, params.data.tripId));
  if (!trip) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }
  if (trip.status !== "active") {
    res.status(409).json({ error: "Trip is not active" });
    return;
  }

  const roster = await getRoster(params.data.tripId);
  const self = findSelf(roster, user.id);
  if (!self || self.joinStatus !== "joined") {
    res.status(403).json({ error: "You are not a member of this trip" });
    return;
  }
  if (self.role !== "leader") {
    res.status(403).json({ error: "Only leaders can drop a pitstop" });
    return;
  }

  // Cancel any existing active pitstop for this trip
  await db
    .update(pitstopsTable)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(pitstopsTable.tripId, params.data.tripId),
        eq(pitstopsTable.status, "active"),
      ),
    );

  // Create new pitstop
  const [pitstop] = await db
    .insert(pitstopsTable)
    .values({
      tripId: params.data.tripId,
      droppedByMemberId: self.id,
      lat: body.data.lat,
      lng: body.data.lng,
      label: body.data.label ?? null,
      status: "active",
    })
    .returning();

  await db.insert(messagesTable).values({
    tripId: params.data.tripId,
    senderMemberId: self.id,
    recipientMemberId: null,
    body: `📍 ${self.name} dropped a pitstop${body.data.label ? `: ${body.data.label}` : ""}`,
  });

  const byId = new Map(roster.map((m) => [m.id, m]));
  res
    .status(201)
    .json(DropPitstopResponse.parse(await pitstopToApi(pitstop!, byId)));
});

router.delete("/trips/:tripId/pitstop", async (req, res): Promise<void> => {
  const user = currentUser(res);
  const params = CancelPitstopParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const roster = await getRoster(params.data.tripId);
  const self = findSelf(roster, user.id);
  if (!self || self.joinStatus !== "joined") {
    res.status(403).json({ error: "You are not a member of this trip" });
    return;
  }
  if (self.role !== "leader") {
    res.status(403).json({ error: "Only leaders can cancel a pitstop" });
    return;
  }

  const pitstop = await getActivePitstopRow(params.data.tripId);
  if (!pitstop) {
    res.status(404).json({ error: "No active pitstop" });
    return;
  }

  await db
    .update(pitstopsTable)
    .set({ status: "cancelled" })
    .where(eq(pitstopsTable.id, pitstop.id));

  await db.insert(messagesTable).values({
    tripId: params.data.tripId,
    senderMemberId: self.id,
    recipientMemberId: null,
    body: `${self.name} cancelled the pitstop${pitstop.label ? `: ${pitstop.label}` : ""}`,
  });

  res.json(CancelPitstopResponse.parse({ ok: true }));
});

router.get("/trips/:tripId/pitstops", async (req, res): Promise<void> => {
  const user = currentUser(res);
  const params = ListPitstopsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const roster = await getRoster(params.data.tripId);
  const self = findSelf(roster, user.id);
  if (!self || self.joinStatus !== "joined") {
    res.status(403).json({ error: "You are not a member of this trip" });
    return;
  }

  const rows = await db
    .select()
    .from(pitstopsTable)
    .where(eq(pitstopsTable.tripId, params.data.tripId))
    .orderBy(desc(pitstopsTable.createdAt));

  const byId = new Map(roster.map((m) => [m.id, m]));
  const pitstops = await Promise.all(rows.map((row) => pitstopToApi(row, byId)));
  res.json(ListPitstopsResponse.parse(pitstops));
});

router.post(
  "/trips/:tripId/pitstop/respond",
  async (req, res): Promise<void> => {
    const user = currentUser(res);
    const params = RespondToPitstopParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const body = RespondToPitstopBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const roster = await getRoster(params.data.tripId);
    const self = findSelf(roster, user.id);
    if (!self || self.joinStatus !== "joined") {
      res.status(403).json({ error: "You are not a member of this trip" });
      return;
    }

    const pitstop = await getActivePitstopRow(params.data.tripId);
    if (!pitstop) {
      res.status(404).json({ error: "No active pitstop" });
      return;
    }

    // Atomic upsert — unique constraint on (pitstop_id, member_id) prevents duplicate rows
    await db
      .insert(pitstopResponsesTable)
      .values({
        pitstopId: pitstop.id,
        memberId: self.id,
        response: body.data.response,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [pitstopResponsesTable.pitstopId, pitstopResponsesTable.memberId],
        set: { response: body.data.response, updatedAt: new Date() },
      });

    res.json(RespondToPitstopResponse.parse({ ok: true }));
  },
);

export default router;
