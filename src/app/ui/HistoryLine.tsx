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
  type Plugin,
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
    surface: '#ffffff',
    foreground: '#0f172a',
  });
  useEffect(() => {
    const readVars = () => {
      const cs = getComputedStyle(document.documentElement);
      const axis = cs.getPropertyValue('--axis').trim() || '#1f2937';
      const grid = cs.getPropertyValue('--grid').trim() || 'rgba(0,0,0,0.08)';
      const primary = cs.getPropertyValue('--primary').trim() || '#2563eb';
      const primaryRGB = cs.getPropertyValue('--primary-rgb').trim() || '37,99,235';
      const surface = cs.getPropertyValue('--surface').trim() || '#ffffff';
      const foreground = cs.getPropertyValue('--foreground').trim() || '#0f172a';
      setTheme({ axis, grid, primary, primaryRGB, surface, foreground });
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
  }), [labels, values, stds, theme.primary, theme.primaryRGB]);

  const options = useMemo<ChartOptions<'line'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { left: 24, right: 24 } },
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
      x: { grid: { display: false }, ticks: { display: false }, border: { display: false }, offset: true },
      y: {
        beginAtZero: true,
        grid: { display: false },
        ticks: { display: false },
        border: { display: false },
      },
    },
    animation: { duration: 700, easing: 'easeOutQuart' },
  }), [values, stds]);

  // Custom plugin to draw rounded-rectangle labels for each point
  const labelsPlugin = useMemo<Plugin<'line'>>(() => ({
    id: 'pointLabelsRounded',
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      const dsIdx = chart.data.datasets.findIndex((d) => d.label === 'Points');
      if (dsIdx < 0) return;
      const meta = chart.getDatasetMeta(dsIdx);
      ctx.save();
      const fontFamily = getComputedStyle(document.body).fontFamily || 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif';
      ctx.font = `600 10px ${fontFamily}`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';

      const padX = 6;
      const radius = 6;
      const offset = 16;
      const textColor = theme.foreground;
      // Surface with slight transparency for overlay effect
      const fill = theme.surface + 'E6'; // add ~90% alpha if hex, else fallback below
      const fillStyle = /^#?[0-9A-Fa-f]{6}$/.test(theme.surface) ? fill : 'rgba(255,255,255,0.9)';
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

      values.forEach((v, i) => {
        const element = meta.data[i] as unknown as { x: number; y: number };
        if (!element || typeof element.x !== 'number' || typeof element.y !== 'number') return;
        const x = element.x;
        const y = element.y;
        const label = `${v}%`;
        const metrics = ctx.measureText(label);
        const w = Math.ceil(metrics.width) + padX * 2;
        const h = 18; // fixed height
        const bx = x - w / 2;
        let by = y - offset - h;
        // Avoid clipping top/bottom
        const topBound = chart.chartArea.top + 4;
        const bottomBound = chart.chartArea.bottom - 4;
        if (by < topBound) by = y + offset; // flip below point
        if (by + h > bottomBound) by = bottomBound - h;

        // Draw box
        ctx.fillStyle = fillStyle;
        ctx.strokeStyle = strokeStyle;
        roundRect(bx, by, w, h, radius);
        ctx.fill();
        ctx.stroke();

        // Draw text
        ctx.fillStyle = textColor;
        ctx.fillText(label, bx + w / 2, by + h / 2 + 0.5);
      });
      ctx.restore();
    },
  }), [values, theme.surface, theme.foreground]);

  return (
    <Line data={data} options={options} plugins={[labelsPlugin]} style={{ width: '100%', height: '100%' }} />
  );
}
