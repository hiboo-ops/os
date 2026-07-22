'use client'

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const COLORS = {
  slate: '#334155',
  emerald: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
}

interface MonthlyOverviewChartProps {
  labels: string[]
  dealValue: number[]
  cash: number[]
  open: number[]
  late: number[]
}

export function MonthlyOverviewChart({ labels, dealValue, cash, open, late }: MonthlyOverviewChartProps) {
  return (
    <Bar
      data={{
        labels,
        datasets: [
          {
            label: 'Deal Value',
            data: dealValue,
            backgroundColor: COLORS.slate,
            borderRadius: 5,
            barPercentage: 0.7,
            categoryPercentage: 0.75,
          },
          {
            label: 'Cash',
            data: cash,
            backgroundColor: COLORS.emerald,
            borderRadius: 5,
            barPercentage: 0.7,
            categoryPercentage: 0.75,
          },
          {
            label: 'Open',
            data: open,
            backgroundColor: COLORS.amber,
            borderRadius: 5,
            barPercentage: 0.7,
            categoryPercentage: 0.75,
          },
          {
            label: 'Late',
            data: late,
            backgroundColor: COLORS.red,
            borderRadius: 5,
            barPercentage: 0.7,
            categoryPercentage: 0.75,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top' as const,
            labels: {
              font: { size: 11 },
              usePointStyle: true,
              pointStyle: 'circle',
            },
          },
          tooltip: {
            callbacks: {
              label: (ctx) =>
                `${ctx.dataset.label || ''}: € ${Number(ctx.parsed.y ?? 0).toLocaleString('nl-NL')}`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: '#f1f5f9' },
            ticks: {
              font: { size: 11 },
              color: '#94a3b8',
              callback: (v) => '€' + Number(v).toLocaleString('nl-NL'),
            },
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
