import { deepResearchRisk } from './openai';
import { loadDaily, saveDaily, saveDailyRun } from './store';
import { DailyResult, RunDetail } from './types';
import { calcStats, pickNearestToMedian } from './stats';

export type EnsureParams = {
  date: string;
  goalRuns: number; // desired total runs across all batches
  perRequestCap: number; // maximum runs to compute in this invocation
};

export async function ensureDailyWithGoal({ date, goalRuns, perRequestCap }: EnsureParams): Promise<DailyResult> {
  const existing = await loadDaily(date);
  const baseEstimates = existing?.estimates ?? [];
  const existingDetails: RunDetail[] = (existing as DailyResult | undefined)?.runsDetailed ?? [];
  const missing = goalRuns - (existing?.runCount ?? 0);
  const toRun = Math.max(0, Math.min(perRequestCap, missing));

  // If no work to do and we have existing, return existing
  if (toRun <= 0 && existing) {
    return existing as DailyResult;
  }

  // Compute additional runs
  const newRuns = await Promise.all(Array.from({ length: toRun }, () => deepResearchRisk()));
  const newDetails: RunDetail[] = newRuns.map((r) => ({
    probability: r.probability,
    report: r.report,
    citations: r.citations,
    computedAt: new Date().toISOString(),
  }));

  // Persist each run artifact
  const offset = existing?.runCount ?? 0;
  await Promise.all(newDetails.map((run, i) => saveDailyRun(date, offset + i, run)));

  const allDetails: RunDetail[] = [...existingDetails, ...newDetails];
  const estimates = [...baseEstimates, ...newDetails.map((r) => r.probability)];
  const runCount = estimates.length;
  const { average, median, stddev } = calcStats(estimates);

  const chosen = pickNearestToMedian(estimates, allDetails);

  const result: DailyResult = {
    date,
    model: existing?.model ?? '',
    runCount,
    average,
    median,
    stddev,
    estimates,
    medianReport: chosen?.report || existing?.medianReport || '',
    medianCitations: chosen?.citations || existing?.medianCitations || [],
    computedAt: new Date().toISOString(),
    destination: existing?.destination ?? null,
    runsDetailed: allDetails,
  };

  await saveDaily(result);
  return result;
}

