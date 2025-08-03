import { listHistory, loadDaily } from "@/lib/store";
import { parseISO, format } from "date-fns";
import Link from "next/link";
import HistoryLine from "./ui/HistoryLine";

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
      <header className="space-y-2">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
          Daily Travel Risk — U.S. to Any Country
        </h1>
        <p className="muted">
          Estimates from 25 Deep Research runs with web search. Big number is today’s average; chart shows history with ±1σ band.
        </p>
      </header>

      <section className="grid md:grid-cols-3 gap-4">
        <div className="card p-6">
          <div className="muted text-sm">Today’s Average</div>
          <div className="text-4xl font-bold">
            {today ? `${Math.round((today.average || 0) * 1000) / 10}%` : "—"}
          </div>
          <div className="muted text-sm">
            {today
              ? `Median: ${Math.round((today.median || 0) * 1000) / 10}% • Runs: ${today.runCount}`
              : "Run not computed yet"}
          </div>
        </div>
        <div className="card p-6">
          <div className="muted text-sm">Date</div>
          <div className="text-2xl font-semibold">
            {today ? format(parseISO(today.date), "PPP") : format(new Date(), "PPP")}
          </div>
          <div className="muted text-sm">Model: o3-deep-research</div>
        </div>
        <div className="card p-6 space-y-2">
          <div className="muted text-sm">Download</div>
          {today ? (
            <a
              className="inline-flex items-center justify-center rounded-md bg-black text-white px-4 py-2 text-sm font-medium hover:opacity-90"
              href={`/api/pdf?day=${today.date}`}
            >
              Download full PDF (median report)
            </a>
          ) : (
            <span className="muted text-sm">Compute today’s estimate to enable PDF</span>
          )}
          <Link className="text-blue-600 hover:underline text-sm" href="/api/daily" prefetch={false}>
            View JSON
          </Link>
        </div>
      </section>

      {today && (
        <section className="card p-6 space-y-3">
          <h2 className="text-xl font-semibold">Median Report</h2>
          <p className="leading-7 whitespace-pre-wrap">{today.medianReport}</p>
          {today.medianCitations?.length > 0 && (
            <div className="pt-2">
              <div className="muted text-sm pb-1">Citations</div>
              <ul className="list-disc pl-6 space-y-1">
                {today.medianCitations.map((c, i) => (
                  <li key={i}>
                    <a className="text-blue-600 hover:underline" href={c.url} target="_blank" rel="noreferrer">
                      {c.title || c.url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <section className="card p-6 space-y-3">
        <div className="flex items-end justify-between">
          <h2 className="text-xl font-semibold">History</h2>
          <Link className="text-sm text-blue-600 hover:underline" href="/api/history" prefetch={false}>
            JSON
          </Link>
        </div>
        {history.length > 0 ? (
          <div className="space-y-4">
            <HistoryLine
              labels={history.map((h) => h.date)}
              values={history.map((h) => Math.round(h.average * 1000) / 10)}
              stds={history.map((h) => Math.round(h.stddev * 1000) / 10)}
            />
            <ul className="grid sm:grid-cols-2 gap-3">
              {history.map((it) => (
                <li key={it.date} className="rounded-lg border p-3 bg-white/60">
                  <div className="font-medium">{format(parseISO(it.date), "PPP")}</div>
                  <div className="muted text-sm">
                    Avg {percent(it.average)} • Median {percent(it.median)} • Runs {it.runCount}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="muted">No history yet. Compute today’s estimate to get started.</p>
        )}
      </section>

      <footer className="muted text-sm">
        Built with Next.js + Tailwind. Deep Research calls can take several minutes; consider scheduling a daily cron.
      </footer>
    </div>
  );
}

function percent(n: number) {
  return `${Math.round(n * 1000) / 10}%`;
}
