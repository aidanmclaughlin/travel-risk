Lib — Agent Guide

Files
- `date.ts`: UTC-only date helpers. Use `toDateStrUTC()` everywhere; avoid ad-hoc date formatting.
- `config.ts`: Safe parsing for `count` and `batch` with clamped defaults from env.
- `stats.ts`: `calcStats` and `pickNearestToMedian` for numeric arrays and run selection.
- `daily.ts`: Orchestrates top-ups, persists runs (`saveDailyRun`), recomputes aggregates, saves the daily JSON.
- `openai.ts`: `deepResearchRisk()` single-run estimate. Keep the schema strict; prefer explicit errors to silent corrections.
- `pdf.ts`: `generateDailyPdf()` minimal PDF generator from a `DailyResult`.
- `store.ts`: Blob-first persistence with automatic local fallback under `./data`.
- `types.ts`: `DailyResult`, `RunDetail`, `Citation`, `ApiResponse<T>`.

Guidelines
- Never expose `model` in HTTP responses; sanitize in routes.
- Prefer importing helpers over re-implementing small utilities (dates, stats).
- When adding new storage keys, keep top-level `daily/` flat for summary JSONs and nest per-run artifacts under `daily/YYYY-MM-DD/runs/`.

