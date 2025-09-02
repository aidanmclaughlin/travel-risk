import { deepResearchRisk } from './openai';
import { RunDetail } from './types';

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

// This module previously handled daily snapshots. It's now just single-run compute helpers.
