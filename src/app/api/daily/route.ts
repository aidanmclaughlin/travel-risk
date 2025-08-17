import { NextRequest, NextResponse } from 'next/server';
import { deepResearchRisk } from '@/lib/openai';
import { loadDaily, saveDaily, saveDailyRun } from '@/lib/store';
import { DailyResult, RunDetail } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60; // avoid timeouts; keep runs small per request

function toDateStr(d: Date = new Date()): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('day') || toDateStr();
    const existing = await loadDaily(date);
  // Target total runs and per-request cap for incremental top-ups
  const requestedCount = Number(searchParams.get('count') || '');
  const goal = Number.isFinite(requestedCount)
    ? Math.max(1, Math.min(50, Math.floor(requestedCount)))
    : Math.max(1, Math.min(50, Number(process.env.DAILY_TARGET_RUNS || '25')));
  const perReq = Math.max(1, Math.min(10, Number(searchParams.get('batch') || process.env.DAILY_BATCH || '3')));

    if (existing && existing.runCount >= goal) {
      const { model: _m, ...rest } = existing;
      void _m;
      return NextResponse.json({ ok: true, data: rest });
    }

  // Either compute fresh or top-up missing runs in a small batch to avoid timeouts
  const baseEstimates = existing?.estimates ?? [];
  const missing = goal - (existing?.runCount ?? 0);
  const toRun = Math.max(0, Math.min(perReq, missing));
  if (toRun <= 0) {
    // If nothing to run, existing must be present and already at/above goal
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'No work to run but existing result missing' });
    }
    const { model: _m, ...rest } = existing as DailyResult;
    void _m;
    return NextResponse.json({ ok: true, data: rest });
  }

  const newRuns = await Promise.all(Array.from({ length: toRun }, () => deepResearchRisk()));
  const estimates = [...baseEstimates, ...newRuns.map((r) => r.probability)];

  // Persist each new run as its own artifact and aggregate detailed runs
  const existingDetails: RunDetail[] = (existing as DailyResult | undefined)?.runsDetailed ?? [];
  const offset = existing?.runCount ?? 0;
  const newDetails: RunDetail[] = newRuns.map((r) => ({
    probability: r.probability,
    report: r.report,
    citations: r.citations,
    computedAt: new Date().toISOString(),
  }));
  await Promise.all(newDetails.map((run, i) => saveDailyRun(date, offset + i, run)));
  const allDetails: RunDetail[] = [...existingDetails, ...newDetails];

  const runCount = estimates.length;
  const avg = estimates.reduce((a, b) => a + b, 0) / runCount;
  const sorted = [...estimates].sort((a, b) => a - b);
  const median = runCount % 2 === 1 ? sorted[(runCount - 1) / 2] : (sorted[runCount / 2 - 1] + sorted[runCount / 2]) / 2;
  const stddev = Math.sqrt(
    estimates.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / runCount
  );

  // Choose the run nearest to the median across all runs and use its report/citations
  let minIdx = -1;
  let minDelta = Number.POSITIVE_INFINITY;
  for (let i = 0; i < runCount; i++) {
    const d = Math.abs(estimates[i] - median);
    if (d < minDelta) { minDelta = d; minIdx = i; }
  }
  const chosen = allDetails[minIdx] ?? newDetails[0] ?? existingDetails[0];
  const reportForMedian = chosen?.report || '';
  const citationsForMedian = chosen?.citations || [];

  const result: DailyResult = {
    date,
    model: '',
    runCount,
    average: avg,
    median,
    stddev,
    estimates,
    medianReport: reportForMedian,
    medianCitations: citationsForMedian,
    computedAt: new Date().toISOString(),
    destination: null,
    runsDetailed: allDetails,
  };

    await saveDaily(result);

    return NextResponse.json({ ok: true, data: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    // Return structured error for easier diagnosis while keeping 200 to avoid opaque 500s.
    return NextResponse.json({ ok: false, error: message });
  }
}
