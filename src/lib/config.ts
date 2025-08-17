// Centralized configuration for daily computation limits and defaults

function clamp(num: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, num));
}

export function targetRunsFromEnv(): number {
  const raw = Number(process.env.DAILY_TARGET_RUNS || '25');
  return clamp(Number.isFinite(raw) ? Math.floor(raw) : 25, 1, 50);
}

export function batchSizeFromEnv(): number {
  const raw = Number(process.env.DAILY_BATCH || '3');
  return clamp(Number.isFinite(raw) ? Math.floor(raw) : 3, 1, 10);
}

export function parseCountParam(input: string | null): number | null {
  if (!input) return null;
  const n = Number(input);
  if (!Number.isFinite(n)) return null;
  return clamp(Math.floor(n), 1, 50);
}

export function parseBatchParam(input: string | null): number | null {
  if (!input) return null;
  const n = Number(input);
  if (!Number.isFinite(n)) return null;
  return clamp(Math.floor(n), 1, 10);
}

