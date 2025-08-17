UI — Agent Guide

Components
- `LiveDashboard.tsx`: Fetches `/api/history` and `/api/daily` periodically, displays headline stats and opens the median report overlay.
- `HistoryLine.tsx`: Chart.js line + band + points; expects preformatted labels and percentages (0..100) for values/stddevs.
- `Markdown.tsx`: Minimal, safe-ish markdown renderer for reports. Scope is intentionally small; avoid plugins.

Guidelines
- Treat props as already formatted for display (e.g., percentages). Keep formatting and data shaping in the page/controller layer.
- Use CSS variables from `globals.css` for consistent theming.
- Keep hooks’ dependency arrays minimal and correct; avoid unnecessary rerenders.

