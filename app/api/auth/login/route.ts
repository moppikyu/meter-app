import { NextRequest, NextResponse } from "next/server";
import {
  findUserByUsername,
  verifyPassword,
  createSession,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { username, password } = body;
  if (!username || !password) {
    return NextResponse.json(
      { error: "Username and password are required" },
      { status: 400 }
    );
  }

  const user = findUserByUsername(username);
  if (!user) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }

  const { token, expiresAt } = createSession(user.id);

  const response = NextResponse.json({
    user: { id: user.id, username: user.username, role: user.role },
  });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  return response;
}
