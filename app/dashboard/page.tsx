import { redirect } from "next/navigation";
import Link from "next/link";
import { Droplet, Zap, Settings, KeyRound, AlertTriangle, Download, History } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import {
  getMeters,
  getMeterSummary,
  getMissingMetersForCurrentPeriod,
  getCurrentPeriodLabel,
  MeterType,
} from "@/lib/readings";
import LogoutButton from "../logout-button";

const FLAG_LABELS: Record<string, { text: string; className: string }> = {
  none: { text: "OK", className: "text-good bg-good-soft" },
  decrease: { text: "Lower than last time", className: "text-bad bg-bad-soft" },
  spike: { text: "Unusually large jump", className: "text-warn bg-warn-soft" },
  rollover: { text: "Rollover (auto-corrected)", className: "text-water bg-water-soft" },
};

const TYPE_STYLE: Record<MeterType, { accent: string; soft: string; icon: typeof Droplet }> = {
  water: { accent: "text-water", soft: "bg-water-soft", icon: Droplet },
  electric: { accent: "text-electric", soft: "bg-electric-soft", icon: Zap },
};

function MeterSection({
  title,
  type,
  canEdit,
}: {
  title: string;
  type: MeterType;
  canEdit: boolean;
}) {
  const meters = getMeters(type);
  const missing = getMissingMetersForCurrentPeriod(type);
  const periodLabel = getCurrentPeriodLabel();
  const style = TYPE_STYLE[type];
  const Icon = style.icon;

  return (
    <section className="bg-surface rounded-md border border-line">
      <div className="flex items-center justify-between px-5 py-4 border-b border-line">
        <div className="flex items-center gap-2.5">
          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-md ${style.soft}`}>
            <Icon className={`w-4 h-4 ${style.accent}`} strokeWidth={2} />
          </span>
          <h2 className="text-base font-semibold text-ink">{title}</h2>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={`/api/export?type=${type}`}
            className="flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink"
          >
            <Download className="w-4 h-4" strokeWidth={2} />
            Export CSV
          </a>
          {canEdit && (
            <Link
              href={`/reading/${type}/start`}
              className={`text-sm font-medium text-white px-3 py-1.5 rounded-md ${
                type === "water" ? "bg-water hover:opacity-90" : "bg-electric hover:opacity-90"
              }`}
            >
              Start {title} Reading
            </Link>
          )}
        </div>
      </div>

      {missing.length > 0 && (
        <div className="flex items-start gap-2 px-5 py-3 bg-warn-soft text-warn text-sm border-b border-line">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" strokeWidth={2} />
          <div>
            <strong>
              {missing.length} {title.toLowerCase()} meter{missing.length === 1 ? "" : "s"} not
              yet recorded for {periodLabel}:
            </strong>{" "}
            {missing.map((m) => m.tenant_name ?? m.location_label).join(", ")}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink-soft">
              <th className="py-2 pl-5 pr-4 font-medium">Meter</th>
              <th className="py-2 pr-4 font-medium">Tenant / Location</th>
              <th className="py-2 pr-4 font-medium text-right">Previous</th>
              <th className="py-2 pr-4 font-medium text-right">Current</th>
              <th className="py-2 pr-4 font-medium text-right">Increase</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 pr-5 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {meters.map((meter) => {
              const summary = getMeterSummary(meter.id);
              const flag = summary.latest?.flag ?? "none";
              const flagInfo = FLAG_LABELS[flag] ?? FLAG_LABELS.none;

              return (
                <tr key={meter.id} className="border-t border-line">
                  <td className="py-2.5 pl-5 pr-4 font-mono text-xs text-ink-soft">
                    {meter.meter_code}
                  </td>
                  <td className="py-2.5 pr-4">
                    <div className="text-ink">
                      {meter.tenant_name ?? <span className="text-ink-soft italic">Vacant</span>}
                    </div>
                    <div className="text-xs text-ink-soft">{meter.location_label}</div>
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums text-ink-soft">
                    {summary.previous ? summary.previous.reading_value : "—"}
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums font-medium text-ink">
                    {summary.latest ? summary.latest.reading_value : "—"}
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums text-ink-soft">
                    {summary.increase !== null ? `+${summary.increase}` : "—"}
                  </td>
                  <td className="py-2.5 pr-4">
                    {summary.latest ? (
                      <span className={`text-xs font-medium px-2 py-1 rounded ${flagInfo.className}`}>
                        {flagInfo.text}
                      </span>
                    ) : (
                      <span className="text-xs font-medium px-2 py-1 rounded text-ink-soft bg-paper">
                        No reading yet
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 pr-5 text-right">
                    <Link
                      href={`/meters/${meter.id}/history`}
                      className="inline-flex items-center gap-1 text-xs text-ink-soft hover:text-ink"
                    >
                      <History className="w-3.5 h-3.5" strokeWidth={2} />
                      History
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const canEdit = user.role === "editor";

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-ink">Meter Readings</h1>
            <p className="text-sm text-ink-soft">
              Signed in as {user.username} ({user.role})
            </p>
          </div>
          <div className="flex items-center gap-4">
            {canEdit && (
              <Link
                href="/meters"
                className="flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink"
              >
                <Settings className="w-4 h-4" strokeWidth={2} />
                Manage meters & tenants
              </Link>
            )}
            <Link
              href="/account"
              className="flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink"
            >
              <KeyRound className="w-4 h-4" strokeWidth={2} />
              Change password
            </Link>
            <LogoutButton />
          </div>
        </header>

        <MeterSection title="Water" type="water" canEdit={canEdit} />
        <MeterSection title="Electricity" type="electric" canEdit={canEdit} />
      </div>
    </main>
  );
}
