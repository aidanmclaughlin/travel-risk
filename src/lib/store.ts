import fs from 'node:fs/promises';
import path from 'node:path';
import { DailyResult } from './types';

const DEFAULT_DIR = path.join(process.cwd(), 'data');
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : DEFAULT_DIR;

async function ensureDir(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {}
}

export async function saveDaily(result: DailyResult): Promise<void> {
  await ensureDir();
  const file = path.join(DATA_DIR, `${result.date}.json`);
  await fs.writeFile(file, JSON.stringify(result, null, 2), 'utf8');
}

export async function loadDaily(date: string): Promise<DailyResult | null> {
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
  // sort by date ascending
  results.sort((a, b) => a.date.localeCompare(b.date));
  return results;
}
