Lib — Agent Guide

Files
- `date.ts`: UTC-only date helpers. Use `toDateStrUTC()` everywhere; avoid ad-hoc date formatting.
- `config.ts`: Safe parsing for `count` and `batch` with clamped defaults from env.
- `stats.ts`: `calcStats` and `pickNearestToMedian` for numeric arrays and run selection.
- `daily.ts`: Orchestrates top-ups, persists runs sequentially (`saveDailyRun`), recomputes aggregates, saves/rebuilds the daily JSON.
- `openai.ts`: `deepResearchRisk()` single-run estimate. Keep the schema strict; prefer explicit errors to silent corrections.
- `pdf.ts`: `generateDailyPdf()` minimal PDF generator from a `DailyResult`.
- `store.ts`: Blob-first persistence with automatic local fallback under `./data`. Also saves/lists intraday samples and can reconstruct daily summaries from stored runs.
- `types.ts`: `DailyResult`, `RunDetail`, `Citation`, `ApiResponse<T>`.
- `intraday.ts`: Records an `IntradaySample` (10-minute cadence) from a `DailyResult`.

Guidelines
- Never expose `model` in HTTP responses; sanitize in routes.
- Prefer importing helpers over re-implementing small utilities (dates, stats).
- Storage layout: keep top-level `daily/` flat for summaries and nest per-run artifacts; store intraday samples under `intraday/YYYY-MM-DD/HHMM.json`.
