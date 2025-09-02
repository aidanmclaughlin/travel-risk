import { IntradaySample, RunDetail } from './types';
import { floorToTenMinutesUTC, toDateStrUTC } from './date';
import { saveIntradaySample } from './store';

// Record a single intraday sample from a single run.
export async function recordIntradayFromRun(latest: RunDetail): Promise<IntradaySample> {
  const now = floorToTenMinutesUTC(new Date());
  const sample: IntradaySample = {
    date: toDateStrUTC(now),
    at: now.toISOString(),
    probability: latest?.probability ?? 0,
    report: latest?.report ?? '',
    citations: latest?.citations ?? [],
  };
  await saveIntradaySample(sample);
  return sample;
}

// Explicitly record a blank sample for this 10-minute bucket (e.g., when a run
// fails or is aborted). Probability is set to 0 and report/citations are empty.
export async function recordIntradayBlank(): Promise<IntradaySample> {
  const now = floorToTenMinutesUTC(new Date());
  const sample: IntradaySample = {
    date: toDateStrUTC(now),
    at: now.toISOString(),
    probability: 0,
    report: '',
    citations: [],
  };
  await saveIntradaySample(sample);
  return sample;
}
