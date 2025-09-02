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
//

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

  const data = useMemo(() => ({
    labels,
    datasets: [
      {
        label: 'Raw %',
        data: values,
        borderColor: theme.primary,
        backgroundColor: 'rgba(0,0,0,0)',
        borderWidth: 2.2,
        pointRadius: 4,
        pointHitRadius: 16,
        pointHoverRadius: 7,
        pointBackgroundColor: '#ffffff',
        pointBorderColor: 'rgba(59,130,246,0.65)',
        pointBorderWidth: 2,
        tension: 0.25,
        order: 2,
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
        order: 1,
      },
    ],
  }), [labels, values, trend]);

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

  const haloPlugin = useMemo(() => ({
    id: 'pointHalo',
    afterDatasetsDraw(chart: import('chart.js').Chart<'line'>) {
      const meta = chart.getDatasetMeta(0);
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

  return <Line ref={captureRef} data={data} options={options} plugins={[haloPlugin]} onClick={onCanvasClick} style={{ width: '100%', height: '100%' }} />;
}
