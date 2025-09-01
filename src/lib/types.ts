export type Citation = {
  url: string;
  title?: string;
};

export type SingleEstimate = {
  probability: number; // 0..1
  report: string;
  citations: Citation[];
};

export type RunDetail = {
  probability: number; // 0..1
  report: string;
  citations: Citation[];
  computedAt: string; // ISO timestamp
  model?: string;
};

export type DailyResult = {
  date: string; // YYYY-MM-DD
  model: string;
  runCount: number;
  average: number; // 0..1
  median: number; // 0..1
  stddev: number; // 0..1
  estimates: number[]; // length = runCount
  medianReport: string;
  medianCitations: Citation[];
  computedAt: string; // ISO timestamp
  destination?: string | null;
  runsDetailed?: RunDetail[]; // optional: all per-run details
};

export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// Intraday time series sample (10-minute cadence)
export type IntradaySample = {
  date: string; // YYYY-MM-DD (UTC)
  at: string; // ISO timestamp for sample moment (UTC)
  average: number; // 0..1
  median: number; // 0..1
  runCount: number;
};
