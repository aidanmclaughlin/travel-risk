import fs from 'node:fs/promises';
import path from 'node:path';
import { put, list } from '@vercel/blob';
import { DailyResult, RunDetail } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');
const DAILY_DIR = path.join(DATA_DIR, 'daily');

function blobEnabled(): boolean {
  // Only enable Blob when tokens are present (READ or READ_WRITE)
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_TOKEN);
}

function blobToken(): string | undefined {
  return process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_TOKEN;
}

async function ensureDir(): Promise<void> {
  if (blobEnabled()) return;
  try {
    await fs.mkdir(DAILY_DIR, { recursive: true });
  } catch {}
}

export async function saveDaily(result: DailyResult): Promise<void> {
  if (blobEnabled()) {
    const key = `daily/${result.date}.json`;
    await put(key, JSON.stringify(result, null, 2), {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'application/json; charset=utf-8',
      token: blobToken(),
    });
    return;
  }
  await ensureDir();
  const file = path.join(DAILY_DIR, `${result.date}.json`);
  await fs.writeFile(file, JSON.stringify(result, null, 2), 'utf8');
}

export async function loadDaily(date: string): Promise<DailyResult | null> {
  if (blobEnabled()) {
    const key = `daily/${date}.json`;
    const { blobs } = await list({ prefix: key, token: blobToken() });
    const found = blobs.find(b => b.pathname === key) || blobs[0];
    if (!found) return null;
    const res = await fetch(found.url, { cache: 'no-store' });
    if (!res.ok) return null;
    try {
      const json = await res.json();
      return json as DailyResult;
    } catch {
      return null;
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
  if (blobEnabled()) {
    const { blobs } = await list({ prefix: 'daily/', token: blobToken() });
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
  if (blobEnabled()) {
    const key = `daily/${date}/runs/${String(index).padStart(3, '0')}.json`;
    await put(key, JSON.stringify(run, null, 2), {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'application/json; charset=utf-8',
      token: blobToken(),
    });
    return;
  }
  await ensureDir();
  const runDir = path.join(DAILY_DIR, date, 'runs');
  try { await fs.mkdir(runDir, { recursive: true }); } catch {}
  const file = path.join(runDir, `${String(index).padStart(3, '0')}.json`);
  await fs.writeFile(file, JSON.stringify(run, null, 2), 'utf8');
}
