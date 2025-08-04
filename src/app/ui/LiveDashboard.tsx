"use client";

import { useEffect, useMemo, useState } from "react";
import HistoryLine from "./HistoryLine";
import type { DailyResult } from "@/lib/types";
import Markdown from "./Markdown";

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
  // background refresh, but no visible indicator
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const [h, t] = await Promise.all([
          fetch("/api/history", { cache: "no-store" }).then((r) => r.json()) as Promise<ApiResp<DailyResult[]>>,
          fetch("/api/daily", { cache: "no-store" }).then((r) => r.json()) as Promise<ApiResp<DailyResult | null>>,
        ]);
        if (!cancelled) {
          if (h?.ok && Array.isArray(h.data)) setHistory(h.data);
          if (t?.ok) setToday(t.data);
        }
      } catch {}
    };
    // initial small delay to allow SSR to paint
    const id = setInterval(poll, 30000);
    // one immediate refresh shortly after mount
    const once = setTimeout(poll, 1200);
    return () => { cancelled = true; clearInterval(id); clearTimeout(once); };
  }, []);

  // Only Escape closes the report overlay
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && showReport) setShowReport(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showReport]);

  // Allow opening the report by a downward scroll gesture
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (!showReport && e.deltaY > 10) setShowReport(true);
    };
    window.addEventListener('wheel', onWheel, { passive: true });
    return () => window.removeEventListener('wheel', onWheel);
  }, [showReport]);

  const labels = useMemo(() => history.map((h) => h.date), [history]);
  const values = useMemo(() => history.map((h) => Math.round(h.average * 1000) / 10), [history]);
  const stds = useMemo(() => history.map((h) => Math.round(h.stddev * 1000) / 10), [history]);

  const avgPct = today ? Math.round((today.average || 0) * 1000) / 10 : null;
  const stdPct = today ? Math.round((today.stddev || 0) * 1000) / 10 : null;
  const runs = today?.runCount ?? null;
  const updatedStr = useMemo(() => {
    if (!today?.computedAt) return null;
    try { return new Date(today.computedAt).toLocaleString(); } catch { return today.computedAt; }
  }, [today?.computedAt]);

  const heat = (v: number | null) => {
    const x = v == null ? 0 : Math.max(0, Math.min(100, v));
    const hue = 120 - x * 1.2; // green -> red
    return `hsl(${hue}, 72%, 44%)`;
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="relative h-[34vh] flex items-center justify-center px-4 text-center">
        {/* removed live/updating indicator */}
        <div>
          <div className="uppercase tracking-wider muted text-xs sm:text-sm">Daily Travel Risk</div>
          <div className="font-extrabold leading-tight" style={{ color: heat(avgPct) }}>
            <span className="text-6xl sm:text-7xl md:text-8xl">{avgPct !== null ? `${avgPct}%` : '—'}</span>
            {typeof stdPct === 'number' && (
              <span className="ml-3 text-base sm:text-lg md:text-xl align-middle muted">± {stdPct}%</span>
            )}
          </div>
          <div className="mt-2 text-xs sm:text-sm muted">
            {updatedStr ? `Updated ${updatedStr}` : ''}{runs != null ? (updatedStr ? ' • ' : '') + `Runs ${runs}` : ''}
          </div>
        </div>
      </div>

      <div className="relative h-[66vh]">
        <div className="absolute inset-0">
          <HistoryLine labels={labels} values={values} stds={stds} />
        </div>
        <button
          aria-label="Open report"
          onClick={() => setShowReport(true)}
          className="absolute left-1/2 -translate-x-1/2 bottom-2 opacity-80 hover:opacity-100 transition-opacity"
        >
          <div className="flex flex-col items-center text-[10px] sm:text-xs muted">
            <svg className="animate-bounce-slow" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
            <span className="mt-0.5">Open report</span>
          </div>
        </button>
      </div>

      {showReport && today?.medianReport && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowReport(false)} />
          <div className="absolute inset-4 sm:inset-8 md:inset-10 flex items-center justify-center">
            <div className="surface-bg surface-border rounded-2xl shadow-2xl overflow-hidden animate-[pop-in_340ms_cubic-bezier(0.17,0.89,0.32,1.28)] w-full max-w-4xl" style={{ color: 'var(--foreground)', maxHeight: '85vh' }}>
              <div className="p-4 sm:p-5 border-b flex items-center justify-between gap-3" style={{ borderColor: 'color-mix(in oklab, var(--foreground) 8%, transparent)', borderStyle: 'solid' }}>
                <h2 className="text-lg font-semibold">Median Report</h2>
                <div className="flex items-center gap-2">
                  {today?.date && (
                    <a
                      href={`/api/pdf?day=${today.date}`}
                      aria-label="Download PDF"
                    className="inline-flex items-center justify-center w-8 h-8 rounded-md"
                    style={{ background: 'transparent' }}
                      title="Download PDF"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                    </a>
                  )}
                <button onClick={() => setShowReport(false)} className="inline-flex items-center justify-center w-8 h-8 rounded-md" aria-label="Close" style={{ background: 'transparent' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="p-5 sm:p-6 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 64px)' }}>
                <Markdown content={today.medianReport} />
                {today.medianCitations?.length ? (
                  <div className="pt-4">
                    <div className="muted text-sm pb-1">Citations</div>
                    <ul className="list-disc pl-6 space-y-1">
                    {today.medianCitations.map((c, i) => (
                      <li key={i}>
                        <a className="hover:underline" style={{ color: 'var(--primary)' }} href={c.url} target="_blank" rel="noreferrer">
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
          </div>
      )}
    </div>
  );
}
