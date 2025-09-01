import { listHistory, loadDaily, listIntraday } from "@/lib/store";
import LiveDashboard from "./ui/LiveDashboard";
import { toDateStrUTC } from "@/lib/date";

// Ensure this page is always rendered dynamically on the server
// so it reflects the latest Blob data instead of a static snapshot.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  const todayStr = toDateStrUTC();
  const today = await loadDaily(todayStr);
  const history = await listHistory();
  const intraday = await listIntraday(todayStr);

  return <LiveDashboard initialToday={today || null} initialHistory={history} initialIntraday={intraday} />;
}
