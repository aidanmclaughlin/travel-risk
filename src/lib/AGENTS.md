Lib — Agent Guide

Files
- `date.ts`: UTC-only date helpers. Use `toDateStrUTC()` everywhere; avoid ad-hoc date formatting.
- `daily.ts`: Single-run compute helpers: `computeOneRun()`, `computeAndSaveDaily()`, `ensureDailySnapshot()`.
- `openai.ts`: `deepResearchRisk()` single-run estimate. Keep the schema strict; prefer explicit errors to silent corrections.
- `pdf.ts`: `generateDailyPdf()` minimal PDF generator from a single-run `DailyResult`.
- `store.ts`: Blob-first persistence with automatic local fallback under `./data`. Also saves/lists intraday samples.
- `types.ts`: `DailyResult`, `RunDetail`, `Citation`, `IntradaySample`, `ApiResponse<T>`.
- `intraday.ts`: Records an `IntradaySample` (10-minute cadence) from a `RunDetail`.

Guidelines
- Never expose `model` in HTTP responses; sanitize in routes.
- Prefer importing helpers over re-implementing small utilities (dates, stats).
- Storage layout: top‑level `daily/YYYY-MM-DD.json` holds a single snapshot for the day. Intraday samples are stored under `intraday/YYYY-MM-DD/HHMM.json`.
