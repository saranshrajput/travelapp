import { Router, type IRouter } from "express";
import { eq, and, isNull } from "drizzle-orm";
import { db, usersTable, tripMembersTable, type UserRow } from "@workspace/db";
import {
  CreateSessionBody,
  CreateSessionResponse,
  GetMeResponse,
  VerifyPhoneBody,
  VerifyPhoneResponse,
} from "@workspace/api-zod";
import { authRequired, currentUser, generateToken } from "../lib/auth";
import { phoneNumbersMatch, verifyFirebasePhoneToken } from "../lib/firebaseAuth";

function userToApi(user: UserRow) {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    verifiedAt: user.verifiedAt ? user.verifiedAt.toISOString() : null,
  };
}

const router: IRouter = Router();

router.post("/auth/session", async (req, res): Promise<void> => {
  const parsed = CreateSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const name = parsed.data.name.trim();
  const phone = parsed.data.phone.trim();
  if (name.length === 0 || phone.length < 5) {
    res.status(400).json({ error: "Name and phone are required" });
    return;
  }

  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.phone, phone));

  let user = existing;
  if (user) {
    if (user.name !== name) {
      const [updated] = await db
        .update(usersTable)
        .set({ name })
        .where(eq(usersTable.id, user.id))
        .returning();
      user = updated!;
    }
  } else {
    const [created] = await db
      .insert(usersTable)
      .values({ name, phone, token: generateToken() })
      .returning();
    user = created!;
  }

  // Link any pending invites for this phone to the user account
  await db
    .update(tripMembersTable)
    .set({ userId: user.id })
    .where(
      and(eq(tripMembersTable.phone, phone), isNull(tripMembersTable.userId)),
    );

  res.json(
    CreateSessionResponse.parse({
      token: user.token,
      user: userToApi(user),
    }),
  );
});

router.get("/me", authRequired, async (_req, res): Promise<void> => {
  const user = currentUser(res);
  res.json(GetMeResponse.parse(userToApi(user)));
});

router.post("/auth/verify-phone", authRequired, async (req, res): Promise<void> => {
  const body = VerifyPhoneBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const user = currentUser(res);
  const verifiedPhone = await verifyFirebasePhoneToken(body.data.idToken);
  if (!verifiedPhone) {
    res.status(400).json({ error: "Invalid or expired verification token" });
    return;
  }
  if (!phoneNumbersMatch(verifiedPhone, user.phone)) {
    res.status(400).json({
      error: "The verified number doesn't match this account's phone number",
    });
    return;
  }
  const [updated] = await db
    .update(usersTable)
    .set({ verifiedAt: new Date() })
    .where(eq(usersTable.id, user.id))
    .returning();
  res.json(VerifyPhoneResponse.parse(userToApi(updated!)));
});

export default router;
