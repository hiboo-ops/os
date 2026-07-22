'use client'

import { useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'
import type { Call } from '@/lib/queries/sales'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend)

const ACCENT = '#334155'

const RESULT_COLORS: Record<string, string> = {
  'CALL BOOKED': '#3b82f6',
  'RESCHEDULE': '#f59e0b',
  'FOLLOW UP': '#f97316',
  'FOLLOW UP LONG TERM': '#ea580c',
  'DEPOSIT': '#8b5cf6',
  'CLOSED': '#10b981',
  'LOST - BROKE': '#9ca3af',
  'LOST - NO INTEREST': '#6b7280',
  'LOST - BAD FIT': '#6b7280',
  'NO SHOW': '#ef4444',
  'CANCELLED BY LEAD': '#d1d5db',
  'CANCELLED BY CLOSER': '#d1d5db',
}

const RESULT_LABELS: Record<string, string> = {
  'CALL BOOKED': 'Geboekt',
  'RESCHEDULE': 'Reschedule',
  'FOLLOW UP': 'Follow-up',
  'FOLLOW UP LONG TERM': 'Follow-up LT',
  'DEPOSIT': 'Deposit',
  'CLOSED': 'Gesloten',
  'LOST - BROKE': 'Lost – Broke',
  'LOST - NO INTEREST': 'Lost – Geen interesse',
  'LOST - BAD FIT': 'Lost – Bad fit',
  'NO SHOW': 'No show',
  'CANCELLED BY LEAD': 'Geannuleerd (lead)',
  'CANCELLED BY CLOSER': 'Geannuleerd (closer)',
}

// ── Deals per week (bar chart) ──

export function DealsPerWeekChart({ calls }: { calls: Call[] }) {
  const { labels, data } = useMemo(() => {
    const weekMap = new Map<number, number>()
    for (const c of calls) {
      if (c.week != null) {
        weekMap.set(c.week, (weekMap.get(c.week) || 0) + 1)
      }
    }
    const sorted = [...weekMap.entries()].sort((a, b) => a[0] - b[0])
    return {
      labels: sorted.map(([w]) => `W${w}`),
      data: sorted.map(([, count]) => count),
    }
  }, [calls])

  if (data.length === 0) return <EmptyChart text="Geen weekdata" />

  return (
    <Bar
      data={{
        labels,
        datasets: [{
          label: 'Calls',
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
            callbacks: { label: ctx => `${ctx.parsed.y} calls` },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: '#f1f5f9' },
            ticks: { font: { size: 11 }, color: '#94a3b8', stepSize: 1 },
          },
          x: {
            grid: { display: false },
            ticks: { font: { size: 11 }, color: '#94a3b8' },
          },
        },
      }}
    />
  )
}

// ── Omzet per closer (horizontal bar chart) ──

export function RevenuePerCloserChart({ calls }: { calls: Call[] }) {
  const { labels, data } = useMemo(() => {
    const closerMap = new Map<string, number>()
    for (const c of calls) {
      if (c.result === 'CLOSED' && c.closer?.name && c.deal_value) {
        closerMap.set(c.closer.name, (closerMap.get(c.closer.name) || 0) + c.deal_value)
      }
    }
    const sorted = [...closerMap.entries()].sort((a, b) => b[1] - a[1])
    return {
      labels: sorted.map(([name]) => name),
      data: sorted.map(([, value]) => value),
    }
  }, [calls])

  if (data.length === 0) return <EmptyChart text="Geen deals" />

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
        indexAxis: 'y' as const,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => `€ ${Number(ctx.parsed.x).toLocaleString('nl-NL')}`,
            },
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: '#f1f5f9' },
            ticks: {
              font: { size: 11 },
              color: '#94a3b8',
              callback: v => '€' + Number(v).toLocaleString('nl-NL'),
            },
          },
          y: {
            grid: { display: false },
            ticks: { font: { size: 11 }, color: '#94a3b8' },
          },
        },
      }}
    />
  )
}

// ── Resultaat verdeling (doughnut chart) ──

export function ResultVerdelingChart({ calls }: { calls: Call[] }) {
  const { labels, data, colors } = useMemo(() => {
    const resultMap = new Map<string, number>()
    for (const c of calls) {
      const result = c.result || 'CALL BOOKED'
      resultMap.set(result, (resultMap.get(result) || 0) + 1)
    }
    // Filter out results with 0 count
    const entries = [...resultMap.entries()].filter(([, count]) => count > 0)
    return {
      labels: entries.map(([r]) => RESULT_LABELS[r] || r),
      data: entries.map(([, count]) => count),
      colors: entries.map(([r]) => RESULT_COLORS[r] || '#d1d5db'),
    }
  }, [calls])

  if (data.length === 0) return <EmptyChart text="Geen data" />

  return (
    <Doughnut
      data={{
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: '#ffffff',
        }],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
        plugins: {
          legend: {
            display: true,
            position: 'right' as const,
            labels: {
              font: { size: 11 },
              color: '#64748b',
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 12,
              generateLabels: (chart) => {
                const dataset = chart.data.datasets[0]
                return (chart.data.labels || []).map((label, i) => ({
                  text: `${label}  (${dataset.data[i]})`,
                  fillStyle: (dataset.backgroundColor as string[])[i],
                  strokeStyle: '#ffffff',
                  lineWidth: 0,
                  hidden: false,
                  index: i,
                }))
              },
            },
          },
          tooltip: {
            callbacks: {
              label: ctx => {
                const total = (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0)
                const pct = total > 0 ? Math.round((ctx.parsed / total) * 100) : 0
                return ` ${ctx.label}: ${ctx.parsed} (${pct}%)`
              },
            },
          },
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
