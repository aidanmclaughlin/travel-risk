import { NextRequest, NextResponse } from 'next/server';
import { loadDaily } from '@/lib/store';
import { generateDailyPdf } from '@/lib/pdf';
import { ensureDailySnapshot } from '@/lib/daily';
import { toDateStrUTC } from '@/lib/date';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('day') || toDateStrUTC();
  const data = (await loadDaily(date)) ?? (await ensureDailySnapshot(date));

  const pdf = generateDailyPdf(data);
  const headers = new Headers({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="travel-risk-${date}.pdf"`,
  });
  return new NextResponse(pdf, { status: 200, headers });
}
