import { listHistory, loadDaily } from "@/lib/store";
import LiveDashboard from "./ui/LiveDashboard";

function toDateStr(d: Date = new Date()): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

export default async function Home() {
  const todayStr = toDateStr();
  const today = await loadDaily(todayStr);
  const history = await listHistory();

  return (
    <LiveDashboard initialToday={today || null} initialHistory={history} />
  );
}
