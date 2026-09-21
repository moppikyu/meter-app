import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  findUserById,
  verifyPassword,
  hashPassword,
  updateUserPassword,
} from "@/lib/auth";

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { currentPassword, newPassword } = body;
  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { error: "Current and new password are required" },
      { status: 400 }
    );
  }
  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: "New password must be at least 8 characters" },
      { status: 400 }
    );
  }

  const record = findUserById(user.id);
  if (!record) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const valid = await verifyPassword(currentPassword, record.password_hash);
  if (!valid) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
  }

  const newHash = await hashPassword(newPassword);
  updateUserPassword(user.id, newHash);

  return NextResponse.json({ ok: true });
}
