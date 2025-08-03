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
  if (existing) {
    return NextResponse.json({ ok: true, data: existing });
  }

  // Single run to de-risk cost/latency
  const runCount = 1;
  const estimates: number[] = [];
  const reports: string[] = [];
  const citationsList: { url: string; title?: string }[][] = [];

  for (let i = 0; i < runCount; i++) {
    const r = await deepResearchRisk();
    estimates.push(r.probability);
    reports.push(r.report);
    citationsList.push(r.citations);
  }

  const avg = estimates.reduce((a, b) => a + b, 0) / runCount;
  const sorted = [...estimates].sort((a, b) => a - b);
  const median = runCount % 2 === 1 ? sorted[(runCount - 1) / 2] : (sorted[runCount / 2 - 1] + sorted[runCount / 2]) / 2;
  const stddev = Math.sqrt(
    estimates.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / runCount
  );

  // Pick the report that is closest to the median
  let minIdx = 0;
  let minDelta = Number.POSITIVE_INFINITY;
  for (let i = 0; i < estimates.length; i++) {
    const d = Math.abs(estimates[i] - median);
    if (d < minDelta) {
      minDelta = d;
      minIdx = i;
    }
  }

  const result: DailyResult = {
    date,
    model: process.env.DR_MODEL || 'o3',
    runCount,
    average: avg,
    median,
    stddev,
    estimates,
    medianReport: reports[minIdx],
    medianCitations: citationsList[minIdx] || [],
    computedAt: new Date().toISOString(),
    destination: null,
  };

  await saveDaily(result);

  return NextResponse.json({ ok: true, data: result });
}
