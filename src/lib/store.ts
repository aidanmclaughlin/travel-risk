import fs from 'node:fs/promises';
import path from 'node:path';
import { put, list } from '@vercel/blob';
import { DailyResult, RunDetail } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');
const DAILY_DIR = path.join(DATA_DIR, 'daily');

// Prefer Vercel Blob in production. Tokens are optional on Vercel because the
// platform injects scoped credentials automatically; locally, tokens are needed.
function blobToken(): string | undefined {
  return process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_TOKEN;
}

async function tryBlobPut(key: string, body: string, contentType: string): Promise<boolean> {
  try {
    await put(key, body, {
      access: 'public',
      addRandomSuffix: false,
      contentType,
      // Passing token is optional on Vercel; required locally if you have one.
      token: blobToken(),
    });
    return true;
  } catch {
    return false;
  }
}

async function tryBlobList(prefix: string) {
  try {
    return await list({ prefix, token: blobToken() });
  } catch {
    return null;
  }
}

async function ensureDir(): Promise<void> {
  // Only used for local fallback
  try {
    await fs.mkdir(DAILY_DIR, { recursive: true });
  } catch {}
}

export async function saveDaily(result: DailyResult): Promise<void> {
  // Try Blob first; if it fails (e.g., no tokens in local dev), write to disk.
  const key = `daily/${result.date}.json`;
  const ok = await tryBlobPut(key, JSON.stringify(result, null, 2), 'application/json; charset=utf-8');
  if (ok) return;
  await ensureDir();
  const file = path.join(DAILY_DIR, `${result.date}.json`);
  await fs.writeFile(file, JSON.stringify(result, null, 2), 'utf8');
}

export async function loadDaily(date: string): Promise<DailyResult | null> {
  // Prefer Blob; gracefully fall back to local if unavailable.
  const key = `daily/${date}.json`;
  const listed = await tryBlobList(key);
  if (listed) {
    const { blobs } = listed;
    const found = blobs.find(b => b.pathname === key) || blobs[0];
    if (found) {
      const res = await fetch(found.url, { cache: 'no-store' });
      if (res.ok) {
        try { return (await res.json()) as DailyResult; } catch {}
      }
    }
  }
  await ensureDir();
  const file = path.join(DAILY_DIR, `${date}.json`);
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw) as DailyResult;
  } catch {
    return null;
  }
}

export async function listHistory(): Promise<DailyResult[]> {
  // Try Blob first
  const listed = await tryBlobList('daily/');
  if (listed) {
    const { blobs } = listed;
    const jsons: DailyResult[] = [];
    for (const b of blobs) {
      // Only include top-level daily files like daily/YYYY-MM-DD.json, skip nested runs
      if (!b.pathname.endsWith('.json')) continue;
      const parts = b.pathname.split('/');
      if (parts.length !== 2) continue; // skip anything under subdirectories (e.g., runs)
      const res = await fetch(b.url, { cache: 'no-store' });
      if (!res.ok) continue;
      try {
        const j = await res.json();
        if (j && typeof j.date === 'string') jsons.push(j as DailyResult);
      } catch {}
    }
    jsons.sort((a, b) => a.date.localeCompare(b.date));
    return jsons;
  }
  await ensureDir();
  const files = await fs.readdir(DAILY_DIR);
  const results: DailyResult[] = [];
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    try {
      const raw = await fs.readFile(path.join(DAILY_DIR, f), 'utf8');
      results.push(JSON.parse(raw) as DailyResult);
    } catch {}
  }
  results.sort((a, b) => a.date.localeCompare(b.date));
  return results;
}

export async function saveDailyRun(date: string, index: number, run: RunDetail): Promise<void> {
  const key = `daily/${date}/runs/${String(index).padStart(3, '0')}.json`;
  const ok = await tryBlobPut(key, JSON.stringify(run, null, 2), 'application/json; charset=utf-8');
  if (ok) return;
  await ensureDir();
  const runDir = path.join(DAILY_DIR, date, 'runs');
  try { await fs.mkdir(runDir, { recursive: true }); } catch {}
  const file = path.join(runDir, `${String(index).padStart(3, '0')}.json`);
  await fs.writeFile(file, JSON.stringify(run, null, 2), 'utf8');
}
