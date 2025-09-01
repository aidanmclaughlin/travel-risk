import { NextRequest, NextResponse } from 'next/server';
import { appendRuns } from '@/lib/daily';
import { toDateStrUTC } from '@/lib/date';
import { batchSizeFromEnv, parseBatchParam } from '@/lib/config';
import { recordIntradayFromDaily } from '@/lib/intraday';
import { stripModel } from '@/lib/sanitize';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('day') || toDateStrUTC();
    // Always append `batch` runs per tick; ignore any daily cap.
    const perReq = parseBatchParam(searchParams.get('batch')) ?? batchSizeFromEnv();
    const daily = await appendRuns(date, perReq);
    const sample = await recordIntradayFromDaily(daily);
    return NextResponse.json({ ok: true, data: { daily: stripModel(daily), sample } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message });
  }
}
