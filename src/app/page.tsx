import { listIntraday } from "@/lib/store";
import LiveDashboard from "./ui/LiveDashboard";
import { toDateStrUTC } from "@/lib/date";

// Ensure this page is always rendered dynamically on the server
// so it reflects the latest Blob data instead of a static snapshot.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  const todayStr = toDateStrUTC();
  const intraday = await listIntraday(todayStr);
  const latest = intraday.length ? intraday[intraday.length - 1] : null;
  return <LiveDashboard initialLatest={latest} initialIntraday={intraday} />;
}
