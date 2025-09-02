// Date utilities normalized to UTC date strings (YYYY-MM-DD)

export function toDateStrUTC(d: Date = new Date()): string {
  // Normalize to midnight UTC and format as YYYY-MM-DD
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

// (No additional helpers; keep this file minimal.)

export function floorToTenMinutesUTC(d: Date = new Date()): Date {
  const ts = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), Math.floor(d.getUTCMinutes() / 10) * 10, 0, 0));
  return ts;
}
