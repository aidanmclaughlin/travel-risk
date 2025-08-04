import { NextResponse } from 'next/server';
import { listHistory } from '@/lib/store';

export const runtime = 'nodejs';

export async function GET() {
  const history = await listHistory();
  // Omit model name entirely from API output
  const sanitized = history.map((h) => {
    const { model: _m, ...rest } = h;
    void _m;
    return rest;
  });
  return NextResponse.json({ ok: true, data: sanitized });
}
