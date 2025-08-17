import { NextRequest, NextResponse } from 'next/server';
import { ensureDailyWithGoal } from '@/lib/daily';
import { toDateStrUTC } from '@/lib/date';
import { batchSizeFromEnv, parseBatchParam, parseCountParam, targetRunsFromEnv } from '@/lib/config';
import { DailyResult } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60; // avoid timeouts; keep runs small per request

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('day') || toDateStrUTC();
    const goal = parseCountParam(searchParams.get('count')) ?? targetRunsFromEnv();
    const perReq = parseBatchParam(searchParams.get('batch')) ?? batchSizeFromEnv();

    const computed = await ensureDailyWithGoal({ date, goalRuns: goal, perRequestCap: perReq });
    // Sanitize: do not expose model name in API payloads
    const { model: _m, ...rest } = computed as DailyResult;
    void _m;
    return NextResponse.json({ ok: true, data: rest });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    // Return structured error for easier diagnosis while keeping 200 to avoid opaque 500s.
    return NextResponse.json({ ok: false, error: message });
  }
}
