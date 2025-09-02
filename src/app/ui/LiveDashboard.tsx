"use client";

import { useEffect, useMemo, useState } from "react";
import TimeSeriesLine from "./TimeSeriesLine";
import type { DailyResult, ApiResponse, IntradaySample } from "@/lib/types";
import Markdown from "./Markdown";

type ApiResp<T> = ApiResponse<T>;

export default function LiveDashboard({
  initialToday,
  initialIntraday,
}: {
  initialToday: DailyResult | null;
  initialIntraday: IntradaySample[];
}) {
  const [today, setToday] = useState<DailyResult | null>(initialToday);
  const [intraday, setIntraday] = useState<IntradaySample[]>(initialIntraday);
  // background refresh, but no visible indicator
  const [showReport, setShowReport] = useState(false);
  const [selectedSample, setSelectedSample] = useState<IntradaySample | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchWithTimeout = async <T,>(url: string, ms: number): Promise<T> => {
      const ctrl = new AbortController();
      const id = setTimeout(() => ctrl.abort(), ms);
      try {
        const res = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
        return (await res.json()) as T;
      } finally {
        clearTimeout(id);
      }
    };

    const poll = async () => {
      fetchWithTimeout<ApiResp<DailyResult | null>>("/api/daily", 15000)
        .then((t) => {
          if (!cancelled && t?.ok) setToday(t.data);
        })
        .catch(() => {});

      fetchWithTimeout<ApiResp<IntradaySample[]>>("/api/intraday", 8000)
        .then((s) => {
          if (!cancelled && s?.ok && Array.isArray(s.data)) setIntraday(s.data);
        })
        .catch(() => {});
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

  // Allow opening the report by a downward scroll gesture (shows current daily median)
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (!showReport && e.deltaY > 10) setShowReport(true);
    };
    window.addEventListener('wheel', onWheel, { passive: true });
    return () => window.removeEventListener('wheel', onWheel);
  }, [showReport]);

  const tsLabels = useMemo(() => intraday.map((s) => new Date(s.at).toISOString().slice(11,16)), [intraday]);
  // Use two-decimal precision so subtle changes are visible (e.g., 0.58%, 0.62%).
  const tsValues = useMemo(() => intraday.map((s) => Math.round(s.average * 10000) / 100), [intraday]);

  const avgPct = today ? Math.round((today.average || 0) * 10000) / 100 : null;
  const stdPct = today ? Math.round((today.stddev || 0) * 10000) / 100 : null;
  const runsUsed = today?.runCount ?? (Array.isArray(today?.estimates) ? today!.estimates.length : null);
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
            {updatedStr ? `Updated ${updatedStr}` : ''}
            {runsUsed != null ? (updatedStr ? ' • ' : '') + `Avg of ${runsUsed} run${runsUsed === 1 ? '' : 's'}` : ''}
          </div>
        </div>
      </div>

      <div className="relative h-[66vh]">
        <div className="absolute inset-0">
          {/* Intraday series (10-minute cadence) */}
          <TimeSeriesLine
            labels={tsLabels}
            values={tsValues}
            samples={intraday}
            onSampleClick={(s) => { setSelectedSample(s); setShowReport(true); }}
          />
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
            <span className="mt-0.5">Show latest report</span>
          </div>
        </button>
      </div>

      {showReport && (
        <div
          className="fixed inset-0 z-50"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => { setShowReport(false); setSelectedSample(null); }}
          />
          <div
            className="absolute inset-4 sm:inset-8 md:inset-10 flex items-center justify-center"
            onClick={() => { setShowReport(false); setSelectedSample(null); }}
          >
            <div
              className="surface-bg surface-border rounded-2xl shadow-2xl overflow-hidden animate-[pop-in_340ms_cubic-bezier(0.17,0.89,0.32,1.28)] w-full max-w-4xl"
              style={{ color: 'var(--foreground)', maxHeight: '85vh' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 sm:p-5 border-b flex items-center justify-between gap-3" style={{ borderColor: 'color-mix(in oklab, var(--foreground) 8%, transparent)', borderStyle: 'solid' }}>
                <h2 className="text-lg font-semibold flex items-center gap-3">
                  {selectedSample ? `Snapshot ${new Date(selectedSample.at).toLocaleString()}` : 'Median Report'}
                  {selectedSample && (
                    <span className="text-sm font-normal muted">Avg {Math.round(selectedSample.average * 10000) / 100}% • Med {Math.round(selectedSample.median * 10000) / 100}%</span>
                  )}
                </h2>
                <div className="flex items-center gap-2">
                  {today?.date && (
                    <a
                      href={`/api/pdf?day=${today?.date || ''}`}
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
                {selectedSample ? (
                  <>
                    <Markdown content={selectedSample.report || '*No report captured for this snapshot.*'} />
                    {(selectedSample.citations || []).length ? (
                      <div className="pt-4">
                        <div className="muted text-sm pb-1">Citations</div>
                        <ul className="list-disc pl-6 space-y-1">
                          {(selectedSample.citations || []).map((c, i) => (
                            <li key={i}>
                              <a className="hover:underline" style={{ color: 'var(--primary)' }} href={c.url} target="_blank" rel="noreferrer">
                                {c.title || c.url}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <>
                    <Markdown content={today?.medianReport || ''} />
                    {(today?.medianCitations || []).length ? (
                      <div className="pt-4">
                        <div className="muted text-sm pb-1">Citations</div>
                        <ul className="list-disc pl-6 space-y-1">
                          {(today?.medianCitations || []).map((c, i) => (
                            <li key={i}>
                              <a className="hover:underline" style={{ color: 'var(--primary)' }} href={c.url} target="_blank" rel="noreferrer">
                                {c.title || c.url}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </div>
          </div>
      )}
    </div>
  );
}
