'use client'

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Filler)

const ACCENT = '#334155' // accent-700 (slate)

export function RevenueBarChart({ labels, data }: { labels: string[]; data: number[] }) {
  return (
    <Bar
      data={{
        labels,
        datasets: [{
          label: 'Omzet',
          data,
          backgroundColor: ACCENT,
          borderRadius: 5,
          barPercentage: 0.6,
          categoryPercentage: 0.7,
        }],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: ctx => '€ ' + Number(ctx.parsed.y).toLocaleString('nl-NL') },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: '#f1f5f9' },
            ticks: { font: { size: 11 }, color: '#94a3b8', callback: v => '€' + Number(v).toLocaleString('nl-NL') },
          },
          x: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#94a3b8' } },
        },
      }}
    />
  )
}

export function LeadsSparkline({ labels, data }: { labels: string[]; data: number[] }) {
  return (
    <Line
      data={{
        labels,
        datasets: [{
          data,
          borderColor: ACCENT,
          backgroundColor: 'rgba(51,65,85,0.08)',
          fill: true,
          tension: 0.4,
          pointRadius: 2,
          borderWidth: 2,
        }],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => `${ctx.parsed.y} leads` } },
        },
        scales: {
          y: { display: false, beginAtZero: true },
          x: { grid: { display: false }, ticks: { font: { size: 10 }, color: '#94a3b8' } },
        },
      }}
    />
  )
}
