import { NextRequest, NextResponse } from 'next/server';
import { loadDaily } from '@/lib/store';
import { generateDailyPdf } from '@/lib/pdf';
import { ensureDailyWithGoal } from '@/lib/daily';
import { toDateStrUTC } from '@/lib/date';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('day') || toDateStrUTC();
  const data = (await loadDaily(date)) ?? (await ensureDailyWithGoal({ date, goalRuns: 1, perRequestCap: 1 }));

  const pdf = generateDailyPdf(data);
  const headers = new Headers({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="travel-risk-${date}.pdf"`,
  });
  return new NextResponse(pdf, { status: 200, headers });
}
