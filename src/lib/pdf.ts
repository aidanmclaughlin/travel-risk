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
  // Build multi-page content
  const maxChars = 88;
  const pages: string[][] = [];
  let cur: string[] = [];
  const pushPage = (s: string) => cur.push(s);
  const setColor = (rgb: readonly number[]) => pushPage(`${rgb[0]} ${rgb[1]} ${rgb[2]} rg`);
  const linesPerPage = Math.floor((height - margin * 2) / leading);
  let lineCount = 0;
  const beginPage = (withHeader: boolean) => {
    cur = [];
    pages.push(cur);
    pushPage('q'); setColor(col.bg); pushPage(`0 0 ${width} ${height} re f`); pushPage('Q');
    pushPage('BT');
    pushPage(`${margin} ${height - margin} Td`);
    pushPage(`${leading} TL`);
    setColor(col.text);
    pushPage(`/F1 ${body} Tf`);
    lineCount = 0;
    if (withHeader) {
      pushPage(`/F2 ${titleSize} Tf`);
      pushPage(`(${escape(`Travel Risk Snapshot — ${sample.date} @ ${new Date(sample.at).toISOString().slice(11,16)} UTC`)}) Tj`); pushPage('T*'); lineCount++;
      pushPage(`/F1 ${body} Tf`);
      setColor(col.muted);
      pushPage(`(${escape(`Probability: ${pct}%`)}) Tj`); pushPage('T*'); lineCount++;
      pushPage('T*'); lineCount++;
      setColor(col.accent);
      pushPage(`/F2 ${h2} Tf`);
      pushPage(`(${escape('Report')}) Tj`); pushPage('T*'); lineCount++;
      pushPage(`/F1 ${body} Tf`); setColor(col.text);
    }
  };
  const ensure = (n = 1) => { if (lineCount + n > linesPerPage) { pushPage('ET'); beginPage(false); } };
  const write = (txt: string, font: string = `/F1 ${body}`) => { ensure(1); pushPage(`${font} Tf`); pushPage(`(${escape(txt)}) Tj`); pushPage('T*'); lineCount++; };
  const blank = (n = 1) => { for (let i = 0; i < n; i++) { ensure(1); pushPage('T*'); lineCount++; } };

  beginPage(true);
  for (const b of blocks) {
    if (b.kind === 'h2') { blank(1); setColor(col.accent); for (const ln of wrap(b.text || '', maxChars)) write(ln, `/F2 ${h2}`); setColor(col.text); }
    else if (b.kind === 'p') { for (const ln of wrap(b.text || '', maxChars)) write(ln); blank(1); }
    else if (b.kind === 'quote') { setColor(col.muted); for (const ln of wrap(b.text || '', maxChars - 2)) write('> ' + ln); setColor(col.text); blank(1); }
    else if (b.kind === 'ul' && b.items) { for (const it of b.items) { const lines = wrap(it, maxChars - 4); write('- ' + lines[0]); for (let i = 1; i < lines.length; i++) write('  ' + lines[i]); } blank(1); }
    else if (b.kind === 'ol' && b.items) { let n = 1; for (const it of b.items) { const prefix = `${n}. `; n++; const lines = wrap(it, maxChars - prefix.length); write(prefix + lines[0]); for (let i = 1; i < lines.length; i++) write('   ' + lines[i]); } blank(1); }
    else if (b.kind === 'code') { for (const ln of (b.text || '').split(/\n/)) { for (const w of wrap(ln, maxChars)) write(w, `/F3 ${code}`); } }
    else if (b.kind === 'hr') { blank(1); }
  }
  pushPage('ET');

  // Assemble PDF objects with multiple pages
  const objects: string[] = [];
  const add = (s: string) => { const id = objects.length + 1; objects.push(`${id} 0 obj\n${s}\nendobj\n`); return id; };
  const reserve = () => { const id = objects.length + 1; objects.push(''); return id; };
  const setObj = (id: number, s: string) => { objects[id - 1] = `${id} 0 obj\n${s}\nendobj\n`; };
  const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const f3 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>');
  const contentIds: number[] = []; const pageIds: number[] = [];
  for (const p of pages) {
    const stream = p.join('\n');
    const bytes = new TextEncoder().encode(stream);
    const cid = add(`<< /Length ${bytes.length} >>\nstream\n${stream}\nendstream`);
    contentIds.push(cid);
    const pid = add(`<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${width} ${height}] /Contents ${cid} 0 R /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R /F3 ${f3} 0 R >> >> >>`);
    pageIds.push(pid);
  }
  const pagesId = reserve();
  setObj(pagesId, `<< /Type /Pages /Kids [${pageIds.map(id => id + ' 0 R').join(' ')}] /Count ${pageIds.length} >>`);
  const catalogId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  const header = '%PDF-1.4\n';
  const bodyStr = header + objects.join('');
  const offsets: number[] = []; let off = header.length;
  for (const obj of objects) { offsets.push(off); off += obj.length; }
  const xref = 'xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n' + offsets.map(o => `${String(o).padStart(10,'0')} 00000 n \n`).join('');
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${(bodyStr).length}\n%%EOF\n`;
  return new TextEncoder().encode(bodyStr + xref + trailer);
}
