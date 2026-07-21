'use client'

import { useState, useEffect, useCallback } from 'react'
import { KpiCard } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SlideOver } from '@/components/ui/slide-over'
import {
  RefreshCw, ChevronDown, Search, RotateCcw, AlertTriangle,
} from 'lucide-react'

const iconProps = { strokeWidth: 1.75 } as const

const SOURCES = ['calendly', 'twilio', 'slack', 'openai', 'anthropic', 'internal'] as const
const DIRECTIONS = ['INBOUND', 'OUTBOUND', 'CRON', 'INTERNAL'] as const
const STATUSES = ['SUCCESS', 'FAILED', 'PENDING', 'RETRYING', 'SKIPPED'] as const

interface ApiEvent {
  id: string
  created_at: string
  direction: string
  source: string
  action: string | null
  event_type: string | null
  status: string
  http_status: number | null
  duration_ms: number | null
  retry_count: number
  error: string | null
}

interface ApiEventDetail extends ApiEvent {
  payload: Record<string, unknown> | null
  idempotency_key: string | null
  related_type: string | null
  related_id: string | null
  updated_at: string
}

interface Kpis {
  total_24h: number
  total_7d: number
  failed_24h: number
  success_rate: number
}

interface Cursor {
  cursor: string
  cursorId: string
}

function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch { return dateStr }
}

function statusColor(s: string): string {
  switch (s) {
    case 'SUCCESS': return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'FAILED': return 'bg-red-50 text-red-700 border-red-200'
    case 'PENDING': return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'RETRYING': return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'SKIPPED': return 'bg-gray-50 text-gray-500 border-gray-200'
    default: return 'bg-gray-50 text-gray-600 border-gray-200'
  }
}

export function ApiCallsTab() {
  const [kpis, setKpis] = useState<Kpis | null>(null)
  const [events, setEvents] = useState<ApiEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<Cursor | null>(null)
  const [detail, setDetail] = useState<ApiEventDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Filters
  const [source, setSource] = useState('')
  const [direction, setDirection] = useState('')
  const [status, setStatus] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [search, setSearch] = useState('')

  const loadKpis = useCallback(async () => {
    const res = await fetch('/api/api-events?mode=kpis').then(r => r.json()).catch(() => null)
    if (res) setKpis(res)
  }, [])

  const loadEvents = useCallback(async (append = false, cursor?: Cursor) => {
    if (append) setLoadingMore(true)
    else setLoading(true)

    const params = new URLSearchParams()
    if (source) params.set('source', source)
    if (direction) params.set('direction', direction)
    if (status) params.set('status', status)
    if (dateFrom) params.set('dateFrom', dateFrom)
    if (dateTo) params.set('dateTo', dateTo)
    if (search) params.set('search', search)
    if (cursor) {
      params.set('cursor', cursor.cursor)
      params.set('cursorId', cursor.cursorId)
    }

    const res = await fetch(`/api/api-events?${params}`).then(r => r.json()).catch(() => ({ items: [], hasMore: false }))

    if (append) {
      setEvents(prev => [...prev, ...(res.items || [])])
    } else {
      setEvents(res.items || [])
    }
    setHasMore(res.hasMore || false)
    setNextCursor(res.nextCursor || null)
    setLoading(false)
    setLoadingMore(false)
  }, [source, direction, status, dateFrom, dateTo, search])

  useEffect(() => {
    loadKpis()
    loadEvents()
  }, [loadKpis, loadEvents])

  const handleLoadMore = () => {
    if (nextCursor) loadEvents(true, nextCursor)
  }

  const openDetail = async (id: string) => {
    setDetailLoading(true)
    const res = await fetch('/api/api-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).then(r => r.json()).catch(() => null)
    if (res && res.id) setDetail(res)
    setDetailLoading(false)
  }

  const handleRetry = async (id: string) => {
    await fetch('/api/api-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, retry: true }),
    })
    setDetail(null)
    loadEvents()
    loadKpis()
  }

  const showFailedOnly = () => {
    setStatus('FAILED')
    setSource('')
    setDirection('')
  }

  const clearFilters = () => {
    setSource('')
    setDirection('')
    setStatus('')
    setDateFrom('')
    setDateTo('')
    setSearch('')
  }

  return (
    <div>
      {/* KPI row */}
      {kpis && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          <KpiCard label="Events 24u" value={kpis.total_24h} />
          <KpiCard label="Events 7d" value={kpis.total_7d} />
          <KpiCard
            label="Failures 24u"
            value={kpis.failed_24h}
            caption={kpis.failed_24h > 0 ? 'Bekijk failures' : undefined}
            captionColor={kpis.failed_24h > 0 ? 'danger' : 'default'}
          />
          <KpiCard
            label="Success rate"
            value={`${kpis.success_rate}%`}
            captionColor={kpis.success_rate < 95 ? 'warning' : 'success'}
            caption={kpis.success_rate < 95 ? 'Onder target' : 'Op target'}
          />
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <select value={source} onChange={e => setSource(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-accent-700">
          <option value="">Alle sources</option>
          {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={direction} onChange={e => setDirection(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-accent-700">
          <option value="">Alle richtingen</option>
          {DIRECTIONS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-accent-700">
          <option value="">Alle statussen</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-accent-700" />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-accent-700" />
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" {...iconProps} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Zoeken..."
            className="text-xs border border-gray-200 rounded-lg pl-7 pr-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-accent-700 w-40" />
        </div>

        <div className="flex items-center gap-1 ml-auto">
          <button onClick={showFailedOnly}
            className="text-xs text-red-600 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" {...iconProps} /> Failures
          </button>
          <button onClick={clearFilters}
            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 transition-colors">
            Reset
          </button>
          <button onClick={() => { loadEvents(); loadKpis() }}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" {...iconProps} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100">
              <th className="px-4 py-2.5">Tijd</th>
              <th className="px-3 py-2.5">Source</th>
              <th className="px-3 py-2.5">Richting</th>
              <th className="px-3 py-2.5">Action</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5">HTTP</th>
              <th className="px-3 py-2.5">Duur</th>
              <th className="px-3 py-2.5">Retries</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Laden...</td></tr>
            ) : events.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Geen events gevonden</td></tr>
            ) : (
              events.map(ev => (
                <tr key={ev.id}
                  onClick={() => openDetail(ev.id)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors">
                  <td className="px-4 py-2 text-gray-500 tabular-nums whitespace-nowrap">{formatTime(ev.created_at)}</td>
                  <td className="px-3 py-2 text-gray-700 font-medium">{ev.source}</td>
                  <td className="px-3 py-2">
                    <span className="text-[10px] text-gray-500">{ev.direction}</span>
                  </td>
                  <td className="px-3 py-2 text-gray-700">{ev.action || ev.event_type || '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center font-medium rounded-md border leading-none text-[10px] px-1.5 py-0.5 ${statusColor(ev.status)}`}>
                      {ev.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-500 tabular-nums">{ev.http_status || '—'}</td>
                  <td className="px-3 py-2 text-gray-500 tabular-nums">{ev.duration_ms ? `${ev.duration_ms}ms` : '—'}</td>
                  <td className="px-3 py-2 text-gray-500 tabular-nums">{ev.retry_count > 0 ? ev.retry_count : '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center mt-4">
          <Button variant="secondary" size="sm" onClick={handleLoadMore} disabled={loadingMore}>
            <ChevronDown className="w-3.5 h-3.5" {...iconProps} />
            {loadingMore ? 'Laden...' : 'Meer laden'}
          </Button>
        </div>
      )}

      {/* Detail SlideOver */}
      <SlideOver
        open={!!detail || detailLoading}
        onClose={() => setDetail(null)}
        title={detail ? `${detail.source} — ${detail.action || detail.event_type || 'Event'}` : 'Laden...'}
        subtitle={detail ? formatTime(detail.created_at) : undefined}
        footer={detail?.status === 'FAILED' && detail.direction === 'OUTBOUND' ? (
          <Button variant="primary" size="md" onClick={() => handleRetry(detail.id)} className="w-full">
            <RotateCcw className="w-4 h-4" {...iconProps} /> Opnieuw proberen
          </Button>
        ) : undefined}
      >
        {detailLoading && <div className="p-6 text-sm text-gray-400">Laden...</div>}
        {detail && (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Info label="Status">
                <span className={`inline-flex items-center font-medium rounded-md border text-xs px-2 py-0.5 ${statusColor(detail.status)}`}>
                  {detail.status}
                </span>
              </Info>
              <Info label="Richting">{detail.direction}</Info>
              <Info label="Source">{detail.source}</Info>
              <Info label="Action">{detail.action || '—'}</Info>
              <Info label="Event type">{detail.event_type || '—'}</Info>
              <Info label="HTTP status">{detail.http_status || '—'}</Info>
              <Info label="Duur">{detail.duration_ms ? `${detail.duration_ms}ms` : '—'}</Info>
              <Info label="Retries">{detail.retry_count}</Info>
              {detail.idempotency_key && <Info label="Idempotency key">{detail.idempotency_key}</Info>}
              {detail.related_type && <Info label="Gerelateerd">{detail.related_type} / {detail.related_id || '—'}</Info>}
            </div>

            {detail.error && (
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Error</label>
                <pre className="mt-1 text-xs text-red-700 bg-red-50 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">{detail.error}</pre>
              </div>
            )}

            {detail.payload && (
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Payload</label>
                <pre className="mt-1 text-xs text-gray-700 bg-gray-50 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap max-h-80">
                  {JSON.stringify(detail.payload, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </SlideOver>
    </div>
  )
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="text-sm text-gray-900 mt-0.5">{children}</div>
    </div>
  )
}
