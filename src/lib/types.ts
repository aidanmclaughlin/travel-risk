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
};

export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// Intraday time series sample (10-minute cadence)
export type IntradaySample = {
  date: string; // YYYY-MM-DD (UTC)
  at: string; // ISO timestamp for sample moment (UTC)
  probability: number; // 0..1
  // Optional snapshot of the report at this moment
  report?: string;
  citations?: Citation[];
};
