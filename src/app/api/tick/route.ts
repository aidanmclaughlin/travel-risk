import { NextRequest, NextResponse } from 'next/server';
import { computeOneRun, computeAndSaveDaily } from '@/lib/daily';
import { toDateStrUTC } from '@/lib/date';
import { recordIntradayFromRun, recordIntradayBlank } from '@/lib/intraday';
import { stripModel } from '@/lib/sanitize';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('day') || toDateStrUTC();
  try {
    // Exactly one run per tick → one intraday sample and a daily snapshot.
    const run = await computeOneRun();
    const sample = await recordIntradayFromRun(run);
    const daily = await computeAndSaveDaily(date, run);
    return NextResponse.json({ ok: true, data: { daily: stripModel(daily), sample } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    // Log for investigation and still record a blank intraday sample so the
    // time series reflects that this tick produced no usable run.
    console.error('[tick] single-run tick failed:', message);
    try { await recordIntradayBlank(); } catch {}
    return NextResponse.json({ ok: false, error: message });
  }
}
