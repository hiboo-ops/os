'use client'

import { useState, useEffect, useMemo } from 'react'
import { SkeletonPage } from '@/components/ui/skeleton'
import { eur } from '@/lib/format'
import { getAllCalls, calculateMetrics } from '@/lib/queries/sales'
import type { Call, CallFilters } from '@/lib/queries/sales'
import { ScreenHeader, SegmentedControl, Panel } from '@/components/ui/industry-ui'
import { KpiStrip, KpiCell } from '@/components/ui/kpi-strip'
import { SteelBars, SteelArea, Sparkline, SegmentBar } from '@/components/ui/industry-charts'

type TimePeriod = 'all' | 'week' | 'month' | 'custom'

function getWeekNumber(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 1)
  const diff = d.getTime() - start.getTime() + ((start.getTimezoneOffset() - d.getTimezoneOffset()) * 60000)
  return Math.ceil((diff / 86400000 + start.getDay() + 1) / 7)
}

function getPreviousPeriodFilters(period: TimePeriod, dateFrom: string, dateTo: string): CallFilters {
  const now = new Date()
  switch (period) {
    case 'week': { const w = getWeekNumber(now); return { week: w > 1 ? w - 1 : 52 } }
    case 'month': { const m = now.getMonth() + 1; return { month: m > 1 ? m - 1 : 12 } }
    case 'custom': {
      if (!dateFrom || !dateTo) return {}
      const from = new Date(dateFrom), to = new Date(dateTo)
      const rangeMs = to.getTime() - from.getTime()
      const prevTo = new Date(from.getTime() - 1)
      const prevFrom = new Date(prevTo.getTime() - rangeMs)
      return { dateFrom: prevFrom.toISOString().split('T')[0], dateTo: prevTo.toISOString().split('T')[0] }
    }
    default: return {}
  }
}

function getCurrentPeriodFilters(period: TimePeriod, dateFrom: string, dateTo: string): CallFilters {
  const now = new Date()
  switch (period) {
    case 'week': return { week: getWeekNumber(now) }
    case 'month': return { month: now.getMonth() + 1 }
    case 'custom': return dateFrom && dateTo ? { dateFrom, dateTo } : {}
    default: return {}
  }
}

const selectCls = 'h-9 text-[12.5px] font-body border border-divider px-3 bg-white text-ink/70 focus:outline-none focus:ring-2 focus:ring-accent appearance-none cursor-pointer'

export default function SalesOverview() {
  const [allCalls, setAllCalls] = useState<Call[]>([])
  const [contractMix, setContractMix] = useState<{
    contracts: { call_id: string | null; count: number; deal_value: number }[]
    cashByCall: Record<string, number>
  }>({ contracts: [], cashByCall: {} })
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<TimePeriod>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [closerFilter, setCloserFilter] = useState('')

  useEffect(() => {
    getAllCalls().then(data => { setAllCalls(data); setLoading(false) })
    fetch('/api/sales/contract-mix').then(r => r.json()).then(d => { if (d && d.contracts) setContractMix(d) }).catch(() => {})
  }, [])

  const closers = useMemo(() => [...new Set(allCalls.map(c => c.closer?.name).filter(Boolean))].sort() as string[], [allCalls])

  const filteredCalls = useMemo(() => {
    let calls = allCalls
    if (closerFilter) calls = calls.filter(c => c.closer?.name === closerFilter)
    if (sourceFilter) calls = calls.filter(c => c.source === sourceFilter)
    if (typeFilter) calls = calls.filter(c => c.source_type === typeFilter)
    const f = getCurrentPeriodFilters(period, dateFrom, dateTo)
    if (f.week) calls = calls.filter(c => c.week === f.week)
    if (f.month) calls = calls.filter(c => c.month === f.month)
    if (f.dateFrom) calls = calls.filter(c => c.date_start_time && c.date_start_time >= f.dateFrom!)
    if (f.dateTo) calls = calls.filter(c => c.date_start_time && c.date_start_time <= f.dateTo! + 'T23:59:59')
    return calls
  }, [allCalls, period, dateFrom, dateTo, sourceFilter, typeFilter, closerFilter])

  const previousCalls = useMemo(() => {
    if (period === 'all') return []
    let calls = allCalls
    if (closerFilter) calls = calls.filter(c => c.closer?.name === closerFilter)
    if (sourceFilter) calls = calls.filter(c => c.source === sourceFilter)
    if (typeFilter) calls = calls.filter(c => c.source_type === typeFilter)
    const f = getPreviousPeriodFilters(period, dateFrom, dateTo)
    if (f.week) calls = calls.filter(c => c.week === f.week)
    if (f.month) calls = calls.filter(c => c.month === f.month)
    if (f.dateFrom) calls = calls.filter(c => c.date_start_time && c.date_start_time >= f.dateFrom!)
    if (f.dateTo) calls = calls.filter(c => c.date_start_time && c.date_start_time <= f.dateTo! + 'T23:59:59')
    return calls
  }, [allCalls, period, dateFrom, dateTo, sourceFilter, typeFilter, closerFilter])

  const metrics = useMemo(() => calculateMetrics(filteredCalls), [filteredCalls])
  const prevMetrics = useMemo(() => calculateMetrics(previousCalls), [previousCalls])

  const contractMixStats = useMemo(() => {
    const ids = new Set(filteredCalls.map(c => c.id))
    const relevant = contractMix.contracts.filter(c => c.call_id && ids.has(c.call_id))
    const total = relevant.length
    const split = relevant.filter(c => c.count >= 2).length
    const pif = total - split
    return { total, pif, split, pifPct: total > 0 ? Math.round((pif / total) * 100) : 0, splitPct: total > 0 ? Math.round((split / total) * 100) : 0 }
  }, [contractMix, filteredCalls])

  const { orderValue, cashCollected } = useMemo(() => {
    const ids = new Set(filteredCalls.map(c => c.id))
    const ov = contractMix.contracts.filter(c => c.call_id && ids.has(c.call_id)).reduce((s, c) => s + c.deal_value, 0)
    let cash = 0
    for (const [callId, amount] of Object.entries(contractMix.cashByCall)) if (ids.has(callId)) cash += amount
    return { orderValue: ov, cashCollected: cash }
  }, [contractMix, filteredCalls])

  const weekly = useMemo(() => {
    const map = new Map<number, Call[]>()
    for (const c of filteredCalls) if (c.week != null) { const a = map.get(c.week) || []; a.push(c); map.set(c.week, a) }
    const entries = [...map.entries()].sort((a, b) => a[0] - b[0])
    return {
      labels: entries.map(([w]) => `W${w}`),
      calls: entries.map(([, a]) => a.length),
      dealValue: entries.map(([, a]) => a.filter(c => c.result === 'CLOSED').reduce((s, c) => s + (c.deal_value || 0), 0)),
      cash: entries.map(([, a]) => a.reduce((s, c) => s + (c.cash_collected || 0), 0)),
      closingRate: entries.map(([, a]) => { const t = a.length, cl = a.filter(c => c.result === 'CLOSED').length; return t > 0 ? Math.round((cl / t) * 1000) / 10 : 0 }),
    }
  }, [filteredCalls])

  const sources = useMemo(() => [...new Set(allCalls.map(c => c.source).filter(Boolean))].sort(), [allCalls])
  const types = useMemo(() => [...new Set(allCalls.map(c => c.source_type).filter(Boolean))].sort(), [allCalls])
  const hasPrev = period !== 'all'

  const delta = (cur: number, prev: number): { dir: 'up' | 'down' | 'flat'; txt: string } | undefined => {
    if (!hasPrev || prev === 0) return undefined
    const d = ((cur - prev) / prev) * 100
    return { dir: d > 0.5 ? 'up' : d < -0.5 ? 'down' : 'flat', txt: `${Math.abs(Math.round(d * 10) / 10)}%` }
  }
  const dCalls = delta(metrics.totalCalls, prevMetrics.totalCalls)
  const dClose = delta(metrics.closingRate, prevMetrics.closingRate)
  const dCloseT = delta(metrics.closingRateTaken, prevMetrics.closingRateTaken)

  if (loading) return <SkeletonPage />

  return (
    <div>
      <ScreenHeader
        eyebrow="REVENUE / SALES"
        title="Sales Overview"
        right={
          <span className="font-body text-[12px] text-ink/50">
            <span className="font-heading font-semibold text-ink tabular-nums">{filteredCalls.length}</span> CALLS
            {hasPrev && <span className="text-ink/40"> · VS PREVIOUS PERIOD</span>}
          </span>
        }
      />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <select value={closerFilter} onChange={e => setCloserFilter(e.target.value)} className={selectCls}>
          <option value="">ALL CLOSERS</option>
          {closers.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <SegmentedControl<TimePeriod>
          options={[{ value: 'all', label: 'All' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }, { value: 'custom', label: 'Custom' }]}
          value={period} onChange={setPeriod}
        />
        {period === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={selectCls} />
            <span className="text-ink/40 text-xs">—</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={selectCls} />
          </div>
        )}
        <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} className={selectCls}>
          <option value="">ALL SOURCES</option>
          {sources.map(s => <option key={s} value={s!}>{s}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className={selectCls}>
          <option value="">ALL TYPES</option>
          {types.map(t => <option key={t} value={t!}>{t}</option>)}
        </select>
      </div>

      {/* KPI strip */}
      <div className="mb-6">
        <KpiStrip cols={5}>
          <KpiCell label="Total Calls" value={metrics.totalCalls} delta={dCalls?.txt} deltaDir={dCalls?.dir} caption={`${metrics.closedDeals} deals / ${metrics.totalCalls} calls`} />
          <KpiCell label="Order Value" value={eur(orderValue)} caption={`${contractMixStats.total} contracts`} />
          <KpiCell label="Cash Collected" value={eur(cashCollected)} />
          <KpiCell label="Closing Rate" value={`${metrics.closingRate.toFixed(1)}%`} delta={dClose?.txt} deltaDir={dClose?.dir} caption="booked" />
          <KpiCell label="Closing (Taken)" value={`${metrics.closingRateTaken.toFixed(1)}%`} delta={dCloseT?.txt} deltaDir={dCloseT?.dir} caption="taken" />
          <KpiCell size="sm" label="Show-up Rate" value={`${metrics.showUpRate.toFixed(1)}%`} />
          <KpiCell size="sm" label="Cancel Rate" value={`${metrics.cancelRate.toFixed(1)}%`} />
          <KpiCell size="sm" label="Avg Order Value" value={eur(metrics.avgOrderValue)} />
          <KpiCell size="sm" label="Cash / Call" value={eur(metrics.cashPerCallTaken)} />
          <KpiCell size="sm" label="Paid in Full" value={`${contractMixStats.pifPct}%`} caption={`${contractMixStats.pif}/${contractMixStats.total}`} />
        </KpiStrip>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[22px]">
        <Panel title="Total Calls / Week">
          <div className="h-[190px]">{weekly.labels.length ? <SteelBars labels={weekly.labels} data={weekly.calls} /> : <Empty />}</div>
        </Panel>
        <Panel title="Deal Value / Week">
          <div className="h-[190px]">{weekly.labels.length ? <SteelArea labels={weekly.labels} data={weekly.dealValue} /> : <Empty />}</div>
        </Panel>
        <Panel title="Cash Collected / Week">
          <div className="h-[190px]">{weekly.labels.length ? <SteelBars labels={weekly.labels} data={weekly.cash} /> : <Empty />}</div>
        </Panel>
        <Panel title="Contract Mix & Trend" bodyClass="p-0">
          <div className="grid grid-cols-2 divide-x divide-divider">
            <div className="p-4">
              <div className="font-heading font-semibold uppercase text-[9.5px] tracking-[0.13em] text-ink/50 mb-3">Paid in Full vs Split</div>
              <SegmentBar a={contractMixStats.pif} b={contractMixStats.split} />
              <div className="mt-3 space-y-1.5">
                <LegendRow color="#2c455d" label="Paid in Full" value={`${contractMixStats.pifPct}%`} />
                <LegendRow color="#b5d9fd" label="Split" value={`${contractMixStats.splitPct}%`} />
              </div>
            </div>
            <div className="p-4">
              <div className="font-heading font-semibold uppercase text-[9.5px] tracking-[0.13em] text-ink/50 mb-3">Closing Rate / Week</div>
              <div className="h-[90px]">{weekly.labels.length ? <Sparkline data={weekly.closingRate} /> : <Empty />}</div>
              {weekly.labels.length > 0 && (
                <div className="flex justify-between mt-1 font-heading font-semibold text-[9px] tracking-[0.04em] text-ink/40">
                  <span>{weekly.labels[0]}</span><span>{weekly.labels[weekly.labels.length - 1]}</span>
                </div>
              )}
            </div>
          </div>
        </Panel>
      </div>
    </div>
  )
}

function LegendRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-2.5 h-2.5" style={{ background: color }} />
      <span className="font-heading font-semibold uppercase text-[10px] tracking-[0.06em] text-ink/60 flex-1">{label}</span>
      <span className="font-heading font-semibold tabular-nums text-[12px] text-ink">{value}</span>
    </div>
  )
}

function Empty() {
  return <div className="flex items-center justify-center h-full font-body text-[12px] text-ink/40">No week data</div>
}
