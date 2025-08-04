import { NextRequest, NextResponse } from 'next/server';
import { deepResearchRisk } from '@/lib/openai';
import { loadDaily, saveDaily } from '@/lib/store';
import { DailyResult } from '@/lib/types';

export const runtime = 'nodejs';

function toDateStr(d: Date = new Date()): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('day') || toDateStr();
  const existing = await loadDaily(date);
  // Always aim for at least 25 runs
  const requestedCount = Number(searchParams.get('count') || '');
  let desired = Number.isFinite(requestedCount) ? Math.max(1, Math.min(25, Math.floor(requestedCount))) : 25;
  if (desired < 25) desired = 25;

  if (existing && existing.runCount >= desired) {
    const rest = (({ model: _m, ...r }) => r)(existing);
    return NextResponse.json({ ok: true, data: rest });
  }

  // Either compute fresh or top-up missing runs in parallel
  const baseEstimates = existing?.estimates ?? [];
  const missing = desired - (existing?.runCount ?? 0);

  const newRuns = await Promise.all(Array.from({ length: missing }, () => deepResearchRisk()));
  const estimates = [...baseEstimates, ...newRuns.map((r) => r.probability)];

  const runCount = estimates.length;
  const avg = estimates.reduce((a, b) => a + b, 0) / runCount;
  const sorted = [...estimates].sort((a, b) => a - b);
  const median = runCount % 2 === 1 ? sorted[(runCount - 1) / 2] : (sorted[runCount / 2 - 1] + sorted[runCount / 2]) / 2;
  const stddev = Math.sqrt(
    estimates.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / runCount
  );

  // Choose a report nearest to the median from only the new runs if none existed, otherwise prefer the closest overall
  let minIdx = -1;
  let minDelta = Number.POSITIVE_INFINITY;
  for (let i = 0; i < runCount; i++) {
    const d = Math.abs(estimates[i] - median);
    if (d < minDelta) {
      minDelta = d;
      minIdx = i;
    }
  }

  // Build citations aligned to indices; if an index came from existing but we don't have per-run reports stored, fall back to today's closest from new runs
  const newReportsOnly = newRuns.map(r => r.report);
  const newCitationsOnly = newRuns.map(r => r.citations);
  const reportForMedian = minIdx >= (existing?.runCount ?? 0) ? newReportsOnly[minIdx - (existing?.runCount ?? 0)] : (newReportsOnly[0] || existing?.medianReport || '');
  const citationsForMedian = minIdx >= (existing?.runCount ?? 0) ? newCitationsOnly[minIdx - (existing?.runCount ?? 0)] : (newCitationsOnly[0] || existing?.medianCitations || []);

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
  };

  await saveDaily(result);

  return NextResponse.json({ ok: true, data: result });
}
