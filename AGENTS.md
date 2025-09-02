Project: Travel Risk — Agent Guide

Purpose
- Publish a single probability (0..1) estimating adverse border outcomes for U.S. non‑citizen travelers on re‑entry within 30 days. Persist only intraday samples every 10 minutes (UTC). Render a tasteful UI and offer a PDF export per sample.

Architecture Snapshot
- UI (Next.js App Router): `src/app` with client components under `src/app/ui`.
- API routes: `src/app/api/*` — thin controllers that call shared lib.
- Shared logic: `src/lib/*` for dates, OpenAI calls, storage, and PDF generation.
- Types: `src/lib/types.ts` including `RunDetail`, `IntradaySample`, and `ApiResponse<T>`.
- Persistence: Vercel Blob when tokens are available; local filesystem fallback under `./data`.

Key Flows
- 10‑minute cadence: `/api/tick` computes exactly one run and records an intraday sample.
- List samples: `/api/intraday?day=YYYY-MM-DD` returns that day’s samples.
- PDF: `/api/pdf?day=YYYY-MM-DD&at=HHmm` returns a minimal PDF for a specific intraday sample (defaults to latest when `at` omitted).

Important Conventions
- Dates: always UTC date strings `YYYY-MM-DD` (`src/lib/date.ts`).
- API responses: `{ ok: true, data } | { ok: false, error }`.
- Compute logic: `src/lib/daily.ts` provides `computeOneRun()`; routes must not duplicate it.
- Prompt + parsing: `src/lib/openai.ts` keeps a strict parser; no silent fallbacks.

Environment
- `OPENAI_API_KEY`: required on Vercel for compute.
- `DR_MODEL`: e.g., `gpt-5` or a deep-research model string.
- `BLOB_READ_WRITE_TOKEN` or `BLOB_READ_TOKEN` enable Blob storage; otherwise local `./data` is used.

Editor/Refactor Notes
- Keep functions single-purpose with descriptive names.
- Touch API routes only as glue; prefer lib extraction instead of expanding handlers.
