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
  Legend,
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Filler, Legend)

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

// Generieke dag-trend (bar) met neutrale tooltip — voor EOD-dashboards e.d.
export function DailyBarChart({ labels, data, unit }: { labels: string[]; data: number[]; unit?: string }) {
  return (
    <Bar
      data={{
        labels,
        datasets: [{
          data,
          backgroundColor: ACCENT,
          borderRadius: 4,
          barPercentage: 0.6,
          categoryPercentage: 0.7,
        }],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => `${ctx.parsed.y}${unit ? ' ' + unit : ''}` } },
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: '#f1f5f9' },
            ticks: { font: { size: 11 }, color: '#94a3b8', precision: 0 },
          },
          x: { grid: { display: false }, ticks: { font: { size: 10 }, color: '#94a3b8' } },
        },
      }}
    />
  )
}

// ── Collection Charts ──

const eurTooltip = { callbacks: { label: (ctx: { parsed: { y: number | null }; dataset: { label?: string } }) => `${ctx.dataset.label || ''}: € ${Number(ctx.parsed.y ?? 0).toLocaleString('nl-NL')}` } }
const eurTicks = { font: { size: 11 as const }, color: '#94a3b8', callback: (v: string | number) => '€' + Number(v).toLocaleString('nl-NL') }

const COLORS = {
  slate: '#334155',
  blue: '#3b82f6',
  amber: '#f59e0b',
  orange: '#f97316',
  red: '#ef4444',
  emerald: '#10b981',
  slateLight: 'rgba(51,65,85,0.15)',
  emeraldLight: 'rgba(16,185,129,0.15)',
}

export function AgingBarChart({ labels, data }: { labels: string[]; data: number[] }) {
  return (
    <Bar
      data={{
        labels,
        datasets: [{
          label: 'Openstaand',
          data,
          backgroundColor: [COLORS.slate, COLORS.blue, COLORS.amber, COLORS.orange, COLORS.red],
          borderRadius: 5,
          barPercentage: 0.6,
          categoryPercentage: 0.7,
        }],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: eurTooltip },
        scales: {
          y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: eurTicks },
          x: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#94a3b8' } },
        },
      }}
    />
  )
}

export function CashForecastChart({ labels, data }: { labels: string[]; data: number[] }) {
  return (
    <Line
      data={{
        labels,
        datasets: [{
          label: 'Verwacht',
          data,
          borderColor: COLORS.slate,
          backgroundColor: COLORS.slateLight,
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          borderWidth: 2,
        }],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: eurTooltip },
        scales: {
          y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: eurTicks },
          x: { grid: { display: false }, ticks: { font: { size: 10 }, color: '#94a3b8' } },
        },
      }}
    />
  )
}

export function ExpectedVsCollectedChart({
  labels,
  expected,
  collected,
}: {
  labels: string[]
  expected: number[]
  collected: number[]
}) {
  return (
    <Bar
      data={{
        labels,
        datasets: [
          {
            label: 'Verwacht',
            data: expected,
            backgroundColor: COLORS.slate,
            borderRadius: 5,
            barPercentage: 0.5,
            categoryPercentage: 0.7,
          },
          {
            label: 'Geïnd',
            data: collected,
            backgroundColor: COLORS.emerald,
            borderRadius: 5,
            barPercentage: 0.5,
            categoryPercentage: 0.7,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'top' as const, labels: { font: { size: 11 }, usePointStyle: true, pointStyle: 'circle' } },
          tooltip: eurTooltip,
        },
        scales: {
          y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: eurTicks },
          x: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#94a3b8' } },
        },
      }}
    />
  )
}
