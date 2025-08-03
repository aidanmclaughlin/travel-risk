Daily Travel Risk — U.S. to Any Country
=======================================

A simple, beautiful Vercel app that publishes daily estimated statistics on how risky it is for U.S. non‑citizens to travel to other countries and re‑enter the U.S., given current visa/travel‑policy conditions.

How it works
------------

- The backend calls OpenAI's Deep Research Responses API (model: `o3-deep-research`) 25 independent times with strong prompt engineering and web search enabled.
- Each run returns a probability estimate (0–1) for risk of deportation/visa cancellation/entry denial upon return, plus a short report and citations.
- We compute:
  - Average probability across the 25 runs
  - Median probability and the corresponding “median” report
- Results are stored per‑day so the homepage can show today’s risk and a historical chart.

Important: Deep Research calls can take minutes. For production, schedule a daily background call (Vercel Cron) to pre‑compute results. The UI can also trigger a compute on demand.

Getting started
---------------

1) Prerequisites

- Node.js 18+ (Node 20+ recommended)
- An OpenAI API key with access to Deep Research models

2) Install dependencies

```
npm install
```

3) Configure environment

Create a `.env.local` in the project root:

```
OPENAI_API_KEY=sk-...
# Optional: simulate data in development (no API calls)
SIMULATE_DEEP_RESEARCH=false
# Note: app is hard‑coded to 25 runs for production fidelity
# Optional: where to store JSON history (defaults to ./data)
DATA_DIR=./data
# Optional: choose model (o3-deep-research or o4-mini-deep-research)
DR_MODEL=o3-deep-research
# Recommended: protect compute endpoint so only you (or Vercel Cron) can trigger it
COMPUTE_SECRET=your-strong-random-token
```

4) Run the dev server

```
npm run dev
```

Then open http://localhost:3000.

Manual compute (owner only)
---------------------------

Use your `COMPUTE_SECRET` to trigger a 25-run compute on demand:

- Browser: `https://your-domain.vercel.app/api/daily?compute=1&secret=YOUR_TOKEN`
- Local dev: `http://localhost:3000/api/daily?compute=1&secret=YOUR_TOKEN`
- cURL:

```
curl "https://your-domain.vercel.app/api/daily?compute=1&secret=YOUR_TOKEN"
```

Optional parameter:

- `day=YYYY-MM-DD` to compute for a specific date

Production and scheduling
-------------------------

On Vercel, add `OPENAI_API_KEY` as an Environment Variable. The daily compute endpoint `/api/daily?compute=1` is protected:

- Manual runs (owner only): call `/api/daily?compute=1&secret=YOUR_TOKEN` where `YOUR_TOKEN` matches `COMPUTE_SECRET`.
- Scheduled runs: Vercel Cron requests include the `x-vercel-cron: 1` header, which is allowed automatically, so you do not need to include the secret in the cron path.

We include a `vercel.json` example cron below. You can customize the schedule/timezone.

```
{
  "crons": [
    { "path": "/api/daily?compute=1", "schedule": "0 9 * * *" }
  ]
}
```

Notes on Deep Research
----------------------

- We use the Responses API with tools: `web_search_preview` and `code_interpreter` enabled.
- We request a strictly JSON primary output to make parsing robust; we still defensively extract a probability if needed.
- For long‑running background tasks, consider using `background: true` and webhooks. This sample keeps it simple and runs sequentially with a high timeout.

Persistence notes
-----------------

- The default storage saves JSON files under `DATA_DIR` (default `./data`).
- When deployed to Vercel serverless functions, filesystem writes are ephemeral and may not persist between runs. For durable storage, connect a database or KV store and adapt `src/lib/store.ts`.
  - For testing on Vercel, set `DATA_DIR=/tmp/travel-risk-data` and expect data to reset on cold starts.

Development tips
----------------

- Start with `SIMULATE_DEEP_RESEARCH=true` to iterate on the UI quickly.
- Costs/latency: Deep Research is expensive and slow (tens of minutes for 25 runs). Schedule it with a cron and avoid computing on user requests.

PDF export
----------

- Download a per‑day PDF (title, summary stats, median report, citations):
  - /api/pdf?day=YYYY-MM-DD (defaults to today)
  - The homepage provides a “Download full PDF (median report)” button when a day’s estimate exists.
