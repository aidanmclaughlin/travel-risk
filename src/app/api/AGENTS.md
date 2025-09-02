API — Agent Guide

Endpoints
- `GET /api/tick` — Compute exactly one run and record a 10‑minute intraday sample; also updates the daily snapshot.
  - Query: `day=YYYY-MM-DD` (default today UTC).
  - Returns: `{ ok: true, data: { daily: DailyResultSansModel, sample: IntradaySample } }`.
- `GET /api/intraday` — List intraday samples for a day.
  - Query: `day=YYYY-MM-DD` (default today UTC).
- `GET /api/daily` — Ensure a daily snapshot exists (single run) and return it.
  - Query: `day=YYYY-MM-DD`.
- `GET /api/history` — List daily summaries (sanitized: no model name).
- `GET /api/pdf` — Generate a PDF for a day.
  - Query: `day=YYYY-MM-DD`.

Conventions
- Handlers are thin; they call `src/lib/daily.ts`/`src/lib/store.ts` and sanitize the model field.
- Always return 200 with `{ ok: false, error }` for predictable clients.
