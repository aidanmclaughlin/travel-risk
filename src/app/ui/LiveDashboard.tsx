"use client";

import { useEffect, useMemo, useState } from "react";
import HistoryLine from "./HistoryLine";
import type { DailyResult } from "@/lib/types";

type ApiResp<T> = { ok: boolean; data: T };

export default function LiveDashboard({
  initialToday,
  initialHistory,
}: {
  initialToday: DailyResult | null;
  initialHistory: DailyResult[];
}) {
  const [today, setToday] = useState<DailyResult | null>(initialToday);
  const [history, setHistory] = useState<DailyResult[]>(initialHistory);
  const [loading, setLoading] = useState(false);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        setLoading(true);
        const [h, t] = await Promise.all([
          fetch("/api/history", { cache: "no-store" }).then((r) => r.json()) as Promise<ApiResp<DailyResult[]>>,
          fetch("/api/daily", { cache: "no-store" }).then((r) => r.json()) as Promise<ApiResp<DailyResult | null>>,
        ]);
        if (!cancelled) {
          if (h?.ok && Array.isArray(h.data)) setHistory(h.data);
          if (t?.ok) setToday(t.data);
        }
      } catch {}
      finally {
        if (!cancelled) setLoading(false);
      }
    };
    // initial small delay to allow SSR to paint
    const id = setInterval(poll, 30000);
    // one immediate refresh shortly after mount
    const once = setTimeout(poll, 1200);
    return () => { cancelled = true; clearInterval(id); clearTimeout(once); };
  }, []);

  const labels = useMemo(() => history.map((h) => h.date), [history]);
  const values = useMemo(() => history.map((h) => Math.round(h.average * 1000) / 10), [history]);
  const stds = useMemo(() => history.map((h) => Math.round(h.stddev * 1000) / 10), [history]);

  const avgPct = today ? Math.round((today.average || 0) * 1000) / 10 : null;
  const stdPct = today ? Math.round((today.stddev || 0) * 1000) / 10 : null;
  const runs = today?.runCount ?? null;

  return (
    <div className="space-y-6">
      <section className="p-4 sm:p-6 text-center">
        <div className="muted text-sm">Today</div>
        <div className="mt-1 text-6xl sm:text-7xl font-bold tracking-tight">
          {avgPct !== null ? (
            <span>
              {avgPct}%
              {typeof stdPct === "number" ? (
                <span className="text-2xl sm:text-3xl align-middle ml-3 text-gray-500">± {stdPct}%</span>
              ) : null}
            </span>
          ) : (
            <span className="opacity-60">—</span>
          )}
        </div>
        <div className="mt-3 text-xs text-gray-500 flex items-center justify-center gap-3">
          {today?.computedAt && <span>Updated {new Date(today.computedAt).toLocaleString()}</span>}
          {typeof runs === 'number' && <span>• Runs {runs}</span>}
        </div>
        <div className="mt-2 flex items-center justify-center gap-4">
          <a className="text-blue-600 hover:underline text-sm" href="/api/daily">View JSON</a>
          {today?.date && (
            <a className="text-blue-600 hover:underline text-sm" href={`/api/pdf?day=${today.date}`}>
              Download PDF
            </a>
          )}
          {today?.medianReport && (
            <button className="text-blue-600 hover:underline text-sm" onClick={() => setShowReport(true)}>
              Open report
            </button>
          )}
        </div>
      </section>

      <section className="p-1 sm:p-2 lg:p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm muted">Risk over time</div>
          <div className="text-xs text-gray-500">{loading ? "Refreshing…" : "Live"}</div>
        </div>
        <div className="h-[54vh] sm:h-[60vh]">
          <HistoryLine labels={labels} values={values} stds={stds} />
        </div>
      </section>

      {showReport && today?.medianReport && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowReport(false)} />
          <div className="absolute inset-x-0 bottom-0 sm:inset-0 sm:my-auto sm:max-w-3xl sm:mx-auto bg-white text-black rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden animate-[slide-up_250ms_ease-out]">
            <div className="p-5 sm:p-6 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">Median Report</h2>
              <button onClick={() => setShowReport(false)} className="text-sm text-blue-600 hover:underline">Close</button>
            </div>
            <div className="p-5 sm:p-6 max-h-[70vh] overflow-auto">
              <p className="leading-7 whitespace-pre-wrap">{today.medianReport}</p>
              {today.medianCitations?.length ? (
                <div className="pt-4">
                  <div className="muted text-sm pb-1">Citations</div>
                  <ul className="list-disc pl-6 space-y-1">
                    {today.medianCitations.map((c, i) => (
                      <li key={i}>
                        <a className="text-blue-600 hover:underline" href={c.url} target="_blank" rel="noreferrer">
                          {c.title || c.url}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
