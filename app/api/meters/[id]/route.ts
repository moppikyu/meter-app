import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { updateMeter } from "@/lib/readings";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (user.role !== "editor") {
    return NextResponse.json(
      { error: "Only the editor account can edit meters" },
      { status: 403 }
    );
  }

  const { id } = await params;
  const meterId = Number(id);
  if (Number.isNaN(meterId)) {
    return NextResponse.json({ error: "Invalid meter id" }, { status: 400 });
  }

  let body: { locationLabel?: string; description?: string | null; isActive?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  updateMeter(meterId, body);
  return NextResponse.json({ ok: true });
}
