#!/usr/bin/env node
// Inspect Vercel Blob intraday data
// Usage: BLOB_READ_TOKEN=... node scripts/inspect-blob.mjs [YYYY-MM-DD]

import { list } from '@vercel/blob';

const token = process.env.BLOB_READ_TOKEN || process.env.BLOB_READ_WRITE_TOKEN;
if (!token) {
  console.error('Missing BLOB_READ_TOKEN (or BLOB_READ_WRITE_TOKEN) in env.');
  process.exit(1);
}

const argDay = process.argv[2] || null;

async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
  return res.json();
}

function isIntradayFile(pathname) {
  return /intraday\/\d{4}-\d{2}-\d{2}\/\d{4}\.json$/.test(pathname);
}

function pad(n, w = 2) { return String(n).padStart(w, '0'); }

async function main() {
  const prefix = argDay ? `intraday/${argDay}/` : 'intraday/';
  const { blobs } = await list({ prefix, token });
  const files = blobs.filter(b => isIntradayFile(b.pathname)).sort((a,b) => a.pathname.localeCompare(b.pathname));
  if (files.length === 0) {
    console.log('No intraday JSON files found.');
    return;
  }
  const byDay = new Map();
  for (const f of files) {
    const parts = f.pathname.split('/');
    const day = parts[1];
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(f);
  }
  for (const [day, arr] of [...byDay.entries()].sort((a,b) => a[0].localeCompare(b[0]))) {
    const first = arr[0];
    const last = arr[arr.length - 1];
    const firstKey = first.pathname.split('/').pop().replace('.json','');
    const lastKey = last.pathname.split('/').pop().replace('.json','');
    console.log(`${day} — samples=${arr.length} (${firstKey}..${lastKey})`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
