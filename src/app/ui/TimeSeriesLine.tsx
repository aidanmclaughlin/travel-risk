"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { useEffect, useMemo, useState } from "react";
import type { ChartOptions } from "chart.js";

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

export default function TimeSeriesLine({ labels, values }: { labels: string[]; values: number[] }) {
  const [theme, setTheme] = useState({
    axis: '#1f2937',
    grid: 'rgba(0,0,0,0.08)',
    primary: '#2563eb',
    foreground: '#0f172a',
  });
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
        label: 'Average %',
        data: values,
        borderColor: theme.primary,
        backgroundColor: 'rgba(0,0,0,0)',
        borderWidth: 2,
        pointRadius: 1.5,
        pointHoverRadius: 3,
        tension: 0.25,
      },
      {
        label: 'Smoothed',
        data: smoothed,
        borderColor: 'color-mix(in oklab, var(--accent) 90%, transparent)',
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
    layout: { padding: { left: 24, right: 24 } },
    plugins: { legend: { display: false }, tooltip: { enabled: true } },
    scales: {
      x: { grid: { display: false }, ticks: { color: theme.axis }, border: { display: false } },
      y: { beginAtZero: true, grid: { color: theme.grid }, ticks: { display: false }, border: { display: false } },
    },
    animation: { duration: 600, easing: 'easeOutQuart' },
  }), [theme.axis, theme.grid]);

  return <Line data={data} options={options} style={{ width: '100%', height: '100%' }} />;
}
