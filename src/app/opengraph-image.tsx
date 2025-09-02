import { ImageResponse } from 'next/og';
import { toDateStrUTC } from '@/lib/date';
import { listIntraday } from '@/lib/store';

export const runtime = 'nodejs';
export const alt = 'Daily Travel Risk — U.S. to Any Country';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

function heatColor(pct: number): string {
  const x = Math.max(0, Math.min(100, pct));
  const hue = 120 - x * 1.2; // green->red
  return `hsl(${hue},72%,44%)`;
}

export default async function Image() {
  const day = toDateStrUTC();
  const series = await listIntraday(day);
  const latest = series[series.length - 1] || null;
  const p = latest ? Math.round((latest.probability || 0) * 1000) / 10 : 0;
  const color = heatColor(p);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(180deg, #0b1222 0%, #0d152a 100%)',
          color: '#e5e7eb',
          fontFamily: 'Geist, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            padding: '40px',
          }}
        >
          <div style={{ display: 'flex', fontSize: 26, letterSpacing: 6, textTransform: 'uppercase', color: '#94a3b8' }}>
            Travel Risk
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginTop: 6 }}>
            <div style={{ display: 'flex', fontWeight: 800, fontSize: 220, lineHeight: 0.95, color }}>{p}%</div>
          </div>
          <div style={{ display: 'flex', marginTop: 20, fontSize: 30, color: '#cbd5e1', textAlign: 'center', maxWidth: 900 }}>
            Probability a typical U.S. non‑citizen traveler faces an adverse border outcome on re‑entry within 30 days.
          </div>
          <div style={{ display: 'flex', marginTop: 28, fontSize: 24, color: '#9aa7bb' }}>Updated {latest ? new Date(latest.at).toUTCString() : day}</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
