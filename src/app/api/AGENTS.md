API — Agent Guide

Endpoints
- `GET /api/tick` — Compute exactly one run and record a 10‑minute intraday sample.
  - Returns: `{ ok: true, data: { sample: IntradaySample } }`.
- `GET /api/intraday` — List intraday samples for a day.
  - Query: `day=YYYY-MM-DD` (default today UTC).
- `GET /api/pdf` — Generate a PDF for a specific intraday sample.
  - Query: `day=YYYY-MM-DD` (default today), `at=HHmm` (optional; defaults to latest).

Conventions
- Handlers are thin; they call `src/lib/daily.ts` and `src/lib/store.ts`.
- Always return 200 with `{ ok: false, error }` for predictable clients.
