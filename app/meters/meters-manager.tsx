"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Droplet, Zap, Pencil, Plus, UserX } from "lucide-react";

interface ManagedMeter {
  id: number;
  meter_code: string;
  meter_type: "water" | "electric";
  location_label: string;
  description: string | null;
  is_active: number;
  tenant_name: string | null;
}

const TYPE_STYLE = {
  water: { accent: "text-water", soft: "bg-water-soft", icon: Droplet, label: "Water" },
  electric: { accent: "text-electric", soft: "bg-electric-soft", icon: Zap, label: "Electricity" },
} as const;

function EditPanel({ meter, onSaved }: { meter: ManagedMeter; onSaved: () => void }) {
  const [locationLabel, setLocationLabel] = useState(meter.location_label);
  const [description, setDescription] = useState(meter.description ?? "");
  const [tenantDraft, setTenantDraft] = useState(meter.tenant_name ?? "");
  const [turnoverName, setTurnoverName] = useState("");
  const [turnoverDate, setTurnoverDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveDetails() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/meters/${meter.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationLabel, description }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not save");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function fixName() {
    if (!tenantDraft.trim()) {
      setError("Enter a name first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/meters/${meter.id}/tenant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "rename", name: tenantDraft.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not rename");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleTurnover(vacate: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/meters/${meter.id}/tenant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "reassign",
          name: vacate ? null : turnoverName.trim() || null,
          date: turnoverDate,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not update");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/meters/${meter.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: meter.is_active !== 1 }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not update");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-paper border-t border-line px-5 py-4 space-y-4 text-sm">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-ink-soft mb-1">Location label</label>
          <input
            value={locationLabel}
            onChange={(e) => setLocationLabel(e.target.value)}
            className="w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-soft mb-1">Description (optional)</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={saveDetails}
          disabled={busy}
          className="text-xs font-medium bg-ink text-white px-3 py-1.5 rounded-md disabled:opacity-50"
        >
          Save details
        </button>
        <button
          onClick={toggleActive}
          disabled={busy}
          className="text-xs font-medium text-ink-soft border border-line px-3 py-1.5 rounded-md disabled:opacity-50"
        >
          {meter.is_active === 1 ? "Retire this meter" : "Reactivate this meter"}
        </button>
      </div>

      <div className="border-t border-line pt-4 space-y-3">
        <p className="text-xs font-medium text-ink-soft">Fix a name (typo or placeholder — keeps history as-is)</p>
        <div className="flex items-center gap-2">
          <input
            value={tenantDraft}
            onChange={(e) => setTenantDraft(e.target.value)}
            placeholder="Tenant name"
            className="flex-1 rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm"
          />
          <button
            onClick={fixName}
            disabled={busy}
            className="text-xs font-medium bg-ink text-white px-3 py-1.5 rounded-md disabled:opacity-50"
          >
            Fix name
          </button>
        </div>
      </div>

      <div className="border-t border-line pt-4 space-y-3">
        <p className="text-xs font-medium text-ink-soft">
          Tenant moved out / new tenant moved in (closes out the old tenant&apos;s history and starts a clean baseline)
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={turnoverName}
            onChange={(e) => setTurnoverName(e.target.value)}
            placeholder="New tenant name (leave blank to mark vacant)"
            className="flex-1 min-w-[200px] rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm"
          />
          <input
            type="date"
            value={turnoverDate}
            onChange={(e) => setTurnoverDate(e.target.value)}
            className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm"
          />
          <button
            onClick={() => handleTurnover(false)}
            disabled={busy || !turnoverName.trim()}
            className="text-xs font-medium bg-water text-white px-3 py-1.5 rounded-md disabled:opacity-50"
          >
            Move in
          </button>
          <button
            onClick={() => handleTurnover(true)}
            disabled={busy}
            className="flex items-center gap-1 text-xs font-medium text-bad border border-line px-3 py-1.5 rounded-md disabled:opacity-50"
          >
            <UserX className="w-3.5 h-3.5" strokeWidth={2} />
            Mark vacant
          </button>
        </div>
      </div>

      {error && <p className="text-bad text-xs">{error}</p>}
    </div>
  );
}

function AddMeterForm({
  type,
  onAdded,
}: {
  type: "water" | "electric";
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [meterCode, setMeterCode] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    if (!meterCode.trim() || !locationLabel.trim()) {
      setError("Meter code and location are required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/meters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meterCode: meterCode.trim(),
          meterType: type,
          locationLabel: locationLabel.trim(),
          description: description.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not add meter");
      setMeterCode("");
      setLocationLabel("");
      setDescription("");
      setOpen(false);
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink px-5 py-3"
      >
        <Plus className="w-4 h-4" strokeWidth={2} />
        Add a meter — e.g. a new floor or renovation
      </button>
    );
  }

  return (
    <div className="px-5 py-4 border-t border-line space-y-3 bg-paper">
      <div className="grid sm:grid-cols-3 gap-2">
        <input
          value={meterCode}
          onChange={(e) => setMeterCode(e.target.value)}
          placeholder="Meter code, e.g. W-4F-A"
          className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm"
        />
        <input
          value={locationLabel}
          onChange={(e) => setLocationLabel(e.target.value)}
          placeholder="Location, e.g. 4th Floor A"
          className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm"
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleAdd}
          disabled={busy}
          className="text-xs font-medium bg-ink text-white px-3 py-1.5 rounded-md disabled:opacity-50"
        >
          Add meter
        </button>
        <button
          onClick={() => setOpen(false)}
          className="text-xs font-medium text-ink-soft px-3 py-1.5"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-bad text-xs">{error}</p>}
    </div>
  );
}

function MeterTypeSection({ type }: { type: "water" | "electric" }) {
  const [meters, setMeters] = useState<ManagedMeter[] | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const style = TYPE_STYLE[type];
  const Icon = style.icon;

  function load() {
    fetch(`/api/meters?type=${type}&all=1`)
      .then((res) => res.json())
      .then((data) => setMeters(data.meters ?? []));
  }

  useEffect(load, [type]);

  return (
    <section className="bg-surface rounded-md border border-line">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-line">
        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-md ${style.soft}`}>
          <Icon className={`w-4 h-4 ${style.accent}`} strokeWidth={2} />
        </span>
        <h2 className="text-base font-semibold text-ink">{style.label}</h2>
      </div>

      {meters === null ? (
        <p className="px-5 py-4 text-sm text-ink-soft">Loading...</p>
      ) : (
        meters.map((meter) => (
          <div key={meter.id} className={meter.is_active !== 1 ? "opacity-50" : ""}>
            <div className="flex items-center justify-between px-5 py-3 border-t border-line first:border-t-0">
              <div>
                <p className="text-sm text-ink font-medium">
                  {meter.tenant_name ?? <span className="italic text-ink-soft">Vacant</span>}{" "}
                  <span className="text-xs text-ink-soft font-mono">({meter.meter_code})</span>
                  {meter.is_active !== 1 && (
                    <span className="ml-2 text-xs text-ink-soft">(retired)</span>
                  )}
                </p>
                <p className="text-xs text-ink-soft">{meter.location_label}</p>
              </div>
              <button
                onClick={() => setEditingId(editingId === meter.id ? null : meter.id)}
                className="flex items-center gap-1 text-xs text-ink-soft hover:text-ink"
              >
                <Pencil className="w-3.5 h-3.5" strokeWidth={2} />
                {editingId === meter.id ? "Close" : "Edit"}
              </button>
            </div>
            {editingId === meter.id && (
              <EditPanel
                meter={meter}
                onSaved={() => {
                  load();
                }}
              />
            )}
          </div>
        ))
      )}

      <AddMeterForm type={type} onAdded={load} />
    </section>
  );
}

export default function MetersManager() {
  return (
    <main className="min-h-screen px-4 py-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-ink">Manage Meters &amp; Tenants</h1>
          <Link
            href="/dashboard"
            className="flex items-center gap-1 text-sm text-ink-soft hover:text-ink"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={2} />
            Dashboard
          </Link>
        </header>

        <MeterTypeSection type="water" />
        <MeterTypeSection type="electric" />
      </div>
    </main>
  );
}
