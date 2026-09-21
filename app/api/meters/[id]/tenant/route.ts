import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { renameCurrentTenant, reassignTenant } from "@/lib/readings";

/**
 * Two modes, chosen by the request body:
 *  - { mode: "rename", name }              — fix a placeholder/typo'd name in place, no history change
 *  - { mode: "reassign", name, date }       — tenant turnover: ends the old assignment, starts a new one
 *  - { mode: "reassign", name: null, date } — marks the meter vacant
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (user.role !== "editor") {
    return NextResponse.json(
      { error: "Only the editor account can change tenant assignments" },
      { status: 403 }
    );
  }

  const { id } = await params;
  const meterId = Number(id);
  if (Number.isNaN(meterId)) {
    return NextResponse.json({ error: "Invalid meter id" }, { status: 400 });
  }

  let body: { mode?: string; name?: string | null; date?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (body.mode === "rename") {
    if (!body.name || body.name.trim() === "") {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    const renamed = renameCurrentTenant(meterId, body.name.trim());
    if (!renamed) {
      return NextResponse.json(
        { error: "This meter has no current tenant to rename — use reassign instead" },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: true });
  }

  if (body.mode === "reassign") {
    const effectiveDate = body.date || new Date().toISOString().slice(0, 10);
    reassignTenant(meterId, body.name ?? null, effectiveDate);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json(
    { error: 'mode must be "rename" or "reassign"' },
    { status: 400 }
  );
}
