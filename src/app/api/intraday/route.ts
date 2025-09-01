import { NextRequest, NextResponse } from 'next/server';
import { toDateStrUTC } from '@/lib/date';
import { listIntraday } from '@/lib/store';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('day') || toDateStrUTC();
  const data = await listIntraday(date);
  return NextResponse.json({ ok: true, data });
}

