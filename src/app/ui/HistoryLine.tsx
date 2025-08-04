"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
  type ScriptableContext,
  type ChartData,
  type ChartOptions,
  type TooltipItem,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { useEffect, useMemo, useState } from "react";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler
);

export default function HistoryLine({ labels, values, stds }: { labels: string[]; values: number[]; stds: number[] }) {
  const [theme, setTheme] = useState({
    axis: '#1f2937',
    grid: 'rgba(0,0,0,0.08)',
    primary: '#2563eb',
    primaryRGB: '37,99,235',
  });
  useEffect(() => {
    const readVars = () => {
      const cs = getComputedStyle(document.documentElement);
      const axis = cs.getPropertyValue('--axis').trim() || '#1f2937';
      const grid = cs.getPropertyValue('--grid').trim() || 'rgba(0,0,0,0.08)';
      const primary = cs.getPropertyValue('--primary').trim() || '#2563eb';
      const primaryRGB = cs.getPropertyValue('--primary-rgb').trim() || '37,99,235';
      setTheme({ axis, grid, primary, primaryRGB });
    };
    readVars();
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    mq?.addEventListener?.('change', readVars);
    return () => mq?.removeEventListener?.('change', readVars);
  }, []);

  const colorFor = (v: number) => {
    // v is percentage 0..100; map 0->green, 100->red using HSL
    const clamped = Math.max(0, Math.min(100, v));
    const hue = 120 - (clamped * 1.2); // 120 (green) down to ~0 (red)
    return `hsl(${hue}, 70%, 45%)`;
  };

  const data = useMemo<ChartData<'line', number[], string>>(() => ({
    labels,
    datasets: [
      // Lower band
      {
        label: "Lower",
        data: values.map((v, i) => Math.max(0, v - (stds[i] ?? 0))),
        borderColor: "rgba(17,24,39,0)",
        backgroundColor: "rgba(0,0,0,0)",
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 0,
        tension: 0.35,
      },
      // Upper band (fills to previous to create a band)
      {
        label: "Upper",
        data: values.map((v, i) => Math.min(100, v + (stds[i] ?? 0))),
        borderColor: "rgba(17,24,39,0)",
        backgroundColor: (ctx: ScriptableContext<'line'>) => {
          const { chart } = ctx;
          const { ctx: c } = chart;
          const g = c.createLinearGradient(0, 0, 0, 140);
          g.addColorStop(0, `rgba(${theme.primaryRGB},0.18)`);
          g.addColorStop(1, `rgba(${theme.primaryRGB},0.00)`);
          return g;
        },
        fill: '-1',
        pointRadius: 0,
        pointHoverRadius: 0,
        tension: 0.35,
      },
      // Average line
      {
        label: "Avg risk %",
        data: values,
        borderColor: theme.primary,
        backgroundColor: `rgba(${theme.primaryRGB},0.2)`,
        borderWidth: 3,
        fill: false,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 3,
      },
      // Heat-colored points overlay
      {
        label: "Points",
        data: values,
        borderColor: "rgba(0,0,0,0)",
        backgroundColor: (ctx: ScriptableContext<'line'>) => {
          const i = ctx.dataIndex;
          const v = values[i] ?? 0;
          return colorFor(v);
        },
        pointBackgroundColor: (ctx: ScriptableContext<'line'>) => {
          const i = ctx.dataIndex;
          const v = values[i] ?? 0;
          return colorFor(v);
        },
        pointBorderColor: 'white',
        pointBorderWidth: 1,
        showLine: false,
        pointRadius: 3,
        pointHoverRadius: 6,
      },
    ],
  }), [labels, values, stds]);

  const options = useMemo<ChartOptions<'line'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx: TooltipItem<'line'>) => {
        const i = ctx.dataIndex;
        const v = values[i] ?? 0;
        const s = stds[i] ?? 0;
        return `Avg ${v}% ± ${s}%`;
      } } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: theme.axis } },
      y: {
        beginAtZero: true,
        grid: { color: theme.grid },
        ticks: { color: theme.axis, callback: (value: number | string) => `${value}%` },
      },
    },
    animation: { duration: 700, easing: 'easeOutQuart' },
  }), [values, stds, theme]);

  return (
    <Line data={data} options={options} style={{ width: '100%', height: '100%' }} />
  );
}
