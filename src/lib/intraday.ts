import { DailyResult, IntradaySample } from './types';
import { floorToTenMinutesUTC, toDateStrUTC } from './date';
import { saveIntradaySample } from './store';

export async function recordIntradayFromDaily(d: DailyResult): Promise<IntradaySample> {
  const now = floorToTenMinutesUTC(new Date());
  const sample: IntradaySample = {
    date: toDateStrUTC(now),
    at: now.toISOString(),
    average: d.average,
    median: d.median,
    runCount: d.runCount,
    report: d.medianReport,
    citations: d.medianCitations,
  };
  await saveIntradaySample(sample);
  return sample;
}
