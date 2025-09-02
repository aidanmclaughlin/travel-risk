import { DailyResult } from './types';

export type DailyPdfOptions = {
  // If provided, overrides computed percentage from DailyResult
  probabilityPct?: number;
};

export function generateDailyPdf(result: DailyResult, opts: DailyPdfOptions = {}): Uint8Array {
  const width = 612; // 8.5in
  const height = 792; // 11in
  const margin = 50;
  const fontSizeTitle = 18;
  const fontSizeBody = 12;
  const leading = 16;

  const probPct = opts.probabilityPct ?? Math.round(result.probability * 1000) / 10;

  function escapePdfText(s: string): string {
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
  lines.push(`Daily Travel Risk (U.S. Non-Citizens) — ${result.date}`);
  lines.push('');
  lines.push(`Probability: ${probPct}%`);
  lines.push('');
  lines.push('Report');
  lines.push('');
  for (const l of (result.report || '').split(/\n+/)) {
    for (const w of wrapText(l, maxChars)) lines.push(w);
  }
  if (result.citations?.length) {
    lines.push('');
    lines.push('Citations');
    lines.push('');
    for (const c of result.citations) {
      const label = `${c.title ? c.title + ' — ' : ''}${c.url}`;
      for (const w of wrapText('- ' + label, maxChars)) lines.push(w);
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

  const body = header + objects.join('');
  const xrefStart = body.length;
  const trailer = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
    xref.map((off) => `${String(off).padStart(10, '0')} 00000 n \n`).join('') +
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  const pdf = body + trailer;
  return new TextEncoder().encode(pdf);
}
