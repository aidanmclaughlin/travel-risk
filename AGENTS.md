# Travel Risk — Agent Guide (Intraday‑Only)

This document explains the project end‑to‑end so another agent (or human) can safely reason about, modify, and operate the system. It reflects the current “intraday‑only” architecture: the product persists a single datapoint every 10 minutes and nothing else. There are no daily rollups or multi‑run aggregates anymore.

---

## Goals

- Publish a conservative probability (0–1) for adverse U.S. border outcomes for typical non‑citizen travelers attempting re‑entry within 30 days.
- Persist exactly one record per 10‑minute bucket (UTC) with the probability, a Markdown report, and citations.
- Render a tasteful UI that shows the latest headline value and an intraday line chart.
- Provide a PDF export of the latest (or any chosen) intraday snapshot.

Non‑goals: daily averages, medians, confidence intervals, multiple runs per point.

---

## Repository Quick Map

- `src/app`
  - `page.tsx`: Server component; fetches today’s intraday series and passes to the live dashboard.
  - `layout.tsx`, `globals.css`: App shell and theme.
  - `ui/LiveDashboard.tsx`: Client component for the headline, chart, and report overlay.
  - `ui/TimeSeriesLine.tsx`: Chart.js line rendering; hover tooltip shows percent + datetime.
  - `ui/Markdown.tsx`: Small, defensive Markdown renderer for reports.
  - `api/intraday/route.ts`: Lists intraday samples for a day.
  - `api/tick/route.ts`: Performs one compute, records one intraday sample.
  - `api/pdf/route.ts`: Produces a minimal PDF for the requested (or latest) intraday sample.
- `src/lib`
  - `openai.ts`: `deepResearchRisk()` — strict OpenAI call returning `{ probability, report, citations }`.
  - `daily.ts`: `computeOneRun()` — one LLM run to produce a single datapoint.
  - `intraday.ts`: `recordIntradayFromRun()`, `recordIntradayBlank()` — save intraday snapshots.
  - `store.ts`: Blob‑first persistence with local filesystem fallback under `./data/intraday`.
  - `date.ts`: UTC helpers (`toDateStrUTC`, `floorToTenMinutesUTC`).
  - `pdf.ts`: Minimal, dependency‑free PDF generator from an intraday sample.
  - `types.ts`: Core types (`RunDetail`, `IntradaySample`, `ApiResponse<T>`).
- `scripts`
  - `clear-blob.mjs`: Delete all Blob objects under a prefix (defaults to `intraday/`).
  - `ls-blob.mjs`: List object paths under a prefix (defaults to `intraday/`).
  - `inspect-blob.mjs`: Summarize intraday coverage by day.
- `vercel.json`: Cron calling `/api/tick` every 10 minutes.
- `README.md`: User‑facing overview and basic ops.

There are no daily or history artifacts in the current model; any remaining directories named `daily/` are vestigial and can be ignored. Storage writes only under `intraday/YYYY-MM-DD/HHMM.json`.

---

## Data Model

Types are defined in `src/lib/types.ts`.

- `RunDetail` — one compute result from the model:
  - `probability: number` in [0,1]
  - `report: string` (Markdown)
  - `citations: { url: string; title?: string }[]`
  - `computedAt: string` (ISO timestamp)

- `IntradaySample` — persisted snapshot for a 10‑minute bucket:
  - `date: string` (UTC `YYYY-MM-DD`)
  - `at: string` (ISO timestamp, floored to the 10‑minute bucket)
  - `probability: number` in [0,1]
  - `report?: string`
  - `citations?: Citation[]`

- `ApiResponse<T>` — route envelope:
  - `{ ok: true, data: T } | { ok: false, error: string }`

Notes:
- We persist the full report + citations on each sample to make point‑in‑time PDFs possible without cross‑referencing.
- We do not store any model identifier or hidden metadata.

---

## Storage Layout

Primary storage is Vercel Blob; local disk is a transparent fallback for development.

- Blob prefix: `intraday/{YYYY-MM-DD}/{HHmm}.json`
- Local fallback: `./data/intraday/{YYYY-MM-DD}/{HHmm}.json`

Blob tokens:
- On Vercel: credentials are injected automatically; explicit tokens are optional.
- Locally: set `BLOB_READ_WRITE_TOKEN` or `BLOB_READ_TOKEN` to read/write from Blob.

Guarantees & behavior:
- Writes are idempotent per 10‑minute key; clients overwrite the same key if called again within the bucket window.
- `listIntraday(day)` sorts results lexicographically by pathname, yielding chronological order.
- If Blob list/fetch fails, local disk fallback takes over (mkdir, read/write JSON).

---

## Compute Flow (10‑Minute Cadence)

1) `GET /api/tick` runs `computeOneRun()` (OpenAI) → returns `{ probability, report, citations }`.
2) The result is passed to `recordIntradayFromRun()`, which floors time to the current 10‑minute bucket and writes `IntradaySample` to storage.
3) Clients can list `GET /api/intraday?day=YYYY-MM-DD` to chart the day and show the latest sample.
4) `GET /api/pdf?day=YYYY-MM-DD&at=HHmm` produces a minimal PDF for the requested sample (defaults to latest if `at` is omitted).

Cron (`vercel.json`) calls `/api/tick` every 10 minutes.

---

## API Contracts

Responses use the `ApiResponse<T>` envelope unless noted.

- `GET /api/tick`
  - Purpose: compute one point and persist one intraday sample.
  - Returns: `{ ok: true, data: { sample: IntradaySample } }` or `{ ok: false, error }`.

- `GET /api/intraday?day=YYYY-MM-DD`
  - Lists all samples for the UTC day. Returns `{ ok: true, data: IntradaySample[] }`.

- `GET /api/pdf?day=YYYY-MM-DD&at=HHmm`
  - Returns a PDF (`application/pdf`).
  - If `at` is omitted, the latest sample for the day is used.
  - If no samples exist, returns HTTP 404 text.

Conventions:
- 200/JSON for normal API responses; 404 for missing PDF sample.
- All dates are UTC; the `at` key for the PDF is the `HHmm` of the sample’s UTC time.

---

## UI Behavior

- Headline: shows the latest sample’s probability as a percent, with a heat‑mapped color (green→red).
- Chart: `TimeSeriesLine.tsx` renders the day’s intraday series.
  - Hover: built‑in Chart.js tooltip shows “<percent>%” and the sample’s local datetime.
  - Click: opens the report overlay and sets it to that sample.
- Report overlay: shows the Markdown report and a citations list. A button downloads a PDF of the displayed (latest/selected) sample.
- Polling: dashboard polls `/api/intraday` every ~30s to refresh without jarring the view.

Accessibility & UX:
- Tooltips rely on point hit radius to be usable with both mouse and trackpads.
- Overlay supports Escape to close; click‑away closes as well.

---

## OpenAI Integration (`src/lib/openai.ts`)

- Model: `DR_MODEL` env (default `gpt-5`). If a deep‑research model string is used, special tools (`web_search_preview`, `code_interpreter`) are enabled; otherwise a high‑effort reasoning mode is used.
- Hard timeout for the client is set to 1 hour to accommodate long deep‑research runs on Vercel (actual routes set lower `maxDuration`).
- Parsing: output is strictly parsed via `extractOutputTextStrict()` then `extractJsonStrict()`. If the shape is off, we throw — no silent recovery.
- Output schema (Zod validated): `{ probability: number 0..1, report: string, citations?: [{ url, title? }] }`.

Operational cautions:
- Missing/invalid `OPENAI_API_KEY` leads to errors in `/api/tick` and a blank intraday sample is written as a resilience measure only when explicitly invoked by catch blocks.
- Treat the report as analysis, not legal advice; Markdown is rendered without advanced plugins.

---

## PDF Generation (`src/lib/pdf.ts`)

- Dependency‑free, basic PDF (Helvetica, text only).
- Title contains the day and sample time; body prints the probability, report, and a citations list.
- Called by `/api/pdf`. The export filename includes day and `HH:MM`.

---

## Environment Variables

- `OPENAI_API_KEY` — required to compute samples.
- `DR_MODEL` — model name; default `gpt-5`.
- `BLOB_READ_WRITE_TOKEN` / `BLOB_READ_TOKEN` — optional locally; Vercel injects scoped credentials automatically.

Local `.env.local` example:

```
OPENAI_API_KEY=sk-...
DR_MODEL=gpt-5
# Optional for local Blob access
# BLOB_READ_WRITE_TOKEN=...
# BLOB_READ_TOKEN=...
```

---

## Scripts & Operations

- Clear all intraday objects (danger):

```
BLOB_READ_WRITE_TOKEN=... node scripts/clear-blob.mjs intraday/
```

- List objects under a prefix:

```
BLOB_READ_TOKEN=... node scripts/ls-blob.mjs intraday/2025-09-01/
```

- Inspect coverage by day:

```
BLOB_READ_TOKEN=... node scripts/inspect-blob.mjs 2025-09-01
```

- Local dev:

```
npm install
npm run dev
```

- Typecheck / build:

```
npm run test
npm run build
```

Deployment: push to `main` on GitHub; Vercel picks up and deploys. Cron defined in `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/tick", "schedule": "*/10 * * * *" }
  ]
}
```

---

## Error Handling & Resilience

- API routes return `ok: false` JSON with an error message where possible instead of throwing 500s that produce HTML error pages.
- `/api/pdf` returns 404 when the requested day has no samples.
- Storage: Blob is preferred; on failure the system writes/reads from `./data/intraday` (Node filesystem). This is useful for local development or transient Blob issues.
- Intraday blank sample: on compute failure, `/api/tick` attempts to record a blank sample for the bucket so the time series reflects the failed tick.

---

## Security & Privacy

- No user PII is stored; reports are LLM‑generated analysis with public citations.
- The client never receives any model identifiers or API keys.
- Markdown renderer escapes HTML and supports only a safe subset (basic links/emphasis/lists/tables). No plugins or script execution.

---

## Code Conventions

- UTC everywhere. Date utilities live in `src/lib/date.ts`.
- Keep API handlers thin; real work happens in `src/lib/*`.
- Prefer early returns and narrow, single‑purpose functions.
- No global mutable state; all persistence goes through `store.ts`.
- Types are explicit and exported from `types.ts` to keep route/component signatures predictable.
 
### Comment Guidance

- Keep comments to an absolute minimum.
- Add them only when the intent cannot be made obvious through naming and small functions.
- Prefer self‑documenting code, clear types, and focused helpers over explanatory prose.

---

## Performance Notes

- Chart renders at most one day’s worth of points (≤ 144 per day). We keep two datasets: raw and a dashed smoothed line (moving average window = 4). This is performant in the browser.
- Tooltips use Chart.js built‑in logic to avoid reimplementing hover hit‑tests.
- PDF generation is string‑based; no canvas or heavy libs.

---

## Troubleshooting

- “No samples for requested date” when downloading PDF → the day has no intraday files yet. Trigger `/api/tick` or wait for cron.
- Nothing persists locally → you may lack Blob tokens and the process can’t write the local fallback. Ensure the Node process has permission to create `./data/intraday`.
- Hover labels don’t appear → ensure you’re hovering the point (the hit radius is expanded to improve tolerance). If needed, tweak `pointHitRadius` in `TimeSeriesLine.tsx`.
- 401/403 from Blob in local scripts → make sure `BLOB_READ_TOKEN` or `BLOB_READ_WRITE_TOKEN` is set.

---

## Extensibility Ideas

- Multi‑destination mode: add `destination` to `IntradaySample` and shard storage under `intraday/{destination}/{YYYY-MM-DD}/{HHmm}.json`.
- Backfill job: iterate over “missing” buckets to fill blank samples for continuous charts.
- External tooltip: custom HTML tooltip for richer layout (e.g., show citations count).
- Server‑side rendering of the latest report excerpt on the homepage.

---

## Historical Note

This codebase previously supported multiple runs per day, daily rollups, and history endpoints. All of that has been removed. If you encounter references to “daily” in commit history or old directories, they can be ignored — only intraday snapshots are authoritative.

---

## Contact Points (in code)

- Compute: `src/lib/daily.ts#computeOneRun`
- Persist: `src/lib/intraday.ts#recordIntradayFromRun`, `src/lib/store.ts#saveIntradaySample`
- Read series: `src/lib/store.ts#listIntraday`
- UI: `src/app/ui/LiveDashboard.tsx`, `src/app/ui/TimeSeriesLine.tsx`
- API: `src/app/api/tick/route.ts`, `src/app/api/intraday/route.ts`, `src/app/api/pdf/route.ts`

Use these as anchors when modifying behavior.
