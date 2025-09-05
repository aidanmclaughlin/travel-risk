import { NextRequest, NextResponse } from 'next/server';
import { computeOneRun } from '@/lib/daily';
import { recordIntradayFromRun, recordIntradayBlank } from '@/lib/intraday';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET || '';
  const auth = req.headers.get('authorization');
  const url = new URL(req.url);
  const key = url.searchParams.get('key');
  const bearer = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const authorized = !!secret && (key === secret || bearer === secret);
  if (!authorized) {
    return NextResponse.json({ ok: false, error: 'unauthorized' });
  }
  try {
    // Exactly one run per tick → one intraday sample.
    const run = await computeOneRun();
    const sample = await recordIntradayFromRun(run);
    return NextResponse.json({ ok: true, data: { sample } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    // Log for investigation and still record a blank intraday sample so the
    // time series reflects that this tick produced no usable run.
    console.error('[tick] single-run tick failed:', message);
    try { await recordIntradayBlank(); } catch {}
    return NextResponse.json({ ok: false, error: message });
  }
}
