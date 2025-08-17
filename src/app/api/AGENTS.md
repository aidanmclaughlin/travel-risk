API — Agent Guide

Endpoints
- `GET /api/daily` — Compute/top-up daily result.
  - Query: `day=YYYY-MM-DD` (default: today UTC), `count=1..50` (goal), `batch=1..10` (per-request cap).
  - Returns: `{ ok: true, data: DailyResultSansModel }` or `{ ok: false, error }`.
- `GET /api/history` — List chronologically sorted history.
  - Returns: `{ ok: true, data: DailyResultSansModel[] }`.
- `GET /api/pdf` — Generate a PDF for a day.
  - Query: `day=YYYY-MM-DD` (default: today UTC).

Conventions
- Handlers are thin; they call `src/lib/daily.ts` or `src/lib/store.ts` and sanitize the model field.
- Always return 200 with `{ ok: false, error }` for predictable clients.

