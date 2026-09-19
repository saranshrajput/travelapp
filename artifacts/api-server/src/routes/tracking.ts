import { Router, type IRouter } from "express";
import { eq, and, lt, inArray, desc } from "drizzle-orm";
import {
  db,
  tripsTable,
  tripMembersTable,
  pitstopsTable,
  pitstopResponsesTable,
  messagesTable,
  locationHistoryTable,
} from "@workspace/db";
import {
  PostLocationParams,
  PostLocationBody,
  SetSharingParams,
  SetSharingBody,
  GetTripStateParams,
  GetTripStateResponse,
  SetHistoryOptInParams,
  SetHistoryOptInBody,
  GetTripHistoryParams,
} from "@workspace/api-zod";
import { authRequired, currentUser } from "../lib/auth";
import {
  computeMemberStates,
  findSelf,
  getRoster,
  maybeAutoEnd,
  refreshOneLastSeenLabel,
  tripToApi,
} from "../lib/convoy";
import { haversineM } from "../lib/geo";

const router: IRouter = Router();

router.use(
  [
    "/trips/:tripId/location",
    "/trips/:tripId/sharing",
    "/trips/:tripId/state",
    "/trips/:tripId/history-opt-in",
    "/trips/:tripId/history",
  ],
  authRequired,
);

const HISTORY_RETENTION_DAYS = 7;

const MOVE_THRESHOLD_M = 25;

router.post("/trips/:tripId/location", async (req, res): Promise<void> => {
  const user = currentUser(res);
  const params = PostLocationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = PostLocationBody.safeParse(req.body);
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
    res.status(409).json({ error: "Trip is not active; location is not being collected" });
    return;
  }
  const roster = await getRoster(trip.id);
  const self = findSelf(roster, user.id);
  if (!self || self.joinStatus !== "joined") {
    res.status(403).json({ error: "You are not a member of this trip" });
    return;
  }

  const now = new Date();
  const d = body.data;
  const fix = { lat: d.lat, lng: d.lng };

  let avgSpeed = self.avgSpeedMps;
  let lastMovedAt = self.lastMovedAt;
  if (self.lastLat != null && self.lastLng != null && self.lastFixAt) {
    const dist = haversineM({ lat: self.lastLat, lng: self.lastLng }, fix);
    const dtS = (now.getTime() - self.lastFixAt.getTime()) / 1000;
    if (dtS > 0.5) {
      const inst = Math.min(60, dist / dtS);
      avgSpeed = avgSpeed == null ? inst : 0.7 * avgSpeed + 0.3 * inst;
    }
    if (dist > MOVE_THRESHOLD_M || (d.speedMps != null && d.speedMps > 1.5)) {
      lastMovedAt = now;
    }
  } else {
    lastMovedAt = now;
    if (d.speedMps != null) avgSpeed = Math.max(0, d.speedMps);
  }

  // Invalidate the cached "last seen" label if the member moved far from it
  let labelUpdates: { lastSeenLabel: string | null; lastSeenLabelAt: Date | null } | Record<string, never> = {};
  if (
    self.lastLat != null &&
    self.lastLng != null &&
    haversineM({ lat: self.lastLat, lng: self.lastLng }, fix) > 1500
  ) {
    labelUpdates = { lastSeenLabel: null, lastSeenLabelAt: null };
  }

  await db
    .update(tripMembersTable)
    .set({
      sharing: true,
      prevLat: self.lastLat,
      prevLng: self.lastLng,
      prevFixAt: self.lastFixAt,
      lastLat: d.lat,
      lastLng: d.lng,
      lastFixAt: now,
      avgSpeedMps: avgSpeed,
      lastMovedAt,
      ...labelUpdates,
    })
    .where(eq(tripMembersTable.id, self.id));

  if (self.recordHistory) {
    await db.insert(locationHistoryTable).values({
      tripId: trip.id,
      tripMemberId: self.id,
      lat: d.lat,
      lng: d.lng,
      recordedAt: now,
    });
  }

  res.json({ ok: true });
});

router.post("/trips/:tripId/history-opt-in", async (req, res): Promise<void> => {
  const user = currentUser(res);
  const params = SetHistoryOptInParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = SetHistoryOptInBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const roster = await getRoster(params.data.tripId);
  const self = findSelf(roster, user.id);
  if (!self) {
    res.status(403).json({ error: "You are not a member of this trip" });
    return;
  }
  await db
    .update(tripMembersTable)
    .set({ recordHistory: body.data.enabled })
    .where(eq(tripMembersTable.id, self.id));
  res.json({ ok: true });
});

router.get("/trips/:tripId/history", async (req, res): Promise<void> => {
  const user = currentUser(res);
  const params = GetTripHistoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
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
  const roster = await getRoster(trip.id);
  const self = findSelf(roster, user.id);
  if (!self) {
    res.status(403).json({ error: "You are not a member of this trip" });
    return;
  }

  // Lazy purge: drop breadcrumb rows more than HISTORY_RETENTION_DAYS past trip end.
  if (trip.endedAt) {
    const cutoff = new Date(
      trip.endedAt.getTime() + HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );
    if (Date.now() >= cutoff.getTime()) {
      await db
        .delete(locationHistoryTable)
        .where(
          and(
            eq(locationHistoryTable.tripId, trip.id),
            lt(locationHistoryTable.recordedAt, cutoff),
          ),
        );
      res.json([]);
      return;
    }
  }

  const optedInIds = roster.filter((m) => m.recordHistory).map((m) => m.id);
  if (optedInIds.length === 0) {
    res.json([]);
    return;
  }
  const rows = await db
    .select()
    .from(locationHistoryTable)
    .where(
      and(
        eq(locationHistoryTable.tripId, trip.id),
        inArray(locationHistoryTable.tripMemberId, optedInIds),
      ),
    )
    .orderBy(locationHistoryTable.recordedAt);

  const byMember = new Map<number, { lat: number; lng: number; recordedAt: string }[]>();
  for (const r of rows) {
    const arr = byMember.get(r.tripMemberId) ?? [];
    arr.push({ lat: r.lat, lng: r.lng, recordedAt: r.recordedAt.toISOString() });
    byMember.set(r.tripMemberId, arr);
  }
  const byId = new Map(roster.map((m) => [m.id, m]));
  res.json(
    optedInIds
      .filter((id) => (byMember.get(id)?.length ?? 0) > 0)
      .map((id) => ({
        memberId: id,
        name: byId.get(id)?.name ?? "Member",
        color: byId.get(id)?.color ?? "#9AA0A6",
        points: byMember.get(id) ?? [],
      })),
  );
});

router.post("/trips/:tripId/sharing", async (req, res): Promise<void> => {
  const user = currentUser(res);
  const params = SetSharingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = SetSharingBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const roster = await getRoster(params.data.tripId);
  const self = findSelf(roster, user.id);
  if (!self) {
    res.status(403).json({ error: "You are not a member of this trip" });
    return;
  }
  await db
    .update(tripMembersTable)
    .set({ sharing: body.data.sharing })
    .where(eq(tripMembersTable.id, self.id));
  res.json({ ok: true });
});

router.get("/trips/:tripId/state", async (req, res): Promise<void> => {
  const user = currentUser(res);
  const params = GetTripStateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [tripRow] = await db
    .select()
    .from(tripsTable)
    .where(eq(tripsTable.id, params.data.tripId));
  if (!tripRow) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }
  let roster = await getRoster(tripRow.id);
  const self = findSelf(roster, user.id);
  if (!self) {
    res.status(403).json({ error: "You are not a member of this trip" });
    return;
  }
  const trip = await maybeAutoEnd(tripRow, roster);
  if (trip.status !== tripRow.status) {
    roster = await getRoster(trip.id);
  }

  // Opportunistically refresh one member's "last seen near" label
  try {
    await refreshOneLastSeenLabel(roster);
  } catch (err) {
    req.log.warn({ err }, "label refresh failed");
  }

  const now = new Date();
  const members = computeMemberStates(trip, roster, user.id, now);
  const sharingCount = members.filter(
    (m) => m.status === "moving" || m.status === "stopped",
  ).length;
  const joinedCount = roster.filter((m) => m.joinStatus === "joined").length;

  // Load active pitstop (if any)
  const [activePitstop] = await db
    .select()
    .from(pitstopsTable)
    .where(
      and(eq(pitstopsTable.tripId, trip.id), eq(pitstopsTable.status, "active")),
    )
    .limit(1);

  let pitstopPayload: Record<string, unknown> | undefined;
  if (activePitstop) {
    const byId = new Map(roster.map((m) => [m.id, m]));
    const dropper = byId.get(activePitstop.droppedByMemberId);
    const responses = await db
      .select()
      .from(pitstopResponsesTable)
      .where(eq(pitstopResponsesTable.pitstopId, activePitstop.id));

    pitstopPayload = {
      id: activePitstop.id,
      tripId: activePitstop.tripId,
      droppedByMemberId: activePitstop.droppedByMemberId,
      droppedByName: dropper?.name ?? "Leader",
      lat: activePitstop.lat,
      lng: activePitstop.lng,
      label: activePitstop.label ?? null,
      status: activePitstop.status,
      responses: responses.map((r) => {
        const member = byId.get(r.memberId);
        return {
          memberId: r.memberId,
          name: member?.name ?? "Member",
          color: member?.color ?? "#9AA0A6",
          initial: member?.initial ?? "?",
          response: r.response,
        };
      }),
      createdAt: activePitstop.createdAt.toISOString(),
    };
  }

  // Most recent SOS broadcast in the last 15 minutes, if any.
  const SOS_WINDOW_MS = 15 * 60 * 1000;
  const [recentSos] = await db
    .select()
    .from(messagesTable)
    .where(and(eq(messagesTable.tripId, trip.id), eq(messagesTable.kind, "sos")))
    .orderBy(desc(messagesTable.id))
    .limit(1);

  let sosPayload: Record<string, unknown> | undefined;
  if (recentSos && now.getTime() - recentSos.createdAt.getTime() <= SOS_WINDOW_MS) {
    const byId = new Map(roster.map((m) => [m.id, m]));
    const sender = byId.get(recentSos.senderMemberId);
    sosPayload = {
      id: recentSos.id,
      memberId: recentSos.senderMemberId,
      name: sender?.name ?? "A member",
      color: sender?.color ?? "#EA4335",
      initial: sender?.initial ?? "?",
      note: null,
      createdAt: recentSos.createdAt.toISOString(),
    };
  }

  res.json(
    GetTripStateResponse.parse({
      trip: tripToApi(trip),
      members,
      sharingCount,
      joinedCount,
      serverTime: now.toISOString(),
      ...(trip.endSummary ? { summary: trip.endSummary } : {}),
      ...(pitstopPayload ? { pitstop: pitstopPayload } : {}),
      ...(sosPayload ? { activeSos: sosPayload } : {}),
    }),
  );
});

export default router;
