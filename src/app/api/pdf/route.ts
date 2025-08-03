import { NextRequest, NextResponse } from 'next/server';
import { loadDaily } from '@/lib/store';
import { deepResearchRisk } from '@/lib/openai';

export const runtime = 'nodejs';

function toDateStr(d: Date = new Date()): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('day') || toDateStr();
  const compute = searchParams.get('compute') === '1';
  const secret = process.env.COMPUTE_SECRET;
  const suppliedSecret = searchParams.get('secret');

  let data = await loadDaily(date);
  if (!data && compute) {
    const devNoSecret = process.env.NODE_ENV !== 'production' && !secret;
    const secretOk = !!secret && suppliedSecret === secret;
    if (!secretOk && !devNoSecret) {
      return NextResponse.json({ ok: false, error: 'Unauthorized. Provide ?secret=...' }, { status: 401 });
    }
    const run = await deepResearchRisk();
    data = {
      date,
      model: process.env.DR_MODEL || 'o3',
      runCount: 1,
      average: run.probability,
      median: run.probability,
      stddev: 0,
      estimates: [run.probability],
      medianReport: run.report,
      medianCitations: run.citations,
      computedAt: new Date().toISOString(),
      destination: null,
    };
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: 'No data found for this date' }, { status: 404 });
  }

  const pdf = generatePdf({
    date: data.date,
    averagePct: Math.round(data.average * 1000) / 10,
    medianPct: Math.round(data.median * 1000) / 10,
    stddevPct: Math.round(data.stddev * 1000) / 10,
    runs: data.runCount,
    model: data.model,
    report: data.medianReport,
    citations: data.medianCitations?.map((c) => `${c.title ? c.title + ' — ' : ''}${c.url}`) || [],
  });

  const headers = new Headers({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="travel-risk-${date}.pdf"`,
  });
  return new NextResponse(pdf, { status: 200, headers });
}

function generatePdf(opts: {
  date: string;
  averagePct: number;
  medianPct: number;
  stddevPct: number;
  runs: number;
  model: string;
  report: string;
  citations: string[];
}): Uint8Array {
  const width = 612; // 8.5in
  const height = 792; // 11in
  const margin = 50;
  const fontSizeTitle = 18;
  const fontSizeBody = 12;
  const leading = 16;

  function escapePdfText(s: string) {
    return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }

  function wrapText(text: string, maxWidthChars: number): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
      const tentative = line ? line + ' ' + w : w;
      if (tentative.length > maxWidthChars) {
        if (line) lines.push(line);
        line = w;
      } else {
        line = tentative;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  const lines: string[] = [];
  const maxChars = 90; // rough width
  lines.push(`Daily Travel Risk (U.S. Non-Citizens) — ${opts.date}`);
  lines.push('');
  lines.push(`Model: ${opts.model} • Runs: ${opts.runs}`);
  lines.push(`Average: ${opts.averagePct}% • Median: ${opts.medianPct}% • Std Dev: ${opts.stddevPct}%`);
  lines.push('');
  lines.push('Median Report');
  lines.push('');
  for (const l of opts.report.split(/\n+/)) {
    for (const w of wrapText(l, maxChars)) lines.push(w);
  }
  if (opts.citations.length) {
    lines.push('');
    lines.push('Citations');
    lines.push('');
    for (const c of opts.citations) {
      for (const w of wrapText('- ' + c, maxChars)) lines.push(w);
    }
  }

  const y = height - margin;
  const content: string[] = [];
  content.push('BT');
  content.push(`/F1 ${fontSizeTitle} Tf`);
  content.push(`${margin} ${y} Td`);
  content.push(`${leading} TL`);
  // Title
  content.push(`(${escapePdfText(lines[0] || '')}) Tj`);
  content.push('T*');
  content.push('T*');
  // Body
  content.push(`/F1 ${fontSizeBody} Tf`);
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) {
      content.push('T*');
      continue;
    }
    content.push(`(${escapePdfText(line)}) Tj`);
    content.push('T*');
  }
  content.push('ET');

  const stream = content.join('\n');
  const streamBytes = new TextEncoder().encode(stream);
  const objects: string[] = [];
  const xref: number[] = [];

  function addObject(obj: string): void {
    xref.push(objects.join('').length + header.length);
    objects.push(obj);
  }

  const header = '%PDF-1.4\n';
  addObject('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  addObject('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  addObject(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n`);
  addObject(`4 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n${stream}\nendstream\nendobj\n`);
  addObject('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');

  const xrefStart = objects.join('').length + header.length;
  const xrefTable: string[] = [];
  xrefTable.push('xref');
  xrefTable.push('0 6');
  xrefTable.push('0000000000 65535 f ');
  for (const off of xref) {
    const s = String(off).padStart(10, '0') + ' 00000 n ';
    xrefTable.push(s);
  }
  const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  const pdfStr = header + objects.join('') + xrefTable.join('\n') + '\n' + trailer;
  return new TextEncoder().encode(pdfStr);
}
