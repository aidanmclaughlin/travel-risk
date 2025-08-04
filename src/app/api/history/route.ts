import { NextResponse } from 'next/server';
import { listHistory } from '@/lib/store';

export const runtime = 'nodejs';

export async function GET() {
  const history = await listHistory();
  // Redact model to avoid exposing unreleased model names
  const redacted = history.map((h) => ({ ...h, model: 'private' }));
  return NextResponse.json({ ok: true, data: redacted });
}
