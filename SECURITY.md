# Security & Abuse Prevention

This app runs an automated compute task that uses a paid API. To prevent abuse when the code is public, the following guards are in place:

- Write endpoint locked
  - `GET /api/tick` is the only endpoint that performs paid compute. It now requires either:
    - The `X-Vercel-Cron: 1` header (set by Vercel Cron), or
    - A secret token in `Authorization: Bearer <CRON_SECRET>` or `?key=<CRON_SECRET>`.
  - Set `CRON_SECRET` as a Vercel environment variable. Never commit it.

- Read endpoints only
  - `GET /api/intraday` and `GET /api/pdf` only read stored data; they never trigger compute.

- Robots
  - `/api/tick` is disallowed in `robots.txt` to avoid crawler hits.

- Environment
  - Never commit `.env*`. Configure keys in Vercel Environment Variables.

If you discover a vulnerability, please open an issue without sensitive details and email the maintainer privately.

