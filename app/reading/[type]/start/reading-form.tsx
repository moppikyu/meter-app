"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Camera, ArrowLeft, Check, AlertTriangle } from "lucide-react";

interface MeterWithReading {
  id: number;
  meter_code: string;
  location_label: string;
  tenant_name: string | null;
  digit_count: number;
  latestReading: {
    value: number;
    date: string;
    flag: string;
    photoPath: string | null;
  } | null;
}

interface RowState {
  value: string;
  photo: File | null;
  saving: boolean;
  error: string | null;
  result: { increase: number; flag: string } | null;
}

const FLAG_MESSAGES: Record<string, string> = {
  decrease:
    "This reading is lower than last time. Please double check the meter before saving again.",
  spike: "This increase is much larger than usual for this meter. Worth a second look.",
  rollover: "Meter appears to have rolled over — increase calculated across the rollover.",
};

function currentPeriod() {
  const now = new Date();
  const periodLabel = now.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const isoDate = now.toISOString().slice(0, 10);
  return { periodLabel, isoDate };
}

const TYPE_ACCENT: Record<string, string> = {
  water: "bg-water hover:opacity-90",
  electric: "bg-electric hover:opacity-90",
};

export default function ReadingForm({ type }: { type: "water" | "electric" }) {
  const [meters, setMeters] = useState<MeterWithReading[] | null>(null);
  const [rows, setRows] = useState<Record<number, RowState>>({});
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/meters?type=${type}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setLoadError(data.error);
          return;
        }
        setMeters(data.meters);
        const initialRows: Record<number, RowState> = {};
        for (const meter of data.meters as MeterWithReading[]) {
          initialRows[meter.id] = {
            value: "",
            photo: null,
            saving: false,
            error: null,
            result: null,
          };
        }
        setRows(initialRows);
      })
      .catch(() => setLoadError("Could not load meters. Check your connection."));
  }, [type]);

  function updateRow(meterId: number, patch: Partial<RowState>) {
    setRows((prev) => ({ ...prev, [meterId]: { ...prev[meterId], ...patch } }));
  }

  async function handleSave(meter: MeterWithReading) {
    const row = rows[meter.id];
    if (!row || row.value.trim() === "") {
      updateRow(meter.id, { error: "Enter a reading before saving." });
      return;
    }
    const numericValue = Number(row.value);
    if (Number.isNaN(numericValue)) {
      updateRow(meter.id, { error: "Reading must be a number." });
      return;
    }

    updateRow(meter.id, { saving: true, error: null });

    try {
      let photoPath: string | undefined;
      if (row.photo) {
        const formData = new FormData();
        formData.append("photo", row.photo);
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) {
          throw new Error(uploadData.error ?? "Photo upload failed");
        }
        photoPath = uploadData.photoPath;
      }

      const { periodLabel, isoDate } = currentPeriod();
      const saveRes = await fetch("/api/readings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meterId: meter.id,
          readingValue: numericValue,
          readingDate: isoDate,
          photoPath,
          batchType: type,
          periodLabel,
          scheduledDate: isoDate,
        }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) {
        throw new Error(saveData.error ?? "Could not save reading");
      }

      updateRow(meter.id, {
        saving: false,
        result: { increase: saveData.result.increase, flag: saveData.result.flag },
      });
    } catch (err) {
      updateRow(meter.id, {
        saving: false,
        error: err instanceof Error ? err.message : "Something went wrong",
      });
    }
  }

  if (loadError) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <p className="text-bad">{loadError}</p>
      </main>
    );
  }

  if (!meters) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <p className="text-ink-soft">Loading meters...</p>
      </main>
    );
  }

  const savedCount = Object.values(rows).filter((r) => r.result).length;

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-ink capitalize">{type} Reading</h1>
            <p className="text-sm text-ink-soft">
              {savedCount} of {meters.length} saved this session
            </p>
          </div>
          <Link
            href="/dashboard"
            className="flex items-center gap-1 text-sm text-ink-soft hover:text-ink"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={2} />
            Dashboard
          </Link>
        </header>

        {meters.map((meter) => {
          const row = rows[meter.id];
          if (!row) return null;
          const flagMessage = row.result ? FLAG_MESSAGES[row.result.flag] : null;

          return (
            <div key={meter.id} className="bg-surface rounded-md border border-line p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-ink">
                    {meter.tenant_name ?? "Vacant"}{" "}
                    <span className="text-xs text-ink-soft font-mono">({meter.meter_code})</span>
                  </p>
                  <p className="text-xs text-ink-soft">{meter.location_label}</p>
                </div>
                {meter.latestReading && (
                  <p className="text-sm text-ink-soft">
                    Previous: <span className="font-medium text-ink">{meter.latestReading.value}</span>
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="New reading"
                  value={row.value}
                  onChange={(e) => updateRow(meter.id, { value: e.target.value })}
                  disabled={row.saving || !!row.result}
                  className="w-40 rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-water/40 focus:border-water disabled:opacity-60"
                />

                <label className="flex items-center gap-1.5 text-sm text-ink-soft cursor-pointer hover:text-ink">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    disabled={row.saving || !!row.result}
                    onChange={(e) =>
                      updateRow(meter.id, { photo: e.target.files?.[0] ?? null })
                    }
                  />
                  <Camera className="w-4 h-4" strokeWidth={2} />
                  {row.photo ? row.photo.name : "Attach photo (proof)"}
                </label>

                {!row.result && (
                  <button
                    onClick={() => handleSave(meter)}
                    disabled={row.saving}
                    className={`ml-auto rounded-md text-white text-sm font-medium px-4 py-2 disabled:opacity-50 ${TYPE_ACCENT[type]}`}
                  >
                    {row.saving ? "Saving..." : "Save"}
                  </button>
                )}
              </div>

              {row.error && <p className="text-sm text-bad">{row.error}</p>}

              {row.result && (
                <div className="text-sm rounded-md bg-good-soft text-good px-3 py-2 flex items-start gap-2">
                  <Check className="w-4 h-4 mt-0.5 flex-shrink-0" strokeWidth={2} />
                  <div>
                    Saved. Increase: +{row.result.increase}
                    {flagMessage && (
                      <p className="text-warn mt-1 flex items-start gap-1.5">
                        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" strokeWidth={2} />
                        {flagMessage}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
