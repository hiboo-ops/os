'use client'

import { useState, useEffect, useMemo } from 'react'
import { KpiCard } from '@/components/ui/card'
import { SkeletonPage } from '@/components/ui/skeleton'
import { eur, formatDate } from '@/lib/format'
import { getAllCalls, calculateMetrics } from '@/lib/queries/sales'
import type { Call, CallFilters, SalesMetrics } from '@/lib/queries/sales'
import {
  Phone, TrendingUp, TrendingDown, DollarSign, Target,
  UserX, CalendarX, ArrowUpRight, ArrowDownRight, Minus,
  Filter, X, User,
} from 'lucide-react'
import { CallsPerWeekChart, DealValuePerWeekChart, CashPerWeekChart, ClosingRatePerWeekChart } from './components/sales-charts'

const iconProps = { strokeWidth: 1.75 } as const

type TimePeriod = 'all' | 'week' | 'month' | 'custom'

function getWeekNumber(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 1)
  const diff = d.getTime() - start.getTime() + ((start.getTimezoneOffset() - d.getTimezoneOffset()) * 60000)
  return Math.ceil((diff / 86400000 + start.getDay() + 1) / 7)
}

function getPreviousPeriodFilters(
  period: TimePeriod,
  dateFrom: string,
  dateTo: string,
): CallFilters {
  const now = new Date()

  switch (period) {
    case 'week': {
      const weekNum = getWeekNumber(now)
      return { week: weekNum > 1 ? weekNum - 1 : 52 }
    }
    case 'month': {
      const m = now.getMonth() + 1
      return { month: m > 1 ? m - 1 : 12 }
    }
    case 'custom': {
      if (!dateFrom || !dateTo) return {}
      const from = new Date(dateFrom)
      const to = new Date(dateTo)
      const rangeMs = to.getTime() - from.getTime()
      const prevTo = new Date(from.getTime() - 1)
      const prevFrom = new Date(prevTo.getTime() - rangeMs)
      return {
        dateFrom: prevFrom.toISOString().split('T')[0],
        dateTo: prevTo.toISOString().split('T')[0],
      }
    }
    default:
      return {}
  }
}

function getCurrentPeriodFilters(
  period: TimePeriod,
  dateFrom: string,
  dateTo: string,
): CallFilters {
  const now = new Date()
  switch (period) {
    case 'week':
      return { week: getWeekNumber(now) }
    case 'month':
      return { month: now.getMonth() + 1 }
    case 'custom':
      if (dateFrom && dateTo) return { dateFrom, dateTo }
      return {}
    default:
      return {}
  }
}

function ChangeIndicator({ current, previous, isPercentage = false, invert = false }: {
  current: number
  previous: number
  isPercentage?: boolean
  invert?: boolean
}) {
  if (previous === 0 && current === 0) return <span className="text-xs text-gray-400">—</span>

  const diff = previous > 0
    ? ((current - previous) / previous) * 100
    : current > 0 ? 100 : 0

  const isPositive = invert ? diff < 0 : diff > 0
  const isNeutral = Math.abs(diff) < 0.5

  if (isNeutral) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-gray-400">
        <Minus className="w-3 h-3" {...iconProps} />
        <span className="tabular-nums">0%</span>
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center gap-0.5 text-xs ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
      {diff > 0
        ? <ArrowUpRight className="w-3 h-3" {...iconProps} />
        : <ArrowDownRight className="w-3 h-3" {...iconProps} />
      }
      <span className="tabular-nums">{Math.abs(Math.round(diff))}%</span>
    </span>
  )
}

export default function SalesOverview() {
  const [allCalls, setAllCalls] = useState<Call[]>([])
  const [contractMix, setContractMix] = useState<{
    contracts: { call_id: string | null; count: number; deal_value: number }[];
    cashByCall: Record<string, number>;
  }>({ contracts: [], cashByCall: {} })
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<TimePeriod>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [closerFilter, setCloserFilter] = useState('')

  useEffect(() => {
    getAllCalls().then(data => {
      setAllCalls(data)
      setLoading(false)
    })
    fetch('/api/sales/contract-mix').then(r => r.json()).then(d => {
      if (d && d.contracts) setContractMix(d)
    }).catch(() => {})
  }, [])

  const closers = useMemo(() =>
    [...new Set(allCalls.map(c => c.closer?.name).filter(Boolean))].sort() as string[],
    [allCalls]
  )

  // Filter calls client-side for responsiveness
  const filteredCalls = useMemo(() => {
    let calls = allCalls

    if (closerFilter) {
      calls = calls.filter(c => c.closer?.name === closerFilter)
    }
    if (sourceFilter) {
      calls = calls.filter(c => c.source === sourceFilter)
    }
    if (typeFilter) {
      calls = calls.filter(c => c.source_type === typeFilter)
    }

    const currentFilters = getCurrentPeriodFilters(period, dateFrom, dateTo)

    if (currentFilters.week) {
      calls = calls.filter(c => c.week === currentFilters.week)
    }
    if (currentFilters.month) {
      calls = calls.filter(c => c.month === currentFilters.month)
    }
    if (currentFilters.dateFrom) {
      calls = calls.filter(c => c.date_start_time && c.date_start_time >= currentFilters.dateFrom!)
    }
    if (currentFilters.dateTo) {
      calls = calls.filter(c => c.date_start_time && c.date_start_time <= currentFilters.dateTo! + 'T23:59:59')
    }

    return calls
  }, [allCalls, period, dateFrom, dateTo, sourceFilter, typeFilter, closerFilter])

  // Previous period calls for comparison
  const previousCalls = useMemo(() => {
    if (period === 'all') return []

    let calls = allCalls
    if (closerFilter) calls = calls.filter(c => c.closer?.name === closerFilter)
    if (sourceFilter) calls = calls.filter(c => c.source === sourceFilter)
    if (typeFilter) calls = calls.filter(c => c.source_type === typeFilter)

    const prevFilters = getPreviousPeriodFilters(period, dateFrom, dateTo)

    if (prevFilters.week) {
      calls = calls.filter(c => c.week === prevFilters.week)
    }
    if (prevFilters.month) {
      calls = calls.filter(c => c.month === prevFilters.month)
    }
    if (prevFilters.dateFrom) {
      calls = calls.filter(c => c.date_start_time && c.date_start_time >= prevFilters.dateFrom!)
    }
    if (prevFilters.dateTo) {
      calls = calls.filter(c => c.date_start_time && c.date_start_time <= prevFilters.dateTo! + 'T23:59:59')
    }

    return calls
  }, [allCalls, period, dateFrom, dateTo, sourceFilter, typeFilter, closerFilter])

  const metrics = useMemo(() => calculateMetrics(filteredCalls), [filteredCalls])
  const prevMetrics = useMemo(() => calculateMetrics(previousCalls), [previousCalls])

  // Contract-mix (PIF vs Split) over de gefilterde calls: 1 termijn = PIF, >=2 = Split.
  const contractMixStats = useMemo(() => {
    const ids = new Set(filteredCalls.map(c => c.id))
    const relevant = contractMix.contracts.filter(c => c.call_id && ids.has(c.call_id))
    const total = relevant.length
    const split = relevant.filter(c => c.count >= 2).length
    const pif = total - split
    return {
      total,
      pif,
      split,
      pifPct: total > 0 ? Math.round((pif / total) * 100) : 0,
      splitPct: total > 0 ? Math.round((split / total) * 100) : 0,
    }
  }, [contractMix, filteredCalls])

  // Order value (som contracts.deal_value) + Cash collected (som betaalde payments)
  // over gefilterde calls — echte bronnen i.p.v. call-velden.
  const { orderValue, cashCollected } = useMemo(() => {
    const ids = new Set(filteredCalls.map(c => c.id))
    const ov = contractMix.contracts
      .filter(c => c.call_id && ids.has(c.call_id))
      .reduce((sum, c) => sum + c.deal_value, 0)
    let cash = 0
    for (const [callId, amount] of Object.entries(contractMix.cashByCall)) {
      if (ids.has(callId)) cash += amount
    }
    return { orderValue: ov, cashCollected: cash }
  }, [contractMix, filteredCalls])

  const sources = useMemo(() => [...new Set(allCalls.map(c => c.source).filter(Boolean))].sort(), [allCalls])
  const types = useMemo(() => [...new Set(allCalls.map(c => c.source_type).filter(Boolean))].sort(), [allCalls])
  const hasPreviousPeriod = period !== 'all'
  const hasActiveFilters = sourceFilter || typeFilter || closerFilter || period !== 'all'

  if (loading) return <SkeletonPage />

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Sales Overview</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            <span className="tabular-nums">{filteredCalls.length}</span> calls
            {period !== 'all' && (
              <span> · vergelijking met vorige periode</span>
            )}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-gray-400" {...iconProps} />
        </div>

        {/* Closer filter */}
        <div className="relative">
          <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" {...iconProps} />
          <select
            value={closerFilter}
            onChange={e => setCloserFilter(e.target.value)}
            className="h-9 text-sm border border-gray-200 rounded-lg pl-8 pr-3 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-accent-500 appearance-none cursor-pointer"
          >
            <option value="">Alle closers</option>
            {closers.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Time period */}
        <div className="flex items-center rounded-lg border border-gray-200 bg-white overflow-hidden">
          {([
            ['all', 'Alles'],
            ['week', 'Week'],
            ['month', 'Maand'],
            ['custom', 'Custom'],
          ] as [TimePeriod, string][]).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setPeriod(value)}
              className={`px-3 h-9 text-sm transition-colors duration-[120ms] ${
                period === value
                  ? 'bg-gray-900 text-white font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {period === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="h-9 text-sm border border-gray-200 rounded-lg px-3 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
            <span className="text-gray-400 text-sm">t/m</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="h-9 text-sm border border-gray-200 rounded-lg px-3 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
          </div>
        )}

        {/* Source filter */}
        <select
          value={sourceFilter}
          onChange={e => setSourceFilter(e.target.value)}
          className="h-9 text-sm border border-gray-200 rounded-lg px-3 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-accent-500"
        >
          <option value="">Alle bronnen</option>
          {sources.map(s => <option key={s} value={s!}>{s}</option>)}
        </select>

        {/* Type filter */}
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="h-9 text-sm border border-gray-200 rounded-lg px-3 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-accent-500"
        >
          <option value="">Alle types</option>
          {types.map(t => <option key={t} value={t!}>{t}</option>)}
        </select>

        {hasActiveFilters && (
          <button
            onClick={() => { setCloserFilter(''); setSourceFilter(''); setTypeFilter(''); setPeriod('all'); setDateFrom(''); setDateTo('') }}
            className="h-9 px-3 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 transition-colors duration-[120ms]"
          >
            <X className="w-3.5 h-3.5" {...iconProps} />
            Reset
          </button>
        )}
      </div>

      {/* KPI Grid: 5 columns x 2 rows */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {/* Row 1 */}
        <MetricCard
          label="Total calls"
          value={metrics.totalCalls}
          prev={hasPreviousPeriod ? prevMetrics.totalCalls : undefined}
          subtitle={`${metrics.closedDeals} deals / ${metrics.totalCalls} calls`}
        />
        <MetricCard
          label="Order value"
          value={eur(orderValue)}
          rawCurrent={orderValue}
          subtitle={`${metrics.closedDeals} deals`}
        />
        <MetricCard
          label="Cash collected"
          value={eur(cashCollected)}
          rawCurrent={cashCollected}
        />
        <MetricCard
          label="Closing rate"
          value={`${metrics.closingRate.toFixed(1)}%`}
          rawCurrent={metrics.closingRate}
          rawPrev={hasPreviousPeriod ? prevMetrics.closingRate : undefined}
          subtitle="geboekt"
        />
        <MetricCard
          label="Closing rate (taken)"
          value={`${metrics.closingRateTaken.toFixed(1)}%`}
          rawCurrent={metrics.closingRateTaken}
          rawPrev={hasPreviousPeriod ? prevMetrics.closingRateTaken : undefined}
          subtitle="genomen"
        />

        {/* Row 2 */}
        <MetricCard
          label="Show-up rate"
          value={`${metrics.showUpRate.toFixed(1)}%`}
          rawCurrent={metrics.showUpRate}
          rawPrev={hasPreviousPeriod ? prevMetrics.showUpRate : undefined}
        />
        <MetricCard
          label="Cancel rate"
          value={`${metrics.cancelRate.toFixed(1)}%`}
          rawCurrent={metrics.cancelRate}
          rawPrev={hasPreviousPeriod ? prevMetrics.cancelRate : undefined}
        />
        <MetricCard
          label="Gem. orderwaarde"
          value={eur(metrics.avgOrderValue)}
          rawCurrent={metrics.avgOrderValue}
          rawPrev={hasPreviousPeriod ? prevMetrics.avgOrderValue : undefined}
        />
        <MetricCard
          label="Cash / call (taken)"
          value={eur(metrics.cashPerCallTaken)}
          rawCurrent={metrics.cashPerCallTaken}
          rawPrev={hasPreviousPeriod ? prevMetrics.cashPerCallTaken : undefined}
        />
        <MetricCard
          label="Cash / call (booked)"
          value={eur(metrics.cashPerCallBooked)}
          rawCurrent={metrics.cashPerCallBooked}
          rawPrev={hasPreviousPeriod ? prevMetrics.cashPerCallBooked : undefined}
        />

        {/* Row 3: contract-mix */}
        <MetricCard
          label="Paid in Full"
          value={`${contractMixStats.pifPct}%`}
          subtitle={`${contractMixStats.pif}/${contractMixStats.total} contracten`}
        />
        <MetricCard
          label="Split (termijnen)"
          value={`${contractMixStats.splitPct}%`}
          subtitle={`${contractMixStats.split}/${contractMixStats.total} contracten`}
        />
      </div>

      {/* Charts: 2x2 grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Total calls per week</h3>
          <div className="h-[260px]">
            <CallsPerWeekChart calls={filteredCalls} />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Deal value per week</h3>
          <div className="h-[260px]">
            <DealValuePerWeekChart calls={filteredCalls} />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Cash collected per week</h3>
          <div className="h-[260px]">
            <CashPerWeekChart calls={filteredCalls} />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Closing rate per week</h3>
          <div className="h-[260px]">
            <ClosingRatePerWeekChart calls={filteredCalls} />
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value, prev, rawCurrent, rawPrev, subtitle }: {
  label: string
  value: string | number
  prev?: number
  rawCurrent?: number
  rawPrev?: number
  subtitle?: string
}) {
  const currentNum = rawCurrent ?? (typeof value === 'number' ? value : 0)
  const previousNum = rawPrev ?? prev
  const showComparison = previousNum !== undefined

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</div>
      <div className="flex items-baseline gap-2">
        <div className="text-2xl font-semibold text-gray-900 tabular-nums">{value}</div>
        {showComparison && <ChangeIndicator current={currentNum} previous={previousNum!} />}
      </div>
      {subtitle && <div className="text-xs text-gray-400 mt-1">{subtitle}</div>}
    </div>
  )
}
