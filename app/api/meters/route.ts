import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getMeters, getLatestReading, createMeter, MeterType } from "@/lib/readings";

// ?type=water|electric (required). ?all=1 also includes inactive/retired
// meters — used by the management screen; the dashboard and reading flow
// omit it and only see active meters.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const type = req.nextUrl.searchParams.get("type") as MeterType | null;
  const includeInactive = req.nextUrl.searchParams.get("all") === "1";

  if (type !== "water" && type !== "electric") {
    return NextResponse.json(
      { error: 'Query param "type" must be "water" or "electric"' },
      { status: 400 }
    );
  }

  const meters = getMeters(type, includeInactive).map((meter) => {
    const latest = getLatestReading(meter.id);
    return {
      ...meter,
      latestReading: latest
        ? {
            value: latest.reading_value,
            date: latest.reading_date,
            flag: latest.flag,
            photoPath: latest.photo_path,
          }
        : null,
    };
  });

  return NextResponse.json({ meters });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (user.role !== "editor") {
    return NextResponse.json(
      { error: "Only the editor account can add meters" },
      { status: 403 }
    );
  }

  let body: {
    meterCode?: string;
    meterType?: MeterType;
    locationLabel?: string;
    description?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { meterCode, meterType, locationLabel, description } = body;
  if (!meterCode || !meterType || !locationLabel) {
    return NextResponse.json(
      { error: "meterCode, meterType, and locationLabel are required" },
      { status: 400 }
    );
  }
  if (meterType !== "water" && meterType !== "electric") {
    return NextResponse.json(
      { error: 'meterType must be "water" or "electric"' },
      { status: 400 }
    );
  }

  try {
    const id = createMeter({
      meterCode,
      meterType,
      locationLabel,
      description: description ?? null,
    });
    return NextResponse.json({ id });
  } catch {
    return NextResponse.json(
      { error: `Meter code "${meterCode}" is already in use` },
      { status: 409 }
    );
  }
}
