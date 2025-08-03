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
        tension: 0.2,
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
          g.addColorStop(0, "rgba(17,24,39,0.18)");
          g.addColorStop(1, "rgba(17,24,39,0)");
          return g;
        },
        fill: '-1',
        pointRadius: 0,
        pointHoverRadius: 0,
        tension: 0.2,
      },
      // Average line
      {
        label: "Avg risk %",
        data: values,
        borderColor: "#111827",
        backgroundColor: "rgba(0,0,0,0)",
        fill: false,
        tension: 0.25,
        pointRadius: 2,
        pointHoverRadius: 4,
      },
    ],
  }), [labels, values, stds]);

  const options = useMemo<ChartOptions<'line'>>(() => ({
    responsive: true,
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
      x: { grid: { display: false } },
      y: { grid: { color: "rgba(0,0,0,0.06)" }, ticks: { callback: (value: number | string) => `${value}%` } },
    },
  }), [values, stds]);

  return (
    <div className="h-[220px]">
      <Line data={data} options={options} height={200} />
    </div>
  );
}
