import { IntradaySample } from './types';

export type DailyPdfOptions = { probabilityPct?: number };

export function generateDailyPdf(sample: IntradaySample, opts: DailyPdfOptions = {}): Uint8Array {
  const width = 612, height = 792, margin = 48;
  const titleSize = 18, h2 = 14, body = 11, code = 10, leading = 16;
  const pct = opts.probabilityPct ?? Math.round((sample.probability || 0) * 1000) / 10;

  const col = {
    bg: [0.043, 0.071, 0.133],
    text: [0.9, 0.92, 0.95],
    muted: [0.72, 0.78, 0.86],
    accent: [0.655, 0.545, 0.98],
    codeBg: [0.12, 0.16, 0.24],
  } as const;

  const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

  function wrap(text: string, max: number): string[] {
    const out: string[] = [];
    let line = '';
    for (const w of text.split(/\s+/)) {
      const t = line ? line + ' ' + w : w;
      if (t.length > max) {
        if (line) out.push(line);
        if (w.length > max) {
          for (let i = 0; i < w.length; i += max) out.push(w.slice(i, i + max));
          line = '';
        } else {
          line = w;
        }
      } else line = t;
    }
    if (line) out.push(line);
    return out;
  }

  type Block = { kind: 'h2'|'p'|'ul'|'ol'|'code'|'quote'|'hr'; text?: string; items?: string[] };

  function mdToBlocks(md: string): Block[] {
    const lines = (md || '').split(/\r?\n/);
    const blocks: Block[] = [];
    let buf: string[] = [];
    let inCode = false;
    let codeBuf: string[] = [];
    let listType: 'ul'|'ol'|null = null; let listItems: string[] = [];
    const flushPara = () => { if (buf.length) { blocks.push({ kind: 'p', text: buf.join(' ') }); buf = []; } };
    const flushList = () => { if (listType && listItems.length) { blocks.push({ kind: listType, items: listItems.slice() }); listItems = []; listType = null; } };
    for (const raw of lines) {
      const line = raw.replace(/\s+$/,'');
      if (/^```/.test(line)) { if (inCode) { blocks.push({ kind: 'code', text: codeBuf.join('\n') }); codeBuf=[]; inCode=false; } else { flushPara(); flushList(); inCode=true; } continue; }
      if (inCode) { codeBuf.push(line); continue; }
      if (!line.trim()) { flushPara(); flushList(); continue; }
      const h = line.match(/^(#{1,3})\s+(.*)$/); if (h) { flushPara(); flushList(); blocks.push({ kind:'h2', text: h[2] }); continue; }
      const mUl = line.match(/^[-*]\s+(.*)$/); if (mUl) { flushPara(); if (listType && listType!== 'ul') flushList(); listType='ul'; listItems.push(mUl[1]); continue; }
      const mOl = line.match(/^\d+\.\s+(.*)$/); if (mOl) { flushPara(); if (listType && listType!== 'ol') flushList(); listType='ol'; listItems.push(mOl[1]); continue; }
      if (/^>\s+/.test(line)) { flushPara(); flushList(); blocks.push({ kind:'quote', text: line.replace(/^>\s+/, '') }); continue; }
      if (/^(-{3,}|\*{3,})$/.test(line.trim())) { flushPara(); flushList(); blocks.push({ kind:'hr' }); continue; }
      buf.push(line);
    }
    flushPara(); flushList(); if (inCode) blocks.push({ kind:'code', text: codeBuf.join('\n') });
    return blocks;
  }

  const blocks = mdToBlocks(sample.report || '');
  const content: string[] = [];
  const push = (s: string) => content.push(s);
  const setColor = (rgb: readonly number[]) => push(`${rgb[0]} ${rgb[1]} ${rgb[2]} rg`);

  // Background
  push('q');
  push(`${col.bg[0]} ${col.bg[1]} ${col.bg[2]} rg`);
  push(`0 0 ${width} ${height} re f`);
  push('Q');

  // Text
  push('BT');
  push(`${margin} ${height - margin} Td`);
  push(`${leading} TL`);
  setColor(col.text);
  push(`/F2 ${titleSize} Tf`);
  push(`(${escape(`Travel Risk Snapshot — ${sample.date} @ ${new Date(sample.at).toISOString().slice(11,16)} UTC`)}) Tj`);
  push('T*');
  push(`/F1 ${body} Tf`);
  setColor(col.muted);
  push(`(${escape(`Probability: ${pct}%`)}) Tj`);
  push('T*');
  push('T*');
  setColor(col.accent);
  push(`/F2 ${h2} Tf`);
  push(`(${escape('Report')}) Tj`);
  push('T*');
  push(`/F1 ${body} Tf`);
  setColor(col.text);

  const maxChars = 88;
  for (const b of blocks) {
    if (b.kind === 'h2') {
      push('T*'); setColor(col.accent); push(`/F2 ${h2} Tf`);
      for (const ln of wrap(b.text || '', maxChars)) { push(`(${escape(ln)}) Tj`); push('T*'); }
      push(`/F1 ${body} Tf`); setColor(col.text);
    } else if (b.kind === 'p') {
      for (const ln of wrap(b.text || '', maxChars)) { push(`(${escape(ln)}) Tj`); push('T*'); }
      push('T*');
    } else if (b.kind === 'quote') {
      setColor(col.muted);
      for (const ln of wrap(b.text || '', maxChars - 2)) { push(`(${escape('» ' + ln)}) Tj`); push('T*'); }
      setColor(col.text);
      push('T*');
    } else if (b.kind === 'ul' && b.items) {
      for (const it of b.items) {
        const lines = wrap(it, maxChars - 4);
        push(`(${escape('• ' + lines[0])}) Tj`); push('T*');
        for (let i = 1; i < lines.length; i++) { push(`(${escape('  ' + lines[i])}) Tj`); push('T*'); }
      }
      push('T*');
    } else if (b.kind === 'ol' && b.items) {
      let n = 1;
      for (const it of b.items) {
        const prefix = `${n}. `; n++;
        const lines = wrap(it, maxChars - prefix.length);
        push(`(${escape(prefix + lines[0])}) Tj`); push('T*');
        for (let i = 1; i < lines.length; i++) { push(`(${escape('   ' + lines[i])}) Tj`); push('T*'); }
      }
      push('T*');
    } else if (b.kind === 'code') {
      push('ET');
      push('q');
      push(`${col.codeBg[0]} ${col.codeBg[1]} ${col.codeBg[2]} rg`);
      push(`${margin - 6} ${height - margin - 4} ${width - margin*2 + 12} 18 re f`); // small cap line; not exact but adequate
      push('Q');
      push('BT');
      push(`${margin} ${height - margin} Td`);
      push(`${leading} TL`);
      setColor(col.text);
      push(`/F3 ${code} Tf`);
      for (const ln of (b.text || '').split(/\n/)) { for (const w of wrap(ln, maxChars)) { push(`(${escape(w)}) Tj`); push('T*'); } }
      push(`/F1 ${body} Tf`);
    } else if (b.kind === 'hr') {
      push('ET');
      push('q');
      push(`${col.muted[0]} ${col.muted[1]} ${col.muted[2]} RG`);
      push(`${margin} ${height - margin - 2} ${width - margin*2} 0.5 re S`);
      push('Q');
      push('BT');
      push(`${margin} ${height - margin} Td`);
      push(`${leading} TL`);
    }
  }
  push('ET');

  const stream = content.join('\n');
  const bytes = new TextEncoder().encode(stream);
  const objects: string[] = []; const xref: number[] = [];
  const add = (obj: string) => { xref.push(objects.join('').length + header.length); objects.push(obj); };
  const header = '%PDF-1.4\n';
  add('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  add('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  add(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R /F3 7 0 R >> >> >>\nendobj\n`);
  add(`4 0 obj\n<< /Length ${bytes.length} >>\nstream\n${stream}\nendstream\nendobj\n`);
  add('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');
  add('6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n');
  add('7 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n');
  const bodyStr = header + objects.join('');
  const xrefStart = bodyStr.length;
  const trailer = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` + xref.map((off) => `${String(off).padStart(10, '0')} 00000 n \n`).join('') + `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return new TextEncoder().encode(bodyStr + trailer);
}
