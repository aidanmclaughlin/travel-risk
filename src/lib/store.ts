import fs from 'node:fs/promises';
import path from 'node:path';
import { DailyResult } from './types';

const DEFAULT_DIR = path.join(process.cwd(), 'data');
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : DEFAULT_DIR;

const KV_URL = process.env.KV_REST_API_URL || '';
const KV_TOKEN = process.env.KV_REST_API_TOKEN || '';
const USE_KV = Boolean(KV_URL && KV_TOKEN);

async function ensureDir(): Promise<void> {
  if (USE_KV) return;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {}
}

// KV helpers (Upstash/ Vercel KV REST API)
type KvResponse<T> = { result: T };

async function kvCmd<T>(command: string, ...args: string[]): Promise<T> {
  const res = await fetch(KV_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ command: [command, ...args] }),
    // no-cache to avoid stale
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`KV ${command} failed: ${res.status}`);
  const data = (await res.json()) as KvResponse<T>;
  return data.result;
}

async function kvGet(key: string): Promise<string | null> {
  try {
    const v = await kvCmd<string | null>('GET', key);
    return v ?? null;
  } catch {
    return null;
  }
}

async function kvSet(key: string, value: string): Promise<void> {
  await kvCmd<'OK'>('SET', key, value);
}

async function kvZAdd(key: string, score: number, member: string): Promise<number> {
  const added = await kvCmd<number>('ZADD', key, String(score), member);
  return added;
}

async function kvZRange(key: string, start: number, end: number): Promise<string[]> {
  const arr = await kvCmd<string[]>('ZRANGE', key, String(start), String(end));
  return Array.isArray(arr) ? arr : [];
}

function dateScore(d: string): number {
  return Number(d.replace(/-/g, ''));
}

export async function saveDaily(result: DailyResult): Promise<void> {
  if (USE_KV) {
    const key = `daily:${result.date}`;
    await kvSet(key, JSON.stringify(result));
    await kvZAdd('daily:index', dateScore(result.date), result.date);
    return;
    }
  await ensureDir();
  const file = path.join(DATA_DIR, `${result.date}.json`);
  await fs.writeFile(file, JSON.stringify(result, null, 2), 'utf8');
}

export async function loadDaily(date: string): Promise<DailyResult | null> {
  if (USE_KV) {
    const raw = await kvGet(`daily:${date}`);
    if (!raw) return null;
    try { return JSON.parse(raw) as DailyResult; } catch { return null; }
  }
  await ensureDir();
  const file = path.join(DATA_DIR, `${date}.json`);
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw) as DailyResult;
  } catch {
    return null;
  }
}

export async function listHistory(): Promise<DailyResult[]> {
  if (USE_KV) {
    const dates = await kvZRange('daily:index', 0, -1);
    const out: DailyResult[] = [];
    for (const d of dates) {
      const raw = await kvGet(`daily:${d}`);
      if (!raw) continue;
      try { out.push(JSON.parse(raw) as DailyResult); } catch {}
    }
    out.sort((a, b) => a.date.localeCompare(b.date));
    return out;
  }
  await ensureDir();
  const files = await fs.readdir(DATA_DIR);
  const results: DailyResult[] = [];
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    try {
      const raw = await fs.readFile(path.join(DATA_DIR, f), 'utf8');
      results.push(JSON.parse(raw) as DailyResult);
    } catch {
      // ignore bad files
    }
  }
  results.sort((a, b) => a.date.localeCompare(b.date));
  return results;
}
