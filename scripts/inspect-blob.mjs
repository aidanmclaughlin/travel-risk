#!/usr/bin/env node
// Inspect Vercel Blob daily data and runs
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

function isTopLevelDaily(pathname) {
  if (!pathname.endsWith('.json')) return false;
  const parts = pathname.split('/');
  return parts.length === 2 && parts[0] === 'daily';
}

function dayFromPath(pathname) {
  return pathname.split('/')[1].replace(/\.json$/, '');
}

function pad(n, w = 2) { return String(n).padStart(w, '0'); }

async function main() {
  const dailyPrefix = argDay ? `daily/${argDay}` : 'daily/';
  const { blobs } = await list({ prefix: dailyPrefix, token });
  const dailyFiles = blobs.filter(b => isTopLevelDaily(b.pathname));
  if (dailyFiles.length === 0) {
    console.log('No daily JSON files found.');
    return;
  }
  // Sort by date
  dailyFiles.sort((a, b) => dayFromPath(a.pathname).localeCompare(dayFromPath(b.pathname)));

  for (const file of dailyFiles) {
    const day = dayFromPath(file.pathname);
    const data = await fetchJson(file.url);
    const runDirPrefix = `daily/${day}/runs/`;
    const runsList = await list({ prefix: runDirPrefix, token });
    const runFiles = runsList.blobs.filter(b => b.pathname.startsWith(runDirPrefix));
    const runs = runFiles.length;
    const runCount = data.runCount ?? (Array.isArray(data.estimates) ? data.estimates.length : null);
    const estLen = Array.isArray(data.estimates) ? data.estimates.length : 0;
    const ok = runCount === estLen && runCount === runs;
    console.log(`${day} — runCount=${runCount}, estimates=${estLen}, runs=${runs} ${ok ? '✓' : '⚠'}`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });

