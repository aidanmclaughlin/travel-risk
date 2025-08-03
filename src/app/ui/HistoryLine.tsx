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
import { useMemo } from "react";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler
);

export default function HistoryLine({ labels, values, stds }: { labels: string[]; values: number[]; stds: number[] }) {
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
          const g = c.createLinearGradient(0, 0, 0, 120);
          g.addColorStop(0, "rgba(17,24,39,0.22)");
          g.addColorStop(1, "rgba(17,24,39,0)");
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
        borderColor: "#111827",
        backgroundColor: "rgba(0,0,0,0)",
        borderWidth: 3,
        fill: false,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 3,
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
      x: { grid: { display: false }, ticks: { color: "rgba(17,24,39,0.6)" } },
      y: {
        beginAtZero: true,
        grid: { color: "rgba(0,0,0,0.06)" },
        ticks: { color: "rgba(17,24,39,0.6)", callback: (value: number | string) => `${value}%` },
      },
    },
    animation: { duration: 700, easing: 'easeOutQuart' },
  }), [values, stds]);

  return (
    <Line data={data} options={options} />
  );
}
