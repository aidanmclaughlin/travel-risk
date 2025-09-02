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

function movingAverage(values: number[], window: number): number[] {
  if (window <= 1) return values.slice();
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= window) sum -= values[i - window];
    out.push(i >= window - 1 ? +(sum / window).toFixed(2) : values[i]);
  }
  return out;
}

export default function TimeSeriesLine({ labels, values, samples, onSampleClick }: { labels: string[]; values: number[]; samples: IntradaySample[]; onSampleClick?: (s: IntradaySample, idx: number) => void; }) {
  const [theme, setTheme] = useState({
    axis: '#1f2937',
    grid: 'rgba(0,0,0,0.08)',
    primary: '#2563eb',
    foreground: '#0f172a',
  });
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
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

  const smoothed = useMemo(() => movingAverage(values, 4), [values]);

  const data = useMemo(() => ({
    labels,
    datasets: [
      {
        label: 'Risk %',
        data: values,
        borderColor: theme.primary,
        backgroundColor: 'rgba(0,0,0,0)',
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 4,
        tension: 0.25,
      },
      {
        label: 'Smoothed',
        data: smoothed,
        borderColor: 'rgba(167,139,250,0.95)', // static accent-like color for canvas
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 0,
        borderDash: [6, 4],
        tension: 0.2,
      },
    ],
  }), [labels, values, smoothed, theme.primary]);

  const options = useMemo<ChartOptions<'line'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    // Extra horizontal padding to prevent point labels from clipping at edges
    layout: { padding: { left: 48, right: 48 } },
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: {
      x: { grid: { display: false }, ticks: { display: false }, border: { display: false } },
      y: { beginAtZero: true, grid: { display: false }, ticks: { display: false }, border: { display: false } },
    },
    animation: { duration: 600, easing: 'easeOutQuart' },
    onHover: (_event, activeElements) => {
      if (!activeElements || !activeElements.length) { setHoverIdx(null); return; }
      const idx = activeElements[0].index;
      setHoverIdx(typeof idx === 'number' ? idx : null);
    },
  }), []);

  // Plugin to label each point with time and value
  const labelsPlugin = useMemo(() => ({
    id: 'roundedPointLabels',
    afterDatasetsDraw(chart: import('chart.js').Chart<'line'>) {
      const { ctx } = chart;
      const dsMeta = chart.getDatasetMeta(0);
      ctx.save();
      const fontFamily = getComputedStyle(document.body).fontFamily || 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif';
      ctx.font = `600 10px ${fontFamily}`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';

      const padX = 6;
      const radius = 6;
      const offset = 16;
      const textColor = getComputedStyle(document.documentElement).getPropertyValue('--foreground').trim() || '#0f172a';
      const surface = getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() || '#ffffff';
      const fill = /^#?[0-9A-Fa-f]{6}$/.test(surface) ? `${surface}E6` : 'rgba(255,255,255,0.9)';
      const strokeStyle = 'rgba(0,0,0,0.12)';

      function roundRect(x: number, y: number, w: number, h: number, r: number) {
        const rr = Math.min(r, Math.min(w, h) / 2);
        ctx.beginPath();
        ctx.moveTo(x + rr, y);
        ctx.arcTo(x + w, y, x + w, y + h, rr);
        ctx.arcTo(x + w, y + h, x, y + h, rr);
        ctx.arcTo(x, y + h, x, y, rr);
        ctx.arcTo(x, y, x + w, y, rr);
        ctx.closePath();
      }

      // Draw label only for the hovered point
      if (hoverIdx != null) {
        const i = hoverIdx;
        const v = values[i];
        const elem = dsMeta.data[i];
        if (typeof v === 'number' && elem) {
          const x = elem.x;
          const y = elem.y;
          const time = labels[i] ?? '';
          const label = `${time} • ${v.toFixed(2)}%`;
          const metrics = ctx.measureText(label);
          const w = Math.ceil(metrics.width) + padX * 2;
          const h = 18;
          let bx = x - w / 2;
          let by = y - offset - h;
          const ca = chart.chartArea;
          const topBound = ca.top + 4;
          const bottomBound = ca.bottom - 4;
          const leftBound = ca.left + 4;
          const rightBound = ca.right - 4;
          if (by < topBound) by = y + offset; // flip below
          if (by + h > bottomBound) by = bottomBound - h;
          if (bx < leftBound) bx = leftBound;
          if (bx + w > rightBound) bx = rightBound - w;

          ctx.fillStyle = fill;
          ctx.strokeStyle = strokeStyle;
          roundRect(bx, by, w, h, radius);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = textColor;
          ctx.fillText(label, bx + w / 2, by + h / 2 + 0.5);
        }
      }
      ctx.restore();
    },
  }), [labels, values, hoverIdx]);
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

  return <Line ref={captureRef} data={data} options={options} plugins={[labelsPlugin]} onClick={onCanvasClick} onMouseLeave={() => setHoverIdx(null)} style={{ width: '100%', height: '100%' }} />;
}
