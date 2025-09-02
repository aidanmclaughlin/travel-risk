import { ImageResponse } from 'next/og';
import { toDateStrUTC } from '@/lib/date';
import { listIntraday } from '@/lib/store';

export const runtime = 'nodejs';
export const alt = 'Daily Travel Risk — U.S. to Any Country';
export const size = { width: 1200, height: 600 };
export const contentType = 'image/png';

function heatColor(pct: number): string {
  const x = Math.max(0, Math.min(100, pct));
  const hue = 120 - x * 1.2;
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
          width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
          background: 'linear-gradient(180deg, #0b1222 0%, #0d152a 100%)', color: '#e5e7eb',
          fontFamily: 'Geist, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', padding: '48px 64px', width: '100%' }}>
          <div style={{ display: 'flex', fontSize: 30, letterSpacing: 8, textTransform: 'uppercase', color: '#94a3b8' }}>Travel Risk</div>
          <div style={{ display: 'flex', fontWeight: 800, fontSize: 260, lineHeight: 0.9, color, marginTop: 8 }}>{p}%</div>
          <div style={{ display: 'flex', marginTop: 16, fontSize: 30, color: '#cbd5e1', maxWidth: 980 }}>
            Probability a typical U.S. non‑citizen traveler faces an adverse border outcome on re‑entry within 30 days.
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
