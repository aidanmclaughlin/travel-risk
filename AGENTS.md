Project: Travel Risk — Agent Guide

Purpose
- Publish a single probability (0..1) estimating adverse border outcomes for U.S. non‑citizen travelers on re‑entry within 30 days. Persist a snapshot per day, record an intraday series every 10 minutes, render a tasteful UI, and offer a PDF export.

Architecture Snapshot
- UI (Next.js App Router): `src/app` with client components under `src/app/ui`.
- API routes: `src/app/api/*` — thin controllers that call shared lib.
- Shared logic: `src/lib/*` for dates, config, daily compute, OpenAI calls, storage, stats, and PDF generation.
- Types: `src/lib/types.ts` including `DailyResult`, `RunDetail`, and `ApiResponse<T>`.
- Persistence: Vercel Blob when tokens are available; local filesystem fallback under `./data`.

Key Flows
- 10‑minute cadence: `/api/tick` computes exactly one run and records an intraday sample; updates the daily snapshot.
- Daily snapshot: `/api/daily?day=YYYY-MM-DD` ensures a snapshot exists (single run) and returns it.
- History list: `/api/history` returns sanitized results (no `model` leak) for charting.
- PDF: `/api/pdf?day=YYYY-MM-DD` ensures a snapshot exists then returns a minimal PDF including the report.

Important Conventions
- Dates: always UTC date strings `YYYY-MM-DD` (`src/lib/date.ts`).
- API responses: `{ ok: true, data } | { ok: false, error }`. Model names are omitted from API payloads intentionally.
- Compute logic: lives in `src/lib/daily.ts`. API routes must not duplicate it.
- Prompt + parsing: `src/lib/openai.ts` keeps a strict parser; no silent fallbacks.

Environment
- `OPENAI_API_KEY`: required on Vercel for compute.
- `DR_MODEL`: e.g., `gpt-5` or a deep-research model string.
- `BLOB_READ_WRITE_TOKEN` or `BLOB_READ_TOKEN` enable Blob storage; otherwise local `./data` is used.

Editor/Refactor Notes
- Keep functions single-purpose with descriptive names.
- Touch API routes only as glue; prefer lib extraction instead of expanding handlers.
