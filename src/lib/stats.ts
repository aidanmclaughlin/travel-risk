import { RunDetail } from './types';

export type Stats = {
  average: number;
  median: number;
  stddev: number;
};

export function calcStats(values: number[]): Stats {
  const n = values.length || 1;
  const avg = values.reduce((a, b) => a + b, 0) / n;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const variance = values.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / n;
  const stddev = Math.sqrt(variance);
  return { average: avg, median, stddev };
}

export function pickNearestToMedian(values: number[], details: RunDetail[]): RunDetail | undefined {
  if (!values.length || !details.length) return undefined;
  const { median } = calcStats(values);
  let idx = -1;
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < values.length; i++) {
    const d = Math.abs(values[i] - median);
    if (d < best) { best = d; idx = i; }
  }
  return details[idx] ?? details[0];
}

