import { NextResponse } from 'next/server';
import { listHistory } from '@/lib/store';

export const runtime = 'nodejs';

export async function GET() {
  const history = await listHistory();
  return NextResponse.json({ ok: true, data: history });
}

