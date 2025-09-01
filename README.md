Daily Travel Risk — U.S. to Any Country
=======================================

A tasteful Vercel app that publishes a probability estimate for the risk that a U.S. non‑citizen traveler re‑entering within 30 days experiences an adverse border outcome (e.g., entry denial). The app records a live time‑series every 10 minutes for the current day (UTC), in addition to keeping a per‑day summary and run artifacts. PDF export is available for each day.

How it works
------------

- Compute: Each run produces a probability, a Markdown report, and citations. Aggregates (average/median/stddev) are derived from all runs saved for a day.
- Top‑ups: The system adds up to `batch` new runs on each tick until `count` total runs exist for the day (default 25).
- Persistence:
  - Daily summary JSON: `daily/YYYY-MM-DD.json`
  - Per-run artifacts: `daily/YYYY-MM-DD/runs/NNN.json`
  - Intraday samples (10‑minute cadence): `intraday/YYYY-MM-DD/HHMM.json`
- Resilience:
  - Blob‑first writes (Vercel provides creds); local filesystem fallback only when Blob isn’t available.
  - Runs persist sequentially; missing daily summaries are auto‑reconstructed from run artifacts.

Important: Deep Research calls can take minutes. For production, schedule a daily background call (Vercel Cron) to pre‑compute results. The UI can also trigger a compute on demand.

Getting started
---------------

1) Prerequisites

- Node.js 18+ (Node 20+ recommended)
- An OpenAI API key

2) Install dependencies

```
npm install
```

3) Configure environment

Create a `.env.local` with at least:

```
OPENAI_API_KEY=sk-...
# Optional: choose a model. Default: gpt-5
DR_MODEL=gpt-5
# Optional: daily top-up defaults
DAILY_TARGET_RUNS=25
DAILY_BATCH=3
## For persistent storage on Vercel (recommended)
# Add Vercel Blob to the project (Storage tab) to auto-provision tokens
# Local dev falls back to ./data directory if Blob tokens are not present
```

4) Run the dev server

```
npm run dev
```

Then open http://localhost:3000.

Endpoints
---------

- `GET /api/tick?batch=1` — single “tick”: append up to `batch` new runs for today (or `day=`) regardless of any daily cap, then record an intraday sample.
- `GET /api/intraday?day=YYYY-MM-DD` — list intraday samples for a day.
- `GET /api/daily?day=YYYY-MM-DD&count&batch` — compute/top‑up for a day and return the (sanitized) daily summary.
- `GET /api/history` — list daily summaries (sanitized: no model name).
- `GET /api/pdf?day=YYYY-MM-DD` — generate a minimal PDF for the day.

Production and scheduling
-------------------------

On Vercel, set `OPENAI_API_KEY` and optionally `DR_MODEL`. The app ships with a cron that runs every 10 minutes to keep today’s runs topped‑up and record an intraday sample.

```
{
  "crons": [
    { "path": "/api/tick?count=25&batch=1", "schedule": "*/10 * * * *" }
  ]
}
```

Notes on models
---------------

- Default `DR_MODEL` is `gpt-5`. To use a deep-research capable model, set `DR_MODEL` accordingly.
- `src/lib/openai.ts` enforces strict parsing of the model response and throws on schema violations.

Persistence notes
-----------------

- Blob is used automatically on Vercel (tokens optional); local dev falls back to `./data`.
- Storage layout:
  - `daily/YYYY-MM-DD.json` (summary) + `daily/YYYY-MM-DD/runs/*` (artifacts)
  - `intraday/YYYY-MM-DD/HHMM.json` (10‑minute samples)

Development tips
----------------

- Runs can be slow; keep `batch=1` in production. Use `/api/tick` locally to simulate cron.
- To audit storage from your machine: `BLOB_READ_TOKEN=… node scripts/inspect-blob.mjs` and `node scripts/ls-blob.mjs intraday/<today>/`.

PDF export
----------

- `GET /api/pdf?day=YYYY-MM-DD` returns a minimal PDF containing headline stats and the median report.

For Agents
----------

See `AGENTS.md` (root) plus guidance in `src/lib/AGENTS.md` and `src/app/api/AGENTS.md`. The UI now renders the intraday line; daily CI bands have been removed.
