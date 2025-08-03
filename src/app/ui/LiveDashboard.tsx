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
  const [touchStartY, setTouchStartY] = useState<number | null>(null);

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

  // Gesture to open report overlay on scroll or swipe down
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY > 12 && !showReport) setShowReport(true);
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'PageDown' || e.key === 'ArrowDown' || e.key === ' ') && !showReport) setShowReport(true);
      if (e.key === 'Escape' && showReport) setShowReport(false);
    };
    const onTouchStart = (e: TouchEvent) => setTouchStartY(e.touches[0]?.clientY ?? null);
    const onTouchMove = (e: TouchEvent) => {
      if (touchStartY == null) return;
      const dy = (e.touches[0]?.clientY ?? touchStartY) - touchStartY;
      if (dy < -18 && !showReport) setShowReport(true);
    };
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('keydown', onKey);
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
    };
  }, [showReport, touchStartY]);

  const labels = useMemo(() => history.map((h) => h.date), [history]);
  const values = useMemo(() => history.map((h) => Math.round(h.average * 1000) / 10), [history]);
  const stds = useMemo(() => history.map((h) => Math.round(h.stddev * 1000) / 10), [history]);

  const avgPct = today ? Math.round((today.average || 0) * 1000) / 10 : null;
  const stdPct = today ? Math.round((today.stddev || 0) * 1000) / 10 : null;
  const runs = today?.runCount ?? null;

  return (
    <div className="space-y-4 overflow-hidden">
      <section className="px-2 sm:px-4 text-center">
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
        <div className="mt-2 text-xs text-gray-500 flex items-center justify-center gap-3">
          {today?.computedAt && <span>Updated {new Date(today.computedAt).toLocaleString()}</span>}
          {typeof runs === 'number' && <span>• Runs {runs}</span>}
        </div>
      </section>

      <section className="px-1 sm:px-2 lg:px-3">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm muted">Risk over time</div>
          <div className="text-xs text-gray-500">{loading ? "Refreshing…" : "Live"}</div>
        </div>
        <div className="h-[58dvh] sm:h-[60dvh] lg:h-[62dvh]">
          <HistoryLine labels={labels} values={values} stds={stds} />
        </div>
      </section>

      {showReport && today?.medianReport && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowReport(false)} />
          <div className="absolute inset-x-0 bottom-0 sm:inset-0 sm:my-auto sm:max-w-3xl sm:mx-auto bg-white text-black rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden animate-[pop-in_340ms_cubic-bezier(0.17,0.89,0.32,1.28)]">
            <div className="p-4 sm:p-5 border-b flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Median Report</h2>
              <div className="flex items-center gap-2">
                {today?.date && (
                  <a
                    href={`/api/pdf?day=${today.date}`}
                    aria-label="Download PDF"
                    className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-gray-100"
                    title="Download PDF"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  </a>
                )}
                <button onClick={() => setShowReport(false)} className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-gray-100" aria-label="Close">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
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
