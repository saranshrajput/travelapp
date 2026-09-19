import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, tripsTable, safeZonesTable } from "@workspace/db";
import {
  ListSafeZonesParams,
  CreateSafeZoneParams,
  CreateSafeZoneBody,
  CreateSafeZoneResponse,
  RemoveSafeZoneParams,
  RemoveSafeZoneResponse,
} from "@workspace/api-zod";
import { authRequired, currentUser } from "../lib/auth";
import { findSelf, getRoster } from "../lib/convoy";

const router: IRouter = Router();

router.use(["/trips/:tripId/safe-zones", "/trips/:tripId/safe-zones/:zoneId"], authRequired);

function safeZoneToApi(zone: typeof safeZonesTable.$inferSelect) {
  return {
    id: zone.id,
    tripId: zone.tripId,
    createdByMemberId: zone.createdByMemberId,
    lat: zone.lat,
    lng: zone.lng,
    radiusM: zone.radiusM,
    label: zone.label ?? null,
    createdAt: zone.createdAt.toISOString(),
  };
}

router.get("/trips/:tripId/safe-zones", async (req, res): Promise<void> => {
  const user = currentUser(res);
  const params = ListSafeZonesParams.safeParse(req.params);
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
    .from(safeZonesTable)
    .where(
      and(
        eq(safeZonesTable.tripId, params.data.tripId),
        eq(safeZonesTable.status, "active"),
      ),
    )
    .orderBy(desc(safeZonesTable.createdAt));

  res.json(rows.map(safeZoneToApi));
});

router.post("/trips/:tripId/safe-zones", async (req, res): Promise<void> => {
  const user = currentUser(res);
  const params = CreateSafeZoneParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = CreateSafeZoneBody.safeParse(req.body);
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
    res.status(403).json({ error: "Only leaders can create a safe zone" });
    return;
  }
  if (body.data.radiusM <= 0) {
    res.status(400).json({ error: "radiusM must be positive" });
    return;
  }

  const [zone] = await db
    .insert(safeZonesTable)
    .values({
      tripId: params.data.tripId,
      createdByMemberId: self.id,
      lat: body.data.lat,
      lng: body.data.lng,
      radiusM: body.data.radiusM,
      label: body.data.label ?? null,
      status: "active",
    })
    .returning();

  res.status(201).json(CreateSafeZoneResponse.parse(safeZoneToApi(zone!)));
});

router.delete(
  "/trips/:tripId/safe-zones/:zoneId",
  async (req, res): Promise<void> => {
    const user = currentUser(res);
    const params = RemoveSafeZoneParams.safeParse(req.params);
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
      res.status(403).json({ error: "Only leaders can remove a safe zone" });
      return;
    }

    const [zone] = await db
      .select()
      .from(safeZonesTable)
      .where(
        and(
          eq(safeZonesTable.id, params.data.zoneId),
          eq(safeZonesTable.tripId, params.data.tripId),
          eq(safeZonesTable.status, "active"),
        ),
      );
    if (!zone) {
      res.status(404).json({ error: "Safe zone not found" });
      return;
    }

    await db
      .update(safeZonesTable)
      .set({ status: "removed" })
      .where(eq(safeZonesTable.id, zone.id));

    res.json(RemoveSafeZoneResponse.parse({ ok: true }));
  },
);

export default router;
