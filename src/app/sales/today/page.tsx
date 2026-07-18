'use client'

import { useState, useEffect, useMemo } from 'react'
import { KpiCard } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SkeletonPage } from '@/components/ui/skeleton'
import { eur } from '@/lib/format'
import { getTodayCalls, calculateMetrics } from '@/lib/queries/sales'
import type { Call } from '@/lib/queries/sales'
import { CallDetail } from '@/components/call-detail'
import {
  Phone, CheckCircle, TrendingUp, DollarSign, Banknote,
  UserX, CalendarX, ChevronLeft, ChevronRight,
} from 'lucide-react'

const iconProps = { strokeWidth: 1.75 } as const

type DayOffset = -1 | 0 | 1
const dayLabels: Record<DayOffset, string> = { [-1]: 'Gisteren', 0: 'Vandaag', 1: 'Morgen' }

function formatFullDate(offset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    return d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return '—'
  }
}

export default function TodayCallsPage() {
  const [calls, setCalls] = useState<Call[]>([])
  const [loading, setLoading] = useState(true)
  const [dayOffset, setDayOffset] = useState<DayOffset>(0)
  const [selectedCall, setSelectedCall] = useState<Call | null>(null)

  const loadCalls = async (offset: DayOffset) => {
    setLoading(true)
    const data = await getTodayCalls(offset)
    setCalls(data)
    setLoading(false)
  }

  useEffect(() => {
    loadCalls(dayOffset)
  }, [dayOffset])

  const metrics = useMemo(() => calculateMetrics(calls), [calls])

  const takenCalls = metrics.totalCalls - metrics.noShows - metrics.cancelled

  if (loading) return <SkeletonPage />

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Calls van {dayLabels[dayOffset].toLowerCase()}</h1>
          <p className="text-sm text-gray-500 mt-0.5 capitalize">{formatFullDate(dayOffset)}</p>
        </div>
      </div>

      {/* Day filter */}
      <div className="flex items-center gap-1.5 mb-6">
        <div className="flex items-center rounded-lg border border-gray-200 bg-white overflow-hidden">
          {([-1, 0, 1] as DayOffset[]).map(offset => (
            <button
              key={offset}
              onClick={() => setDayOffset(offset)}
              className={`px-4 h-9 text-sm transition-colors duration-[120ms] ${
                dayOffset === offset
                  ? 'bg-gray-900 text-white font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {dayLabels[offset]}
            </button>
          ))}
        </div>
        <button
          onClick={() => setDayOffset(Math.max(-1, dayOffset - 1) as DayOffset)}
          disabled={dayOffset === -1}
          className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 transition-colors duration-[120ms]"
        >
          <ChevronLeft className="w-4 h-4" {...iconProps} />
        </button>
        <button
          onClick={() => setDayOffset(Math.min(1, dayOffset + 1) as DayOffset)}
          disabled={dayOffset === 1}
          className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 transition-colors duration-[120ms]"
        >
          <ChevronRight className="w-4 h-4" {...iconProps} />
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-8">
        <KpiCard label="Calls Booked" value={metrics.totalCalls} />
        <KpiCard label="Calls Taken" value={takenCalls} />
        <KpiCard label="Deals Closed" value={metrics.closedDeals} />
        <KpiCard
          label="Close Rate"
          value={`${metrics.closingRateTaken.toFixed(1)}%`}
        />
        <KpiCard label="Deal Value" value={eur(metrics.totalDealValue)} />
        <KpiCard label="Cash Collected" value={eur(metrics.totalCashCollected)} />
        <KpiCard
          label="No Shows"
          value={metrics.noShows}
          caption={metrics.totalCalls > 0 ? `${((metrics.noShows / metrics.totalCalls) * 100).toFixed(0)}%` : undefined}
          captionColor="danger"
        />
        <KpiCard
          label="Cancelled"
          value={metrics.cancelled}
          caption={metrics.totalCalls > 0 ? `${((metrics.cancelled / metrics.totalCalls) * 100).toFixed(0)}%` : undefined}
          captionColor="danger"
        />
      </div>

      {/* Calls table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[80px_1fr_1fr_1fr_1fr_120px_100px] gap-4 px-5 py-3 border-b border-gray-100 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
          <div>Tijd</div>
          <div>Naam</div>
          <div>Closer</div>
          <div>Setter</div>
          <div>Source</div>
          <div>Result</div>
          <div className="text-right">Deal Value</div>
        </div>

        {/* Table body */}
        {calls.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Phone className="w-8 h-8 text-gray-200 mx-auto mb-3" {...iconProps} />
            <p className="text-sm text-gray-400">Geen calls {dayLabels[dayOffset].toLowerCase()}</p>
          </div>
        ) : (
          calls.map(call => (
            <div
              key={call.id}
              onClick={() => setSelectedCall(call)}
              className="grid grid-cols-[80px_1fr_1fr_1fr_1fr_120px_100px] gap-4 px-5 py-3.5 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors duration-[120ms] items-center"
            >
              {/* Tijd */}
              <div className="text-sm text-gray-900 tabular-nums font-medium">
                {formatTime(call.date_start_time)}
              </div>

              {/* Naam + phone */}
              <div>
                <div className="text-sm font-medium text-gray-900 truncate">
                  {call.name || 'Onbekend'}
                </div>
                {call.phone && (
                  <div className="text-xs text-gray-400 tabular-nums">{call.phone}</div>
                )}
              </div>

              {/* Closer */}
              <div className="text-sm text-gray-700 truncate">
                {call.closer?.name || '—'}
              </div>

              {/* Setter */}
              <div className="text-sm text-gray-500 truncate">
                {call.setter?.name || '—'}
              </div>

              {/* Source */}
              <div>
                {call.source ? (
                  <span className="inline-flex text-[10px] font-medium bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">
                    {call.source}
                  </span>
                ) : (
                  <span className="text-sm text-gray-300">—</span>
                )}
              </div>

              {/* Result */}
              <div>
                {call.result ? (
                  <Badge status={call.result} />
                ) : (
                  <span className="text-sm text-gray-300">—</span>
                )}
              </div>

              {/* Deal Value */}
              <div className="text-sm text-right tabular-nums font-medium text-gray-900">
                {call.deal_value ? eur(call.deal_value) : '—'}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Call Detail slide-out */}
      {selectedCall && (
        <CallDetail
          call={selectedCall}
          onClose={() => setSelectedCall(null)}
          onUpdate={() => loadCalls(dayOffset)}
        />
      )}
    </div>
  )
}
