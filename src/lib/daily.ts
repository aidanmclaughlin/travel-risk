import { deepResearchRisk } from './openai';
import { loadDaily, saveDaily } from './store';
import { DailyResult, RunDetail } from './types';

// Compute exactly one run and return a RunDetail.
export async function computeOneRun(): Promise<RunDetail> {
  const r = await deepResearchRisk();
  return {
    probability: r.probability,
    report: r.report,
    citations: r.citations,
    computedAt: new Date().toISOString(),
  };
}

// Persist a single-run daily snapshot for the given date.
export async function computeAndSaveDaily(date: string, run?: RunDetail): Promise<DailyResult> {
  const actualRun = run ?? await computeOneRun();
  const result: DailyResult = {
    date,
    model: process.env.DR_MODEL || '',
    probability: actualRun.probability,
    report: actualRun.report,
    citations: actualRun.citations,
    computedAt: actualRun.computedAt,
    destination: null,
  };
  await saveDaily(result);
  return result;
}

// Load the daily snapshot if present; otherwise compute one and persist.
export async function ensureDailySnapshot(date: string): Promise<DailyResult> {
  const existing = await loadDaily(date);
  if (existing) return existing;
  return await computeAndSaveDaily(date);
}
