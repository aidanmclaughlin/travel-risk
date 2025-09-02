import { NextRequest, NextResponse } from 'next/server';
import { ensureDailySnapshot } from '@/lib/daily';
import { toDateStrUTC } from '@/lib/date';
import { stripModel } from '@/lib/sanitize';

export const runtime = 'nodejs';
// Deep-research runs are slow; allow up to 300s per invocation.
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('day') || toDateStrUTC();
    const computed = await ensureDailySnapshot(date);
    // Sanitize: do not expose model name in API payloads
    return NextResponse.json({ ok: true, data: stripModel(computed) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    // Return structured error for easier diagnosis while keeping 200 to avoid opaque 500s.
    return NextResponse.json({ ok: false, error: message });
  }
}
