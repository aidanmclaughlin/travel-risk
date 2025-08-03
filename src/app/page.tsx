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
    <div className="space-y-8">
      <header className="space-y-2 text-center">
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">
          Daily Travel Risk
        </h1>
        <p className="muted text-base">
          Estimated chance of visa or entry hiccups for U.S. non‑citizens returning within 30 days.
        </p>
      </header>

      <LiveDashboard initialToday={today || null} initialHistory={history} />
    </div>
  );
}
