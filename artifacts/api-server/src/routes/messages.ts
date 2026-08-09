import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import {
  db,
  tripsTable,
  messagesTable,
  tripMembersTable,
  type TripMemberRow,
  type MessageRow,
} from "@workspace/db";
import {
  ListMessagesParams,
  ListMessagesResponse,
  SendMessageParams,
  SendMessageBody,
  SendMessageResponse,
} from "@workspace/api-zod";
import { authRequired, currentUser } from "../lib/auth";
import { findSelf, getRoster } from "../lib/convoy";

const router: IRouter = Router();

router.use("/trips/:tripId/messages", authRequired);

function messageToApi(msg: MessageRow, byId: Map<number, TripMemberRow>) {
  const sender = byId.get(msg.senderMemberId);
  const recipient =
    msg.recipientMemberId != null ? byId.get(msg.recipientMemberId) : null;
  return {
    id: msg.id,
    tripId: msg.tripId,
    senderMemberId: msg.senderMemberId,
    senderName: sender?.name ?? "Former member",
    senderColor: sender?.color ?? "#9AA0A6",
    senderInitial: sender?.initial ?? "?",
    recipientMemberId: msg.recipientMemberId,
    recipientName:
      recipient?.name ?? (msg.recipientMemberId != null ? "Former member" : null),
    body: msg.body,
    createdAt: msg.createdAt.toISOString(),
  };
}

async function loadMembership(tripId: number, userId: number) {
  const [trip] = await db
    .select()
    .from(tripsTable)
    .where(eq(tripsTable.id, tripId));
  if (!trip) return null;
  const roster = await getRoster(tripId);
  const self = findSelf(roster, userId);
  if (!self || self.joinStatus !== "joined") return null;
  return { trip, roster, self };
}

router.get("/trips/:tripId/messages", async (req, res): Promise<void> => {
  const user = currentUser(res);
  const params = ListMessagesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const loaded = await loadMembership(params.data.tripId, user.id);
  if (!loaded) {
    res.status(403).json({ error: "You are not a member of this trip" });
    return;
  }
  const { self } = loaded;
  const rows = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.tripId, params.data.tripId))
    .orderBy(asc(messagesTable.id));
  // Group messages + DMs involving me
  const visible = rows.filter(
    (m) =>
      m.recipientMemberId == null ||
      m.recipientMemberId === self.id ||
      m.senderMemberId === self.id,
  );
  // Resolve names from the full member table (including departed members)
  const allMembers = await db
    .select()
    .from(tripMembersTable)
    .where(eq(tripMembersTable.tripId, params.data.tripId));
  const byId = new Map(allMembers.map((m) => [m.id, m]));
  res.json(
    ListMessagesResponse.parse(visible.map((m) => messageToApi(m, byId))),
  );
});

router.post("/trips/:tripId/messages", async (req, res): Promise<void> => {
  const user = currentUser(res);
  const params = SendMessageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = SendMessageBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const loaded = await loadMembership(params.data.tripId, user.id);
  if (!loaded) {
    res.status(403).json({ error: "You are not a member of this trip" });
    return;
  }
  const { trip, roster, self } = loaded;
  if (trip.status === "ended") {
    res.status(409).json({ error: "This trip has ended; messaging is closed" });
    return;
  }
  const recipientId = body.data.recipientMemberId ?? null;
  if (recipientId != null) {
    const target = roster.find(
      (m) => m.id === recipientId && m.joinStatus === "joined",
    );
    if (!target) {
      res.status(404).json({ error: "Recipient is not on this trip" });
      return;
    }
    if (target.id === self.id) {
      res.status(400).json({ error: "You cannot message yourself" });
      return;
    }
  }
  const [msg] = await db
    .insert(messagesTable)
    .values({
      tripId: trip.id,
      senderMemberId: self.id,
      recipientMemberId: recipientId,
      body: body.data.body.trim(),
    })
    .returning();
  const byId = new Map(roster.map((m) => [m.id, m]));
  res.status(201).json(SendMessageResponse.parse(messageToApi(msg!, byId)));
});

export default router;
