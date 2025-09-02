Lib — Agent Guide

Files
- `date.ts`: UTC-only date helpers. Use `toDateStrUTC()` everywhere; avoid ad-hoc date formatting.
- `daily.ts`: Single-run compute helpers: `computeOneRun()`.
- `openai.ts`: `deepResearchRisk()` single-run estimate. Keep the schema strict; prefer explicit errors to silent corrections.
- `pdf.ts`: `generateDailyPdf()` minimal PDF generator from an `IntradaySample`.
- `store.ts`: Blob-first persistence with automatic local fallback under `./data`. Saves/lists intraday samples.
- `types.ts`: `RunDetail`, `Citation`, `IntradaySample`, `ApiResponse<T>`.
- `intraday.ts`: Records an `IntradaySample` (10-minute cadence) from a `RunDetail`.

Guidelines
- Prefer importing helpers over re-implementing small utilities.
- Storage layout: intraday samples only: `intraday/YYYY-MM-DD/HHMM.json`.
