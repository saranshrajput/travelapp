import { Router, type IRouter } from "express";
import { eq, and, asc } from "drizzle-orm";
import {
  db,
  tripsTable,
  tripMembersTable,
  itineraryItemsTable,
  type TripMemberRow,
} from "@workspace/db";
import {
  ListItineraryParams,
  CreateItineraryItemParams,
  CreateItineraryItemBody,
  CreateItineraryItemResponse,
  UpdateItineraryItemParams,
  UpdateItineraryItemBody,
  UpdateItineraryItemResponse,
  RemoveItineraryItemParams,
  RemoveItineraryItemResponse,
} from "@workspace/api-zod";
import { authRequired, currentUser } from "../lib/auth";
import { findSelf, getRoster } from "../lib/convoy";

const router: IRouter = Router();

router.use(
  ["/trips/:tripId/itinerary", "/trips/:tripId/itinerary/:itemId"],
  authRequired,
);

const MAX_TITLE = 120;
const MAX_ADDRESS = 300;
const MAX_CONFIRMATION = 80;
const MAX_NOTES = 1000;

type ItineraryInput = {
  kind: "stay" | "activity" | "transport" | "food" | "other";
  title: string;
  address?: string;
  startAt: string;
  endAt?: string;
  confirmationCode?: string;
  notes?: string;
};

function optionalText(value: string | undefined): string | null {
  const t = value?.trim();
  return t ? t : null;
}

// Validates and normalises a create/update body into DB column values.
// Returns an error string instead when the input is unusable.
function toColumns(input: ItineraryInput) {
  const title = input.title.trim();
  if (!title) return { error: "title is required" } as const;
  if (title.length > MAX_TITLE) return { error: `title must be at most ${MAX_TITLE} characters` } as const;
  const address = optionalText(input.address);
  if (address && address.length > MAX_ADDRESS) return { error: `address must be at most ${MAX_ADDRESS} characters` } as const;
  const confirmationCode = optionalText(input.confirmationCode);
  if (confirmationCode && confirmationCode.length > MAX_CONFIRMATION) {
    return { error: `confirmationCode must be at most ${MAX_CONFIRMATION} characters` } as const;
  }
  const notes = optionalText(input.notes);
  if (notes && notes.length > MAX_NOTES) return { error: `notes must be at most ${MAX_NOTES} characters` } as const;

  const startAt = new Date(input.startAt);
  if (Number.isNaN(startAt.getTime())) return { error: "startAt must be a valid date" } as const;
  let endAt: Date | null = null;
  if (input.endAt) {
    endAt = new Date(input.endAt);
    if (Number.isNaN(endAt.getTime())) return { error: "endAt must be a valid date" } as const;
    if (endAt < startAt) return { error: "endAt must be after startAt" } as const;
  }

  return {
    values: { kind: input.kind, title, address, startAt, endAt, confirmationCode, notes },
  } as const;
}

function itemToApi(
  item: typeof itineraryItemsTable.$inferSelect,
  createdByName: string,
  self: TripMemberRow,
) {
  return {
    id: item.id,
    tripId: item.tripId,
    createdByMemberId: item.createdByMemberId,
    createdByName,
    kind: item.kind as ItineraryInput["kind"],
    title: item.title,
    address: item.address ?? null,
    startAt: item.startAt.toISOString(),
    endAt: item.endAt ? item.endAt.toISOString() : null,
    confirmationCode: item.confirmationCode ?? null,
    notes: item.notes ?? null,
    canEdit: self.role === "leader" || item.createdByMemberId === self.id,
    createdAt: item.createdAt.toISOString(),
  };
}

// Resolves the caller's membership and the trip. Only joined members may
// read or write the itinerary; writes are blocked once the trip has ended.
async function loadContext(
  tripId: number,
  userId: number,
  forWrite: boolean,
): Promise<
  | { ok: true; self: TripMemberRow }
  | { ok: false; status: number; error: string }
> {
  const [trip] = await db
    .select()
    .from(tripsTable)
    .where(eq(tripsTable.id, tripId));
  if (!trip) return { ok: false, status: 404, error: "Trip not found" };

  const roster = await getRoster(tripId);
  const self = findSelf(roster, userId);
  if (!self || self.joinStatus !== "joined") {
    return { ok: false, status: 403, error: "You are not a member of this trip" };
  }
  if (forWrite && trip.status === "ended") {
    return { ok: false, status: 409, error: "Trip has ended" };
  }
  return { ok: true, self };
}

async function findActiveItem(tripId: number, itemId: number) {
  const [item] = await db
    .select()
    .from(itineraryItemsTable)
    .where(
      and(
        eq(itineraryItemsTable.id, itemId),
        eq(itineraryItemsTable.tripId, tripId),
        eq(itineraryItemsTable.status, "active"),
      ),
    );
  return item;
}

router.get("/trips/:tripId/itinerary", async (req, res): Promise<void> => {
  const user = currentUser(res);
  const params = ListItineraryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const ctx = await loadContext(params.data.tripId, user.id, false);
  if (!ctx.ok) {
    res.status(ctx.status).json({ error: ctx.error });
    return;
  }

  // Left join so items stay attributed even if their creator left the trip.
  const rows = await db
    .select({ item: itineraryItemsTable, createdByName: tripMembersTable.name })
    .from(itineraryItemsTable)
    .leftJoin(
      tripMembersTable,
      eq(tripMembersTable.id, itineraryItemsTable.createdByMemberId),
    )
    .where(
      and(
        eq(itineraryItemsTable.tripId, params.data.tripId),
        eq(itineraryItemsTable.status, "active"),
      ),
    )
    .orderBy(asc(itineraryItemsTable.startAt), asc(itineraryItemsTable.id));

  res.json(
    rows.map((r) => itemToApi(r.item, r.createdByName ?? "Former member", ctx.self)),
  );
});

router.post("/trips/:tripId/itinerary", async (req, res): Promise<void> => {
  const user = currentUser(res);
  const params = CreateItineraryItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = CreateItineraryItemBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const ctx = await loadContext(params.data.tripId, user.id, true);
  if (!ctx.ok) {
    res.status(ctx.status).json({ error: ctx.error });
    return;
  }
  const cols = toColumns(body.data);
  if ("error" in cols) {
    res.status(400).json({ error: cols.error });
    return;
  }

  const [item] = await db
    .insert(itineraryItemsTable)
    .values({
      tripId: params.data.tripId,
      createdByMemberId: ctx.self.id,
      ...cols.values,
      status: "active",
    })
    .returning();

  res
    .status(201)
    .json(CreateItineraryItemResponse.parse(itemToApi(item!, ctx.self.name, ctx.self)));
});

router.put(
  "/trips/:tripId/itinerary/:itemId",
  async (req, res): Promise<void> => {
    const user = currentUser(res);
    const params = UpdateItineraryItemParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const body = UpdateItineraryItemBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }
    const ctx = await loadContext(params.data.tripId, user.id, true);
    if (!ctx.ok) {
      res.status(ctx.status).json({ error: ctx.error });
      return;
    }
    const existing = await findActiveItem(params.data.tripId, params.data.itemId);
    if (!existing) {
      res.status(404).json({ error: "Itinerary item not found" });
      return;
    }
    if (ctx.self.role !== "leader" && existing.createdByMemberId !== ctx.self.id) {
      res.status(403).json({ error: "Only the person who added this or a leader can edit it" });
      return;
    }
    const cols = toColumns(body.data);
    if ("error" in cols) {
      res.status(400).json({ error: cols.error });
      return;
    }

    const [item] = await db
      .update(itineraryItemsTable)
      .set({ ...cols.values, updatedAt: new Date() })
      .where(eq(itineraryItemsTable.id, existing.id))
      .returning();

    const [creator] = await db
      .select({ name: tripMembersTable.name })
      .from(tripMembersTable)
      .where(eq(tripMembersTable.id, item!.createdByMemberId));

    res.json(
      UpdateItineraryItemResponse.parse(
        itemToApi(item!, creator?.name ?? "Former member", ctx.self),
      ),
    );
  },
);

router.delete(
  "/trips/:tripId/itinerary/:itemId",
  async (req, res): Promise<void> => {
    const user = currentUser(res);
    const params = RemoveItineraryItemParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const ctx = await loadContext(params.data.tripId, user.id, true);
    if (!ctx.ok) {
      res.status(ctx.status).json({ error: ctx.error });
      return;
    }
    const existing = await findActiveItem(params.data.tripId, params.data.itemId);
    if (!existing) {
      res.status(404).json({ error: "Itinerary item not found" });
      return;
    }
    if (ctx.self.role !== "leader" && existing.createdByMemberId !== ctx.self.id) {
      res.status(403).json({ error: "Only the person who added this or a leader can remove it" });
      return;
    }

    await db
      .update(itineraryItemsTable)
      .set({ status: "removed", updatedAt: new Date() })
      .where(eq(itineraryItemsTable.id, existing.id));

    res.json(RemoveItineraryItemResponse.parse({ ok: true }));
  },
);

export default router;
