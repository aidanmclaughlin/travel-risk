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
        pointHitRadius: 10,
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
  }), [labels, samples]);

  // No custom hover plugin; default tooltip shows percent + datetime.
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

  return <Line ref={captureRef} data={data} options={options} onClick={onCanvasClick} style={{ width: '100%', height: '100%' }} />;
}
