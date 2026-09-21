import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";

export type Role = "editor" | "viewer";

export interface SessionUser {
  id: number;
  username: string;
  role: Role;
}

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const SESSION_COOKIE_NAME = "meter_session";

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function findUserByUsername(username: string):
  | { id: number; username: string; password_hash: string; role: Role }
  | undefined {
  const row = db
    .prepare(
      "SELECT id, username, password_hash, role FROM users WHERE username = ?"
    )
    .get(username) as
    | { id: number; username: string; password_hash: string; role: Role }
    | undefined;
  return row;
}

export function findUserById(id: number):
  | { id: number; username: string; password_hash: string; role: Role }
  | undefined {
  const row = db
    .prepare(
      "SELECT id, username, password_hash, role FROM users WHERE id = ?"
    )
    .get(id) as
    | { id: number; username: string; password_hash: string; role: Role }
    | undefined;
  return row;
}

export function updateUserPassword(userId: number, newHash: string): void {
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
    newHash,
    userId
  );
}

/** Creates a session row and returns the token to set as a cookie. */
export function createSession(userId: number): {
  token: string;
  expiresAt: Date;
} {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  db.prepare(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)"
  ).run(token, userId, expiresAt.toISOString());
  return { token, expiresAt };
}

export function destroySession(token: string): void {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

/** Looks up the session and returns the associated user, or null if invalid/expired. */
export function getSessionUser(token: string | undefined): SessionUser | null {
  if (!token) return null;

  const row = db
    .prepare(
      `SELECT s.expires_at as expiresAt, u.id, u.username, u.role
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`
    )
    .get(token) as
    | { expiresAt: string; id: number; username: string; role: Role }
    | undefined;

  if (!row) return null;

  if (new Date(row.expiresAt).getTime() < Date.now()) {
    destroySession(token);
    return null;
  }

  return { id: row.id, username: row.username, role: row.role };
}

/**
 * Reads the session cookie for the current request and returns the logged-in
 * user, or null. Safe to call from Server Components and Route Handlers
 * (both run on the Node.js runtime by default in the App Router, so
 * node:sqlite works here — this is why auth is checked per-page/route
 * instead of in Edge middleware).
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return getSessionUser(token);
}
