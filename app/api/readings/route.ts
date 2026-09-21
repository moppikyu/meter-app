import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getMeterHistory,
  saveReading,
  getOrCreateBatch,
  MeterType,
} from "@/lib/readings";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const meterIdParam = req.nextUrl.searchParams.get("meterId");
  const meterId = meterIdParam ? Number(meterIdParam) : NaN;
  if (!meterIdParam || Number.isNaN(meterId)) {
    return NextResponse.json(
      { error: 'Query param "meterId" is required and must be a number' },
      { status: 400 }
    );
  }

  const history = getMeterHistory(meterId);
  return NextResponse.json({ history });
}

interface SaveReadingBody {
  meterId: number;
  readingValue: number;
  readingDate: string; // "YYYY-MM-DD"
  notes?: string;
  isAdjustment?: boolean;
  photoPath?: string;
  batchType: MeterType;
  periodLabel: string; // e.g. "September 2026"
  scheduledDate: string; // "YYYY-MM-DD"
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  // Manual reading entry changes data — restricted to the editor role.
  // Your aunt's viewer login can read everything but can't save/correct readings.
  if (user.role !== "editor") {
    return NextResponse.json(
      { error: "Only the editor account can save readings" },
      { status: 403 }
    );
  }

  let body: SaveReadingBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const {
    meterId,
    readingValue,
    readingDate,
    notes,
    isAdjustment,
    photoPath,
    batchType,
    periodLabel,
    scheduledDate,
  } = body;

  if (
    typeof meterId !== "number" ||
    typeof readingValue !== "number" ||
    !readingDate ||
    !batchType ||
    !periodLabel ||
    !scheduledDate
  ) {
    return NextResponse.json(
      {
        error:
          "meterId, readingValue, readingDate, batchType, periodLabel, and scheduledDate are required",
      },
      { status: 400 }
    );
  }

  const batch = isAdjustment
    ? null
    : getOrCreateBatch(batchType, periodLabel, scheduledDate, user.id);

  const result = saveReading({
    meterId,
    readingDate,
    readingValue,
    photoPath: photoPath ?? null,
    notes: notes ?? null,
    isAdjustment: Boolean(isAdjustment),
    batchId: batch ? batch.id : null,
    createdBy: user.id,
  });

  return NextResponse.json({ result });
}
