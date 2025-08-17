// Date utilities normalized to UTC date strings (YYYY-MM-DD)

export function toDateStrUTC(d: Date = new Date()): string {
  // Normalize to midnight UTC and format as YYYY-MM-DD
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

export function parseDateStrUTC(s: string): Date | null {
  // Expect YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

