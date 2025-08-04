import { NextResponse } from 'next/server';
import { listHistory } from '@/lib/store';

export const runtime = 'nodejs';

export async function GET() {
  const history = await listHistory();
  // Omit model name entirely from API output
  const sanitized = history.map((h) => (({ model: _m, ...r }) => r)(h));
  return NextResponse.json({ ok: true, data: sanitized });
}
