"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
} from "chart.js";
import { Line, getElementAtEvent } from "react-chartjs-2";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ActiveElement, Chart as ChartInst } from "chart.js";
import type { ChartOptions } from "chart.js";
import type { IntradaySample } from "@/lib/types";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip);

function ema(values: number[], alpha = 0.18): number[] {
  const out: number[] = [];
  let prev = values[0] ?? 0;
  for (let i = 0; i < values.length; i++) { prev = alpha * values[i] + (1 - alpha) * (i ? prev : values[i]); out.push(+prev.toFixed(2)); }
  return out;
}
function median(arr: number[]): number { if (!arr.length) return 0; const s = [...arr].sort((a,b)=>a-b); const m = Math.floor(s.length/2); return s.length%2? s[m] : (s[m-1]+s[m])/2; }
function madSigma(res: number[]): number { if (res.length < 3) return 0; const m = median(res); const dev = res.map(r => Math.abs(r - m)); const mad = median(dev); return mad * 1.4826; }

export default function TimeSeriesLine({ labels, values, samples, onSampleClick }: { labels: string[]; values: number[]; samples: IntradaySample[]; onSampleClick?: (s: IntradaySample, idx: number) => void; }) {
  const [theme, setTheme] = useState({
    axis: '#1f2937',
    grid: 'rgba(0,0,0,0.08)',
    primary: '#2563eb',
    foreground: '#0f172a',
  });
  // No local hover index; rely on built-in tooltip for hover labels
  useEffect(() => {
    const readVars = () => {
      const cs = getComputedStyle(document.documentElement);
      const axis = cs.getPropertyValue('--axis').trim() || '#1f2937';
      const grid = cs.getPropertyValue('--grid').trim() || 'rgba(0,0,0,0.08)';
      const primary = cs.getPropertyValue('--primary').trim() || '#2563eb';
      const foreground = cs.getPropertyValue('--foreground').trim() || '#0f172a';
      setTheme({ axis, grid, primary, foreground });
    };
    readVars();
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    mq?.addEventListener?.('change', readVars);
    return () => mq?.removeEventListener?.('change', readVars);
  }, []);

  const trend = useMemo(() => ema(values, 0.18), [values]);
  const avg = useMemo(() => (values.length ? values.reduce((a,b)=>a+b,0)/values.length : 0), [values]);
  const std = useMemo(() => {
    if (!values.length) return 0;
    const m = avg; return Math.sqrt(values.reduce((s,v)=>s+Math.pow(v-m,2),0)/values.length);
  }, [values, avg]);
  const robust = useMemo(() => madSigma(values.map((v,i)=>v-(trend[i]??v))) || std*0.5, [values, trend, std]);
  const band = useMemo(() => Math.max(0.0001, robust), [robust]);
  const bandUpper = useMemo(() => trend.map(v => v + band), [trend, band]);
  const bandLower = useMemo(() => trend.map(v => Math.max(0, v - band)), [trend, band]);

  const data = useMemo(() => ({
    labels,
    datasets: [
      {
        label: 'Avg %',
        data: values.map(() => avg),
        borderColor: 'rgba(148,163,184,0.55)',
        borderDash: [6,4],
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0,
        order: 1,
      },
      {
        label: 'Raw %',
        data: values,
        borderColor: 'rgba(59,130,246,0.45)',
        backgroundColor: 'rgba(0,0,0,0)',
        borderWidth: 1.5,
        pointRadius: 4,
        pointHitRadius: 16,
        pointHoverRadius: 7,
        pointBackgroundColor: '#ffffff',
        pointBorderColor: 'rgba(59,130,246,0.65)',
        pointBorderWidth: 2,
        tension: 0.25,
        order: 3,
      },
      {
        label: 'Trend',
        data: trend,
        borderColor: 'rgba(167,139,250,0.95)',
        borderWidth: 3,
        pointRadius: 0,
        pointHoverRadius: 0,
        borderDash: [6, 4],
        tension: 0.3,
        order: 2,
      },
    ],
  }), [labels, values, trend, theme.primary, avg]);

  const options = useMemo<ChartOptions<'line'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { left: 48, right: 48 } },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        displayColors: false,
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: 'rgba(255,255,255,0.15)',
        borderWidth: 1,
        padding: 8,
        caretSize: 6,
        callbacks: {
          title: (items) => {
            const i = items[0]?.dataIndex ?? 0;
            const dt = samples[i] ? new Date(samples[i].at) : null;
            return dt ? dt.toLocaleString() : (labels[i] ?? '');
          },
          label: (item) => {
            const v = typeof item.parsed?.y === 'number' ? item.parsed.y : Number(item.formattedValue);
            return Number.isFinite(v) ? `${v.toFixed(2)}%` : String(item.formattedValue);
          },
        },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { display: false }, border: { display: false } },
      y: { beginAtZero: true, grid: { display: false }, ticks: { display: false }, border: { display: false } },
    },
    animation: { duration: 600, easing: 'easeOutQuart' },
    interaction: { mode: 'nearest', intersect: true },
    onHover: (_evt, active, chart) => {
      const canvas = chart?.canvas as HTMLCanvasElement | undefined;
      if (canvas) canvas.style.cursor = active && active.length ? 'pointer' : 'default';
    },
  }), [labels, samples]);

  const bandPlugin = useMemo(() => ({
    id: 'smoothedBand',
    beforeDatasetsDraw(chart: import('chart.js').Chart<'line'>) {
      if (!values.length) return;
      const { ctx } = chart;
      type Scale = { getPixelForValue: (v: number) => number };
      const x = chart.scales.x as unknown as Scale;
      const y = chart.scales.y as unknown as Scale;
      const N = values.length;
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const px = x.getPixelForValue(i);
        const py = y.getPixelForValue(bandUpper[i]);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      for (let i = N - 1; i >= 0; i--) {
        const px = x.getPixelForValue(i);
        const py = y.getPixelForValue(bandLower[i]);
        ctx.lineTo(px, py);
      }
      ctx.closePath();
      const g = ctx.createLinearGradient(0, y.getPixelForValue(Math.max(...bandUpper)), 0, y.getPixelForValue(Math.min(...bandLower)));
      g.addColorStop(0, 'rgba(167,139,250,0.18)');
      g.addColorStop(1, 'rgba(167,139,250,0.06)');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.restore();
    }
  }), [bandUpper, bandLower, values.length]);

  const haloPlugin = useMemo(() => ({
    id: 'pointHalo',
    afterDatasetsDraw(chart: import('chart.js').Chart<'line'>) {
      const meta = chart.getDatasetMeta(1);
      const { ctx } = chart; ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.shadowColor = 'rgba(59,130,246,0.55)';
      ctx.shadowBlur = 12;
      meta.data.forEach((el) => {
        const p = el as unknown as { x:number; y:number };
        if (!p || typeof p.x !== 'number') return;
        ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
      });
      ctx.restore();
    }
  }), []);
  const chartRef = useRef<ChartInst<'line'> | null>(null);
  const captureRef = (instance: unknown) => {
    chartRef.current = instance as ChartInst<'line'> | null;
  };
  const onCanvasClick = (evt: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onSampleClick) return;
    const chart = chartRef.current;
    if (!chart) return;
    const elements: ActiveElement[] = getElementAtEvent(chart, evt);
    if (!elements || !elements.length) return;
    const idx = elements[0].index;
    const s = samples[idx];
    if (s) onSampleClick(s, idx);
  };

  return <Line ref={captureRef} data={data} options={options} plugins={[bandPlugin, haloPlugin]} onClick={onCanvasClick} style={{ width: '100%', height: '100%' }} />;
}
