"use client";

import { useEffect, useMemo, useState } from "react";
import TimeSeriesLine from "./TimeSeriesLine";
import type { ApiResponse, IntradaySample } from "@/lib/types";
import Markdown from "./Markdown";

type ApiResp<T> = ApiResponse<T>;

export default function LiveDashboard({
  initialLatest,
  initialIntraday,
}: {
  initialLatest: IntradaySample | null;
  initialIntraday: IntradaySample[];
}) {
  const [intraday, setIntraday] = useState<IntradaySample[]>(initialIntraday);
  const [latest, setLatest] = useState<IntradaySample | null>(initialLatest);
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
      fetchWithTimeout<ApiResp<IntradaySample[]>>("/api/intraday", 8000)
        .then((s) => {
          if (!cancelled && s?.ok && Array.isArray(s.data)) {
            setIntraday(s.data);
            if (s.data.length) setLatest(s.data[s.data.length - 1]);
          }
        })
        .catch(() => {});
    };
    const id = setInterval(poll, 30000);
    const once = setTimeout(poll, 1200);
    return () => { cancelled = true; clearInterval(id); clearTimeout(once); };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && showReport) setShowReport(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showReport]);

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (!showReport && e.deltaY > 10) setShowReport(true);
    };
    window.addEventListener('wheel', onWheel, { passive: true });
    return () => window.removeEventListener('wheel', onWheel);
  }, [showReport]);

  const tsLabels = useMemo(() => intraday.map((s) => new Date(s.at).toISOString().slice(11,16)), [intraday]);
  // Use two-decimal precision so subtle changes are visible (e.g., 0.58%, 0.62%).
  const tsValues = useMemo(() => intraday.map((s) => Math.round(s.probability * 10000) / 100), [intraday]);

  const pct = latest ? Math.round((latest.probability || 0) * 10000) / 100 : null;
  const updatedStr = useMemo(() => {
    if (!latest?.at) return null;
    try { return new Date(latest.at).toLocaleString(); } catch { return latest.at; }
  }, [latest?.at]);

  const heat = (v: number | null) => {
    const x = v == null ? 0 : Math.max(0, Math.min(100, v));
    const hue = 120 - x * 1.2; // green -> red
    return `hsl(${hue}, 72%, 44%)`;
  };

  const [showInfo, setShowInfo] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      <div className="relative h-[34vh] flex items-center justify-center px-4 text-center">
        {/* removed live/updating indicator */}
        <div>
          <div className="uppercase tracking-wider muted text-xs sm:text-sm">Travel Risk</div>
          <div className="font-extrabold leading-tight" style={{ color: heat(pct) }}>
            <span className="text-6xl sm:text-7xl md:text-8xl">{pct !== null ? `${pct}%` : '—'}</span>
          </div>
          <div className="mt-2 text-xs sm:text-sm muted inline-flex items-center gap-1 relative">
            {updatedStr ? `Updated ${updatedStr}` : ''}
            <button
              aria-label="About this project"
              onClick={() => setShowInfo(v => !v)}
              className="inline-flex items-center justify-center w-4 h-4 rounded-full"
              title="About"
              style={{ background: 'color-mix(in oklab, var(--foreground) 12%, transparent)', color: 'var(--foreground)' }}
            >
              <span style={{ fontSize: 10, lineHeight: 1 }}>i</span>
            </button>
            {showInfo && (
              <div className="absolute left-1/2 -translate-x-1/2 mt-7 z-10 surface-bg surface-border rounded-md shadow-xl p-3 text-left w-[min(92vw,520px)]" role="dialog" aria-modal="false">
                <div className="text-sm" style={{ color: 'var(--foreground)' }}>
                  <p>
                    This dashboard tracks a single probability that a typical U.S. non‑citizen traveler attempting re‑entry within 30 days encounters an adverse border outcome.
                  </p>
                  <p className="mt-2">
                    Every 10 minutes, the system runs a short research prompt via <strong>GPT‑5</strong> to produce a percent estimate, a brief report, and citations. No legal advice; treat the figure as an analytical signal.
                  </p>
                  <p className="mt-2">
                    Contribute on GitHub: <a href="https://github.com/aidanmclaughlin/travel-risk" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'var(--primary)' }}>aidanmclaughlin/travel-risk</a>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="relative h-[66vh]">
        <div className="absolute inset-0">
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
                  {selectedSample ? `Snapshot ${new Date(selectedSample.at).toLocaleString()}` : 'Report'}
                </h2>
                <div className="flex items-center gap-2">
                  {latest?.date && (
                    <a
                      href={`/api/pdf?day=${latest?.date || ''}&at=${new Date(latest.at).toISOString().slice(11,16).replace(':','')}`}
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
                              <a className="hover:underline" style={{ color: 'var(--primary)' }} href={c.url} target="_blank" rel="noopener noreferrer">
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
                    <Markdown content={latest?.report || ''} />
                    {(latest?.citations || []).length ? (
                      <div className="pt-4">
                        <div className="muted text-sm pb-1">Citations</div>
                        <ul className="list-disc pl-6 space-y-1">
                          {(latest?.citations || []).map((c, i) => (
                            <li key={i}>
                              <a className="hover:underline" style={{ color: 'var(--primary)' }} href={c.url} target="_blank" rel="noopener noreferrer">
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
