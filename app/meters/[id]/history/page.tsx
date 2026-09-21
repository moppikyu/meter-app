import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Camera } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getMeterById, getMeterHistory } from "@/lib/readings";

const FLAG_LABELS: Record<string, { text: string; className: string }> = {
  none: { text: "OK", className: "text-good bg-good-soft" },
  decrease: { text: "Lower than previous", className: "text-bad bg-bad-soft" },
  spike: { text: "Unusually large jump", className: "text-warn bg-warn-soft" },
  rollover: { text: "Rollover (auto-corrected)", className: "text-water bg-water-soft" },
};

export default async function MeterHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const meterId = Number(id);
  if (Number.isNaN(meterId)) notFound();

  const meter = getMeterById(meterId);
  if (!meter) notFound();

  const history = getMeterHistory(meterId).slice().reverse(); // newest first for reading

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-ink">
              {meter.tenant_name ?? "Vacant"}{" "}
              <span className="text-sm text-ink-soft font-mono">({meter.meter_code})</span>
            </h1>
            <p className="text-sm text-ink-soft">{meter.location_label}</p>
          </div>
          <Link
            href="/dashboard"
            className="flex items-center gap-1 text-sm text-ink-soft hover:text-ink"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={2} />
            Dashboard
          </Link>
        </header>

        <section className="bg-surface rounded-md border border-line overflow-hidden">
          {history.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-soft">No readings recorded yet for this meter.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-soft">
                  <th className="py-2 pl-5 pr-4 font-medium">Date</th>
                  <th className="py-2 pr-4 font-medium text-right">Reading</th>
                  <th className="py-2 pr-4 font-medium text-right">Increase</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-5 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {history.map((reading, index) => {
                  // history is newest-first here; the "previous" row (chronologically
                  // earlier) is the NEXT element in this reversed array.
                  const earlier = history[index + 1];
                  const increase = earlier
                    ? reading.reading_value - earlier.reading_value
                    : null;
                  const flagInfo = FLAG_LABELS[reading.flag] ?? FLAG_LABELS.none;

                  return (
                    <tr key={reading.id} className="border-t border-line first:border-t-0">
                      <td className="py-2.5 pl-5 pr-4 text-ink-soft">
                        {reading.reading_date}
                        {reading.is_adjustment === 1 && (
                          <span className="ml-2 text-xs text-ink-soft italic">(adjustment)</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums font-medium text-ink">
                        {reading.reading_value}
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums text-ink-soft">
                        {increase !== null ? `+${increase}` : "—"}
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className={`text-xs font-medium px-2 py-1 rounded ${flagInfo.className}`}>
                          {flagInfo.text}
                        </span>
                      </td>
                      <td className="py-2.5 pr-5 text-right">
                        {reading.photo_path && (
                          <a
                            href={`/api/photos/${reading.photo_path}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-ink-soft hover:text-ink"
                          >
                            <Camera className="w-3.5 h-3.5" strokeWidth={2} />
                            Photo
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </main>
  );
}
