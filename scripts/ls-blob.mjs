#!/usr/bin/env node
// List all blob pathnames under a prefix (default: intraday/)
// Usage: BLOB_READ_TOKEN=... node scripts/ls-blob.mjs [prefix]

import { list } from '@vercel/blob';

const token = process.env.BLOB_READ_TOKEN || process.env.BLOB_READ_WRITE_TOKEN;
if (!token) {
  console.error('Missing BLOB_READ_TOKEN (or BLOB_READ_WRITE_TOKEN) in env.');
  process.exit(1);
}

const prefix = process.argv[2] || 'intraday/';

async function main() {
  let cursor;
  let count = 0;
  do {
    const { blobs, cursor: next } = await list({ prefix, token, cursor });
    for (const b of blobs) {
      console.log(b.pathname);
      count++;
    }
    cursor = next;
  } while (cursor);
  if (!count) console.log('(no objects)');
}

main().catch((err) => { console.error(err); process.exit(1); });
