import fs from 'node:fs/promises';
import path from 'node:path';
import { put, list } from '@vercel/blob';
import { IntradaySample } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');
const INTRADAY_DIR = path.join(DATA_DIR, 'intraday');

function blobToken(): string | undefined {
  return process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_TOKEN;
}

async function tryBlobPut(key: string, body: string, contentType: string): Promise<boolean> {
  try {
    await put(key, body, {
      access: 'public',
      addRandomSuffix: false,
      contentType,
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
  try {
    await fs.mkdir(INTRADAY_DIR, { recursive: true });
  } catch {}
}


export async function saveIntradaySample(sample: IntradaySample): Promise<void> {
  const d = sample.date;
  const at = new Date(sample.at);
  const hh = String(at.getUTCHours()).padStart(2, '0');
  const mm = String(at.getUTCMinutes()).padStart(2, '0');
  const key = `intraday/${d}/${hh}${mm}.json`;
  const ok = await tryBlobPut(key, JSON.stringify(sample, null, 2), 'application/json; charset=utf-8');
  if (ok) return;
  await ensureDir();
  const dir = path.join(INTRADAY_DIR, d);
  try { await fs.mkdir(dir, { recursive: true }); } catch {}
  const file = path.join(dir, `${hh}${mm}.json`);
  await fs.writeFile(file, JSON.stringify(sample, null, 2), 'utf8');
}

export async function listIntraday(date: string): Promise<IntradaySample[]> {
  const prefix = `intraday/${date}/`;
  const listed = await tryBlobList(prefix);
  const out: IntradaySample[] = [];
  if (listed) {
    const { blobs } = listed;
    const files = blobs
      .filter(b => b.pathname.startsWith(prefix) && b.pathname.endsWith('.json'))
      .sort((a, b) => a.pathname.localeCompare(b.pathname));
    // Fetch JSONs in parallel for speed on days with many samples
    const results = await Promise.all(
      files.map(async (f) => {
        try {
          const res = await fetch(f.url, { cache: 'no-store' });
          if (!res.ok) return null;
          return (await res.json()) as IntradaySample;
        } catch {
          return null;
        }
      })
    );
    for (const r of results) if (r) out.push(r);
    return out;
  }
  await ensureDir();
  try {
    const dir = path.join(INTRADAY_DIR, date);
    const files = (await fs.readdir(dir)).filter(f => f.endsWith('.json')).sort();
    for (const f of files) {
      try { const raw = await fs.readFile(path.join(dir, f), 'utf8'); out.push(JSON.parse(raw) as IntradaySample); } catch {}
    }
  } catch {}
  return out;
}
