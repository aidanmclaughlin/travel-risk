UI — Agent Guide

Components
- `LiveDashboard.tsx`: Fetches `/api/daily` and `/api/intraday` periodically, displays the single-run headline probability (daily snapshot) and a 10‑minute time‑series line, with the latest report overlay.
- `TimeSeriesLine.tsx`: Chart.js line rendering intraday single-run percentages plus a dashed smoothed line; expects preformatted labels and percentages (0..100). Hides grids/axes, labels each point with a small rounded tag (`HH:MM • value%`), and supports clicking a point to open its snapshot report.
- `Markdown.tsx`: Minimal, safe-ish markdown renderer for reports. Scope is intentionally small; avoid plugins.

Guidelines
- Treat props as already formatted for display (percentages). Do shaping in the page/controller layer.
- Use CSS variables from `globals.css` for consistent theming.
- Keep hooks’ dependency arrays minimal and correct; avoid unnecessary rerenders.
