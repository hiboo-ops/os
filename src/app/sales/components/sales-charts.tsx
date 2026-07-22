'use client'

import { useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import type { Call } from '@/lib/queries/sales'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const COLORS = {
  slate: '#334155',
  emerald: '#10b981',
  blue: '#3b82f6',
  amber: '#f59e0b',
}

// ── Helpers ──

function groupByWeek(calls: Call[]) {
  const map = new Map<number, Call[]>()
  for (const c of calls) {
    if (c.week != null) {
      const arr = map.get(c.week) || []
      arr.push(c)
      map.set(c.week, arr)
    }
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0])
}

function weekLabels(grouped: [number, Call[]][]) {
  return grouped.map(([w]) => `W${w}`)
}

const eurTicks = {
  font: { size: 11 as const },
  color: '#94a3b8',
  callback: (v: string | number) => '€' + Number(v).toLocaleString('nl-NL'),
}

const defaultScaleY = {
  beginAtZero: true,
  grid: { color: '#f1f5f9' },
  ticks: { font: { size: 11 as const }, color: '#94a3b8' },
}

const defaultScaleX = {
  grid: { display: false as const },
  ticks: { font: { size: 11 as const }, color: '#94a3b8' },
}

const defaultBarStyle = {
  borderRadius: 5,
  barPercentage: 0.6,
  categoryPercentage: 0.7,
}

// ── 1. Total calls per week ──

export function CallsPerWeekChart({ calls }: { calls: Call[] }) {
  const grouped = useMemo(() => groupByWeek(calls), [calls])
  const labels = weekLabels(grouped)
  const data = grouped.map(([, arr]) => arr.length)

  if (data.length === 0) return <EmptyChart text="Geen weekdata" />

  return (
    <Bar
      data={{
        labels,
        datasets: [{
          label: 'Calls',
          data,
          backgroundColor: COLORS.slate,
          ...defaultBarStyle,
        }],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => `${ctx.parsed.y} calls` } },
        },
        scales: {
          y: { ...defaultScaleY, ticks: { ...defaultScaleY.ticks, stepSize: 1 } },
          x: defaultScaleX,
        },
      }}
    />
  )
}

// ── 2. Deal value per week ──

export function DealValuePerWeekChart({ calls }: { calls: Call[] }) {
  const grouped = useMemo(() => groupByWeek(calls), [calls])
  const labels = weekLabels(grouped)
  const data = grouped.map(([, arr]) =>
    arr.filter(c => c.result === 'CLOSED').reduce((sum, c) => sum + (c.deal_value || 0), 0)
  )

  if (data.length === 0) return <EmptyChart text="Geen weekdata" />

  return (
    <Bar
      data={{
        labels,
        datasets: [{
          label: 'Deal value',
          data,
          backgroundColor: COLORS.emerald,
          ...defaultBarStyle,
        }],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: ctx => `€ ${Number(ctx.parsed.y).toLocaleString('nl-NL')}` },
          },
        },
        scales: {
          y: { ...defaultScaleY, ticks: eurTicks },
          x: defaultScaleX,
        },
      }}
    />
  )
}

// ── 3. Cash collected per week ──

export function CashPerWeekChart({ calls }: { calls: Call[] }) {
  const grouped = useMemo(() => groupByWeek(calls), [calls])
  const labels = weekLabels(grouped)
  const data = grouped.map(([, arr]) =>
    arr.reduce((sum, c) => sum + (c.cash_collected || 0), 0)
  )

  if (data.length === 0) return <EmptyChart text="Geen weekdata" />

  return (
    <Bar
      data={{
        labels,
        datasets: [{
          label: 'Cash collected',
          data,
          backgroundColor: COLORS.blue,
          ...defaultBarStyle,
        }],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: ctx => `€ ${Number(ctx.parsed.y).toLocaleString('nl-NL')}` },
          },
        },
        scales: {
          y: { ...defaultScaleY, ticks: eurTicks },
          x: defaultScaleX,
        },
      }}
    />
  )
}

// ── 4. Closing rate per week ──

export function ClosingRatePerWeekChart({ calls }: { calls: Call[] }) {
  const grouped = useMemo(() => groupByWeek(calls), [calls])
  const labels = weekLabels(grouped)
  const data = grouped.map(([, arr]) => {
    const total = arr.length
    const closed = arr.filter(c => c.result === 'CLOSED').length
    return total > 0 ? Math.round((closed / total) * 1000) / 10 : 0
  })

  if (data.length === 0) return <EmptyChart text="Geen weekdata" />

  return (
    <Bar
      data={{
        labels,
        datasets: [{
          label: 'Closing rate',
          data,
          backgroundColor: COLORS.amber,
          ...defaultBarStyle,
        }],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => `${ctx.parsed.y}%` } },
        },
        scales: {
          y: {
            ...defaultScaleY,
            ticks: {
              font: { size: 11 as const },
              color: '#94a3b8',
              callback: (v: string | number) => `${v}%`,
            },
          },
          x: defaultScaleX,
        },
      }}
    />
  )
}

// ── Empty state ──

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center h-full">
      <span className="text-xs text-gray-400">{text}</span>
    </div>
  )
}
