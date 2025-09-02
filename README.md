Daily Travel Risk — U.S. to Any Country
=======================================

A tasteful Vercel app that publishes a probability estimate for the risk that a U.S. non‑citizen traveler re‑entering within 30 days experiences an adverse border outcome (e.g., entry denial). The app records a live time‑series every 10 minutes (UTC). Storage consists solely of these intraday snapshots. PDF export is available for any snapshot.

How it works
------------

- Compute: Each run produces a probability, a Markdown report, and citations. There is exactly one run per data point.
- Cadence: A scheduler hits `/api/tick` every 10 minutes to create one new intraday sample.
- Persistence: Intraday samples (10‑minute cadence) only: `intraday/YYYY-MM-DD/HHMM.json`
- Resilience:
  - Blob‑first writes (Vercel provides creds); local filesystem fallback only when Blob isn’t available.
  - No daily rollups are stored; everything is derived from intraday samples.

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

- `GET /api/tick` — single “tick”: compute one run and record an intraday sample.
- `GET /api/intraday?day=YYYY-MM-DD` — list intraday samples for a day.
- `GET /api/pdf?day=YYYY-MM-DD&at=HHmm` — generate a minimal PDF for a specific intraday snapshot (defaults to latest when `at` omitted).

UI
--

- The home page renders an intraday line chart of the single-run probability (%) over time for the current UTC day.
- Gridlines and axis tick labels are hidden for a cleaner look.
- Each point is annotated with a small rounded label: `HH:MM • value%`.
- Clicking a point opens the snapshot report and citations captured at that moment.

Production and scheduling
-------------------------

On Vercel, set `OPENAI_API_KEY` and optionally `DR_MODEL`. The app ships with a cron that runs every 10 minutes to record one new intraday sample.

```
{
  "crons": [
    { "path": "/api/tick", "schedule": "*/10 * * * *" }
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
  - `intraday/YYYY-MM-DD/HHMM.json` (10‑minute samples only)

Development tips
----------------

- Runs can be slow; use `/api/tick` locally to simulate the 10‑minute cron.
- To audit storage from your machine: `BLOB_READ_TOKEN=… node scripts/inspect-blob.mjs` and `node scripts/ls-blob.mjs intraday/<today>/`.

PDF export
----------

- `GET /api/pdf?day=YYYY-MM-DD&at=HHmm` returns a minimal PDF containing the snapshot’s probability and report.

For Agents
----------

See `AGENTS.md` (root) plus guidance in `src/lib/AGENTS.md` and `src/app/api/AGENTS.md`. The UI now renders the intraday line; daily CI bands have been removed.
