import { deepResearchRisk } from './openai';
import { loadDaily, saveDaily, saveDailyRun, listRunDetails } from './store';
import { DailyResult, RunDetail } from './types';
import { calcStats, pickNearestToMedian } from './stats';

export type EnsureParams = {
  date: string;
  goalRuns: number; // desired total runs across all batches
  perRequestCap: number; // maximum runs to compute in this invocation
};

export async function ensureDailyWithGoal({ date, goalRuns, perRequestCap }: EnsureParams): Promise<DailyResult> {
  const existing = await loadDaily(date);
  // Treat stored run artifacts as the source of truth; this also repairs prior partial writes.
  const existingDetails: RunDetail[] = await listRunDetails(date);
  const baseEstimates = existingDetails.map(r => r.probability);
  const missing = goalRuns - baseEstimates.length;
  const toRun = Math.max(0, Math.min(perRequestCap, missing));

  // If no work to do and we have existing, return existing
  if (toRun <= 0 && existing) {
    return existing as DailyResult;
  }

  // Compute additional runs sequentially and persist after each to survive timeouts
  const allDetails: RunDetail[] = [...existingDetails];
  let offset = existingDetails.length;
  for (let i = 0; i < toRun; i++) {
    const r = await deepResearchRisk();
    const run: RunDetail = {
      probability: r.probability,
      report: r.report,
      citations: r.citations,
      computedAt: new Date().toISOString(),
    };
    await saveDailyRun(date, offset, run);
    allDetails.push(run);
    offset += 1;
  }

  const estimates = allDetails.map(r => r.probability);
  const runCount = estimates.length;
  const { average, median, stddev } = calcStats(estimates);

  const chosen = pickNearestToMedian(estimates, allDetails);

  const result: DailyResult = {
    date,
    model: existing?.model ?? (process.env.DR_MODEL || ''),
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

// Append exactly `howMany` runs regardless of any target goal. Returns the updated DailyResult.
export async function appendRuns(date: string, howMany: number): Promise<DailyResult> {
  const existing = await loadDaily(date);
  const existingDetails: RunDetail[] = await listRunDetails(date);
  const allDetails: RunDetail[] = [...existingDetails];
  let offset = existingDetails.length;
  const n = Math.max(0, Math.floor(howMany));
  for (let i = 0; i < n; i++) {
    const r = await deepResearchRisk();
    const run: RunDetail = {
      probability: r.probability,
      report: r.report,
      citations: r.citations,
      computedAt: new Date().toISOString(),
    };
    await saveDailyRun(date, offset, run);
    allDetails.push(run);
    offset += 1;
  }

  const estimates = allDetails.map(r => r.probability);
  const runCount = estimates.length;
  const { average, median, stddev } = calcStats(estimates);
  const chosen = pickNearestToMedian(estimates, allDetails);
  const result: DailyResult = {
    date,
    model: existing?.model ?? (process.env.DR_MODEL || ''),
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
