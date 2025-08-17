import { NextResponse } from 'next/server';
import { listHistory } from '@/lib/store';
import { stripModel } from '@/lib/sanitize';

export const runtime = 'nodejs';

export async function GET() {
  const history = await listHistory();
  // Omit model name entirely from API output
  const sanitized = history.map(stripModel);
  return NextResponse.json({ ok: true, data: sanitized });
}
