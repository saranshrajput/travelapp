import { randomBytes } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, type UserRow } from "@workspace/db";

export function generateToken(): string {
  return randomBytes(24).toString("hex");
}

export function generateJoinCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  const bytes = randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += alphabet[bytes[i]! % alphabet.length];
  }
  return code;
}

export function currentUser(res: Response): UserRow {
  return res.locals["user"] as UserRow;
}

export async function authRequired(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }
  const token = header.slice(7).trim();
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.token, token));
  if (!user) {
    res.status(401).json({ error: "Invalid session" });
    return;
  }
  res.locals["user"] = user;
  next();
}
