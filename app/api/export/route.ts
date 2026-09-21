import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getMeters, getMeterSummary, MeterType } from "@/lib/readings";

function csvEscape(value: string | number | null): string {
  if (value === null) return "";
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const type = req.nextUrl.searchParams.get("type") as MeterType | null;
  if (type !== "water" && type !== "electric") {
    return NextResponse.json(
      { error: 'Query param "type" must be "water" or "electric"' },
      { status: 400 }
    );
  }

  const meters = getMeters(type);
  const header = [
    "Meter Code",
    "Location",
    "Tenant",
    "Previous Reading",
    "Reading Date",
    "Current Reading",
    "Current Reading Date",
    "Increase",
    "Status",
  ];

  const rows = meters.map((meter) => {
    const summary = getMeterSummary(meter.id);
    return [
      meter.meter_code,
      meter.location_label,
      meter.tenant_name ?? "Vacant",
      summary.previous ? summary.previous.reading_value : "",
      summary.previous ? summary.previous.reading_date : "",
      summary.latest ? summary.latest.reading_value : "",
      summary.latest ? summary.latest.reading_date : "",
      summary.increase !== null ? summary.increase : "",
      summary.latest ? summary.latest.flag : "no reading yet",
    ].map(csvEscape);
  });

  const csv = [header.map(csvEscape).join(","), ...rows.map((r) => r.join(","))].join("\n");

  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${type}-readings-${today}.csv"`,
    },
  });
}
