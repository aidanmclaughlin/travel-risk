import { listHistory, loadDaily } from "@/lib/store";
import LiveDashboard from "./ui/LiveDashboard";

// Ensure this page is always rendered dynamically on the server
// so it reflects the latest Blob data instead of a static snapshot.
export const dynamic = "force-dynamic";
export const revalidate = 0;

function toDateStr(d: Date = new Date()): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

export default async function Home() {
  const todayStr = toDateStr();
  const today = await loadDaily(todayStr);
  const history = await listHistory();
  // Fallback: if today's data is unavailable (e.g., API errors),
  // show the most recent available day so the UI isn't blank.
  const latest = today || (history.length ? history[history.length - 1] : null);

  return <LiveDashboard initialToday={latest} initialHistory={history} />;
}
