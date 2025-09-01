API — Agent Guide

Endpoints
- `GET /api/tick` — Append `batch` runs and record a 10‑minute intraday sample.
  - Query: `day=YYYY-MM-DD` (default today UTC), `batch=1..10` (per‑request cap; keep small).
  - Returns: `{ ok: true, data: { daily: DailyResultSansModel, sample: IntradaySample } }`.
- `GET /api/intraday` — List intraday samples for a day.
  - Query: `day=YYYY-MM-DD` (default today UTC).
- `GET /api/daily` — Compute/top‑up daily result (no intraday side‑effect).
  - Query: `day=YYYY-MM-DD`, `count`, `batch`.
- `GET /api/history` — List daily summaries (sanitized: no model name).
- `GET /api/pdf` — Generate a PDF for a day.
  - Query: `day=YYYY-MM-DD`.

Conventions
- Handlers are thin; they call `src/lib/daily.ts`/`src/lib/store.ts` and sanitize the model field.
- Always return 200 with `{ ok: false, error }` for predictable clients.
