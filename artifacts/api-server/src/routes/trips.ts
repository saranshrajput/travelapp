import { Router, type IRouter } from "express";
import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  tripsTable,
  tripMembersTable,
  usersTable,
} from "@workspace/db";
import {
  CreateTripBody,
  CreateTripResponse,
  ListTripsResponse,
  GetTripParams,
  GetTripResponse,
  UpdateTripParams,
  UpdateTripBody,
  UpdateTripResponse,
  StartTripParams,
  StartTripResponse,
  EndTripParams,
  EndTripResponse,
  LeaveTripParams,
  GetJoinPreviewParams,
  GetJoinPreviewResponse,
  JoinTripBody,
  JoinTripResponse,
  InviteMemberParams,
  InviteMemberBody,
  InviteMemberResponse,
  RemoveMemberParams,
  PromoteMemberParams,
  PromoteMemberResponse,
} from "@workspace/api-zod";
import { authRequired, currentUser, generateJoinCode } from "../lib/auth";
import {
  ACTIVE_STATUSES,
  buildTripDetail,
  endTripNow,
  findSelf,
  getRoster,
  initialOf,
  maybeAutoEnd,
  memberToApi,
  pickColor,
  tripToApi,
} from "../lib/convoy";

const router: IRouter = Router();

router.use(["/trips", "/trips/{*splat}", "/join", "/join/{*splat}"], authRequired);

async function loadTripForUser(tripId: number, userId: number) {
  const [trip] = await db
    .select()
    .from(tripsTable)
    .where(eq(tripsTable.id, tripId));
  if (!trip) return null;
  const roster = await getRoster(tripId);
  const self = findSelf(roster, userId);
  if (!self) return null;
  return { trip, roster, self };
}

router.get("/trips", async (_req, res): Promise<void> => {
  const user = currentUser(res);
  const memberships = await db
    .select()
    .from(tripMembersTable)
    .where(
      and(
        eq(tripMembersTable.userId, user.id),
        inArray(tripMembersTable.joinStatus, [...ACTIVE_STATUSES]),
      ),
    );
  const tripIds = memberships.map((m) => m.tripId);
  if (tripIds.length === 0) {
    res.json(ListTripsResponse.parse([]));
    return;
  }
  const trips = await db
    .select()
    .from(tripsTable)
    .where(inArray(tripsTable.id, tripIds));
  const allMembers = await db
    .select()
    .from(tripMembersTable)
    .where(
      and(
        inArray(tripMembersTable.tripId, tripIds),
        inArray(tripMembersTable.joinStatus, [...ACTIVE_STATUSES]),
      ),
    );
  const now = Date.now();
  const summaries = [];
  for (let trip of trips) {
    const roster = allMembers.filter((m) => m.tripId === trip.id);
    trip = await maybeAutoEnd(trip, roster);
    const mine = roster.find((m) => m.userId === user.id);
    const sharingCount =
      trip.status === "active"
        ? roster.filter(
            (m) =>
              m.sharing &&
              m.lastFixAt &&
              (now - m.lastFixAt.getTime()) / 1000 < 5 * 60,
          ).length
        : 0;
    summaries.push({
      trip: tripToApi(trip),
      memberCount: roster.filter((m) => m.joinStatus === "joined").length,
      sharingCount,
      myRole: (mine?.role ?? "member") as "leader" | "member",
    });
  }
  // Active first, then upcoming (draft) by date, then ended (newest first)
  const rank = (s: string) => (s === "active" ? 0 : s === "draft" ? 1 : 2);
  summaries.sort((a, b) => {
    const r = rank(a.trip.status) - rank(b.trip.status);
    if (r !== 0) return r;
    if (a.trip.status === "ended") {
      return (b.trip.endedAt ?? "").localeCompare(a.trip.endedAt ?? "");
    }
    return a.trip.scheduledAt.localeCompare(b.trip.scheduledAt);
  });
  res.json(ListTripsResponse.parse(summaries));
});

router.post("/trips", async (req, res): Promise<void> => {
  const user = currentUser(res);
  const parsed = CreateTripBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const d = parsed.data;
  const scheduledAt = new Date(d.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime())) {
    res.status(400).json({ error: "Invalid date/time" });
    return;
  }
  if (d.routeGeometry.length < 2) {
    res.status(400).json({ error: "Route geometry is required" });
    return;
  }
  const [trip] = await db
    .insert(tripsTable)
    .values({
      name: d.name.trim(),
      status: "draft",
      startLat: d.startLat,
      startLng: d.startLng,
      startLabel: d.startLabel,
      destLat: d.destLat,
      destLng: d.destLng,
      destLabel: d.destLabel,
      scheduledAt,
      routeGeometry: d.routeGeometry,
      routeDistanceM: d.routeDistanceM,
      routeDurationS: d.routeDurationS,
      joinCode: generateJoinCode(),
      createdByUserId: user.id,
    })
    .returning();
  await db.insert(tripMembersTable).values({
    tripId: trip!.id,
    userId: user.id,
    name: user.name,
    phone: user.phone,
    role: "leader",
    color: pickColor([]),
    initial: initialOf(user.name),
    joinStatus: "joined",
  });
  const roster = await getRoster(trip!.id);
  res.status(201).json(
    CreateTripResponse.parse(buildTripDetail(trip!, roster, user.id)),
  );
});

router.get("/trips/:tripId", async (req, res): Promise<void> => {
  const user = currentUser(res);
  const params = GetTripParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const loaded = await loadTripForUser(params.data.tripId, user.id);
  if (!loaded) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }
  let { trip, roster } = loaded;
  const self = loaded.self;
  // Opening the trip converts an invite into a join
  if (self.joinStatus === "invited") {
    await db
      .update(tripMembersTable)
      .set({ joinStatus: "joined", name: user.name, initial: initialOf(user.name) })
      .where(eq(tripMembersTable.id, self.id));
    roster = await getRoster(trip.id);
  }
  trip = await maybeAutoEnd(trip, roster);
  res.json(GetTripResponse.parse(buildTripDetail(trip, roster, user.id)));
});

router.patch("/trips/:tripId", async (req, res): Promise<void> => {
  const user = currentUser(res);
  const params = UpdateTripParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = UpdateTripBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const loaded = await loadTripForUser(params.data.tripId, user.id);
  if (!loaded) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }
  const { trip, self } = loaded;
  if (self.role !== "leader") {
    res.status(403).json({ error: "Only leaders can edit the trip" });
    return;
  }
  const d = body.data;
  const touchesRoute =
    d.destLat != null ||
    d.destLng != null ||
    d.destLabel != null ||
    d.routeGeometry != null ||
    d.routeDistanceM != null ||
    d.routeDurationS != null;
  if (touchesRoute && trip.status !== "draft") {
    res.status(409).json({ error: "Destination and route can only be changed while the trip is a draft" });
    return;
  }
  if (trip.status === "ended") {
    res.status(409).json({ error: "This trip has ended" });
    return;
  }
  const updates: Record<string, unknown> = {};
  if (d.name != null) updates["name"] = d.name.trim();
  if (d.scheduledAt != null) {
    const dt = new Date(d.scheduledAt);
    if (Number.isNaN(dt.getTime())) {
      res.status(400).json({ error: "Invalid date/time" });
      return;
    }
    updates["scheduledAt"] = dt;
  }
  if (d.destLat != null) updates["destLat"] = d.destLat;
  if (d.destLng != null) updates["destLng"] = d.destLng;
  if (d.destLabel != null) updates["destLabel"] = d.destLabel;
  if (d.routeGeometry != null) updates["routeGeometry"] = d.routeGeometry;
  if (d.routeDistanceM != null) updates["routeDistanceM"] = d.routeDistanceM;
  if (d.routeDurationS != null) updates["routeDurationS"] = d.routeDurationS;
  const [updated] = await db
    .update(tripsTable)
    .set(updates)
    .where(eq(tripsTable.id, trip.id))
    .returning();
  const roster = await getRoster(trip.id);
  res.json(UpdateTripResponse.parse(buildTripDetail(updated!, roster, user.id)));
});

router.post("/trips/:tripId/start", async (req, res): Promise<void> => {
  const user = currentUser(res);
  const params = StartTripParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const loaded = await loadTripForUser(params.data.tripId, user.id);
  if (!loaded) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }
  const { trip, self, roster } = loaded;
  if (self.role !== "leader") {
    res.status(403).json({ error: "Only leaders can start the trip" });
    return;
  }
  if (trip.status !== "draft") {
    res.status(409).json({ error: "Trip is not in draft" });
    return;
  }
  const [updated] = await db
    .update(tripsTable)
    .set({ status: "active", startedAt: new Date() })
    .where(eq(tripsTable.id, trip.id))
    .returning();
  res.json(StartTripResponse.parse(buildTripDetail(updated!, roster, user.id)));
});

router.post("/trips/:tripId/end", async (req, res): Promise<void> => {
  const user = currentUser(res);
  const params = EndTripParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const loaded = await loadTripForUser(params.data.tripId, user.id);
  if (!loaded) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }
  const { trip, self, roster } = loaded;
  if (self.role !== "leader") {
    res.status(403).json({ error: "Only leaders can end the trip" });
    return;
  }
  if (trip.status === "ended") {
    res.status(409).json({ error: "Trip already ended" });
    return;
  }
  const updated = await endTripNow(trip, roster);
  const freshRoster = await getRoster(trip.id);
  res.json(EndTripResponse.parse(buildTripDetail(updated, freshRoster, user.id)));
});

router.post("/trips/:tripId/leave", async (req, res): Promise<void> => {
  const user = currentUser(res);
  const params = LeaveTripParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const loaded = await loadTripForUser(params.data.tripId, user.id);
  if (!loaded) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }
  const { roster, self } = loaded;
  if (self.role === "leader") {
    const otherLeaders = roster.filter(
      (m) => m.role === "leader" && m.id !== self.id && m.joinStatus === "joined",
    );
    if (otherLeaders.length === 0) {
      res.status(409).json({
        error: "You are the only leader. Promote another member to leader before leaving.",
      });
      return;
    }
  }
  await db
    .update(tripMembersTable)
    .set({ joinStatus: "left", sharing: false })
    .where(eq(tripMembersTable.id, self.id));
  res.json({ ok: true });
});

router.get("/join/:code", async (req, res): Promise<void> => {
  const params = GetJoinPreviewParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const code = params.data.code.trim().toUpperCase();
  const [trip] = await db
    .select()
    .from(tripsTable)
    .where(eq(tripsTable.joinCode, code));
  if (!trip) {
    res.status(404).json({ error: "No trip found for that code" });
    return;
  }
  const roster = await getRoster(trip.id);
  res.json(
    GetJoinPreviewResponse.parse({
      tripName: trip.name,
      destLabel: trip.destLabel,
      scheduledAt: trip.scheduledAt.toISOString(),
      status: trip.status,
      memberCount: roster.filter((m) => m.joinStatus === "joined").length,
    }),
  );
});

router.post("/join", async (req, res): Promise<void> => {
  const user = currentUser(res);
  const parsed = JoinTripBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const code = parsed.data.code.trim().toUpperCase();
  const [trip] = await db
    .select()
    .from(tripsTable)
    .where(eq(tripsTable.joinCode, code));
  if (!trip) {
    res.status(404).json({ error: "No trip found for that code" });
    return;
  }
  if (trip.status === "ended") {
    res.status(409).json({ error: "This trip has already ended" });
    return;
  }
  // Any previous membership (invited / left / removed) gets revived
  const allRows = await db
    .select()
    .from(tripMembersTable)
    .where(eq(tripMembersTable.tripId, trip.id));
  const mine = allRows.find(
    (m) => m.userId === user.id || m.phone === user.phone,
  );
  if (mine) {
    await db
      .update(tripMembersTable)
      .set({
        userId: user.id,
        name: user.name,
        initial: initialOf(user.name),
        joinStatus: "joined",
      })
      .where(eq(tripMembersTable.id, mine.id));
  } else {
    const active = allRows.filter((m) =>
      (ACTIVE_STATUSES as readonly string[]).includes(m.joinStatus),
    );
    await db.insert(tripMembersTable).values({
      tripId: trip.id,
      userId: user.id,
      name: user.name,
      phone: user.phone,
      role: "member",
      color: pickColor(active),
      initial: initialOf(user.name),
      joinStatus: "joined",
    });
  }
  const roster = await getRoster(trip.id);
  res.json(JoinTripResponse.parse(buildTripDetail(trip, roster, user.id)));
});

router.post("/trips/:tripId/members", async (req, res): Promise<void> => {
  const user = currentUser(res);
  const params = InviteMemberParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = InviteMemberBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const loaded = await loadTripForUser(params.data.tripId, user.id);
  if (!loaded) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }
  const { trip, roster, self } = loaded;
  if (self.role !== "leader") {
    res.status(403).json({ error: "Only leaders can add members" });
    return;
  }
  if (trip.status === "ended") {
    res.status(409).json({ error: "This trip has ended" });
    return;
  }
  const phone = body.data.phone.trim();
  if (roster.some((m) => m.phone === phone)) {
    res.status(409).json({ error: "That phone number is already on this trip" });
    return;
  }
  const [existingUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.phone, phone));
  const name = body.data.name?.trim() || existingUser?.name || phone;
  const [member] = await db
    .insert(tripMembersTable)
    .values({
      tripId: trip.id,
      userId: existingUser?.id ?? null,
      name,
      phone,
      role: "member",
      color: pickColor(roster),
      initial: initialOf(name),
      joinStatus: "invited",
    })
    .returning();
  res.status(201).json(InviteMemberResponse.parse(memberToApi(member!, user.id)));
});

router.delete(
  "/trips/:tripId/members/:memberId",
  async (req, res): Promise<void> => {
    const user = currentUser(res);
    const params = RemoveMemberParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const loaded = await loadTripForUser(params.data.tripId, user.id);
    if (!loaded) {
      res.status(404).json({ error: "Trip not found" });
      return;
    }
    const { roster, self } = loaded;
    if (self.role !== "leader") {
      res.status(403).json({ error: "Only leaders can remove members" });
      return;
    }
    const target = roster.find((m) => m.id === params.data.memberId);
    if (!target) {
      res.status(404).json({ error: "Member not found" });
      return;
    }
    if (target.role === "leader") {
      const otherLeaders = roster.filter(
        (m) => m.role === "leader" && m.id !== target.id && m.joinStatus === "joined",
      );
      if (otherLeaders.length === 0) {
        res.status(409).json({ error: "Cannot remove the only leader. Promote someone else first." });
        return;
      }
    }
    await db
      .update(tripMembersTable)
      .set({ joinStatus: "removed", sharing: false })
      .where(eq(tripMembersTable.id, target.id));
    res.json({ ok: true });
  },
);

router.post(
  "/trips/:tripId/members/:memberId/promote",
  async (req, res): Promise<void> => {
    const user = currentUser(res);
    const params = PromoteMemberParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const loaded = await loadTripForUser(params.data.tripId, user.id);
    if (!loaded) {
      res.status(404).json({ error: "Trip not found" });
      return;
    }
    const { roster, self } = loaded;
    if (self.role !== "leader") {
      res.status(403).json({ error: "Only leaders can promote members" });
      return;
    }
    const target = roster.find((m) => m.id === params.data.memberId);
    if (!target) {
      res.status(404).json({ error: "Member not found" });
      return;
    }
    if (target.joinStatus !== "joined") {
      res.status(409).json({ error: "Member must join the trip before being promoted" });
      return;
    }
    const [updated] = await db
      .update(tripMembersTable)
      .set({ role: "leader" })
      .where(eq(tripMembersTable.id, target.id))
      .returning();
    res.json(PromoteMemberResponse.parse(memberToApi(updated!, user.id)));
  },
);

export default router;
