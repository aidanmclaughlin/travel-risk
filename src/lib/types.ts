export type Citation = {
  url: string;
  title?: string;
};

export type SingleEstimate = {
  probability: number; // 0..1
  report: string;
  citations: Citation[];
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
};

