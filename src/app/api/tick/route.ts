import { NextRequest, NextResponse } from 'next/server';
import { ensureDailyWithGoal } from '@/lib/daily';
import { toDateStrUTC } from '@/lib/date';
import { batchSizeFromEnv, parseBatchParam, parseCountParam, targetRunsFromEnv } from '@/lib/config';
import { recordIntradayFromDaily } from '@/lib/intraday';
import { stripModel } from '@/lib/sanitize';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('day') || toDateStrUTC();
    const goal = parseCountParam(searchParams.get('count')) ?? targetRunsFromEnv();
    const perReq = parseBatchParam(searchParams.get('batch')) ?? batchSizeFromEnv();

    const daily = await ensureDailyWithGoal({ date, goalRuns: goal, perRequestCap: perReq });
    const sample = await recordIntradayFromDaily(daily);
    return NextResponse.json({ ok: true, data: { daily: stripModel(daily), sample } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message });
  }
}

