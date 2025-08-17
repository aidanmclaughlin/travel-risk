Daily Travel Risk — U.S. to Any Country
=======================================

A small, tasteful Vercel app that publishes a daily probability estimate for the risk that a U.S. non‑citizen traveler re‑entering within 30 days experiences an adverse border outcome (e.g., entry denial). Results are persisted per day, visualized over time, and exportable to PDF.

How it works
------------

- The backend runs one or more model calls per day — each run produces a probability, a markdown report, and citations. Aggregates (average/median/stddev) are computed from all runs.
- The app supports incremental top-ups: `/api/daily?count=25&batch=3` will add up to 3 runs per request until 25 total are stored for the day.
- Results are stored as JSON per day (`daily/YYYY-MM-DD.json`) and individual run artifacts under `daily/YYYY-MM-DD/runs/`.

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

Manual compute
--------------

- `GET /api/daily?day=YYYY-MM-DD&count=25&batch=3` — compute/top-up for a day.
- `GET /api/history` — list history for charts (sanitized: no model name).
- `GET /api/pdf?day=YYYY-MM-DD` — generate a PDF for the day.

Production and scheduling
-------------------------

On Vercel, add `OPENAI_API_KEY` as an Environment Variable. To compute the daily value automatically, we include a `vercel.json` cron that calls `/api/daily` once per day. You can customize the schedule/timezone.

```
{
  "crons": [
    { "path": "/api/daily", "schedule": "0 9 * * *" }
  ]
}
```

Notes on models
---------------

- Default `DR_MODEL` is `gpt-5`. To use a deep-research capable model, set `DR_MODEL` accordingly.
- `src/lib/openai.ts` enforces strict parsing of the model response and throws on schema violations.

Persistence notes
-----------------

- On Vercel, add the Vercel Blob storage integration (first‑party) to persist daily JSON files and PDFs across instances and deploys.
- The app stores per‑day JSON at `daily/YYYY-MM-DD.json`.
- In local development without Blob configured, the app falls back to writing JSON files under `./data`.

Development tips
----------------

- Start with `SIMULATE_DEEP_RESEARCH=true` to iterate on the UI quickly.
- Costs/latency: Deep Research is expensive and slow (tens of minutes for 25 runs). Schedule it with a cron and avoid computing on user requests.

PDF export
----------

- `GET /api/pdf?day=YYYY-MM-DD` returns a minimal PDF containing headline stats and the median report.

For Agents
----------

See `AGENTS.md` (root) plus guidance in `src/lib/AGENTS.md`, `src/app/api/AGENTS.md`, and `src/app/ui/AGENTS.md` for a quick tour of the codebase and conventions.
