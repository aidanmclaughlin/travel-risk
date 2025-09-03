import { NextRequest, NextResponse } from 'next/server';
import { listIntradayAll } from '@/lib/store';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  // Return the entire series across all days
  const data = await listIntradayAll();
  return NextResponse.json({ ok: true, data });
}
