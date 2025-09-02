#!/usr/bin/env node
// Danger: Deletes all blobs under a prefix (default: intraday/)
// Usage: BLOB_READ_WRITE_TOKEN=... node scripts/clear-blob.mjs [prefix]

import { list, del } from '@vercel/blob';

const token = process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_TOKEN;
if (!token) {
  console.error('Missing BLOB_READ_WRITE_TOKEN (or BLOB_READ_TOKEN) in env.');
  process.exit(1);
}

const prefix = process.argv[2] || 'intraday/';
if (!prefix || prefix === '/') {
  console.error('Refusing to clear without a safe prefix. Pass something like "intraday/"');
  process.exit(1);
}

async function main() {
  let total = 0;
  let cursor = undefined;
  do {
    const res = await list({ prefix, token, cursor });
    const { blobs } = res;
    for (const b of blobs) {
      await del(b.url, { token });
      total++;
      if (total % 25 === 0) process.stdout.write(`Deleted ${total}...\n`);
    }
    cursor = res.cursor;
  } while (cursor);
  console.log(`Done. Deleted ${total} object(s) under prefix "${prefix}".`);
}

main().catch((err) => { console.error(err); process.exit(1); });
