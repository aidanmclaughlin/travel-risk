import { NextRequest, NextResponse } from 'next/server';
import { generateDailyPdf } from '@/lib/pdf';
import { toDateStrUTC } from '@/lib/date';
import { listIntraday } from '@/lib/store';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('day') || toDateStrUTC();
  const at = searchParams.get('at'); // optional HHmm
  const samples = await listIntraday(date);
  if (!samples.length) {
    return new NextResponse('No samples for requested date', { status: 404 });
  }
  let sample = samples[samples.length - 1];
  if (at && /^\d{4}$/.test(at)) {
    const match = samples.find((s) => {
      const hhmm = new Date(s.at);
      const hh = String(hhmm.getUTCHours()).padStart(2, '0');
      const mm = String(hhmm.getUTCMinutes()).padStart(2, '0');
      return `${hh}${mm}` === at;
    });
    if (match) sample = match;
  }
  const pdf = generateDailyPdf(sample);
  const headers = new Headers({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="travel-risk-${date}-${new Date(sample.at).toISOString().slice(11,16)}.pdf"`,
  });
  return new NextResponse(pdf, { status: 200, headers });
}
