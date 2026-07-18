'use client'

import { useState, useEffect, useMemo } from 'react'
import { SkeletonPage } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { eur } from '@/lib/format'
import { getOpenInstallments } from '@/lib/queries/sales'
import type { Installment } from '@/lib/queries/sales'
import {
  AlertTriangle, Clock, DollarSign, ExternalLink, ArrowUpDown,
} from 'lucide-react'

const iconProps = { strokeWidth: 1.75 } as const

type StatusFilter = 'all' | 'late' | 'pending'
type SortKey = 'due_date' | 'amount' | 'name'

function daysBetween(dateStr: string | null): number | null {
  if (!dateStr) return null
  const due = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)
  return Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function isLate(inst: Installment): boolean {
  const days = daysBetween(inst.due_date)
  return days !== null && days < 0
}

function formatDueDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return dateStr
  }
}

export default function InstallmentsPage() {
  const [installments, setInstallments] = useState<Installment[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [closerFilter, setCloserFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('due_date')

  useEffect(() => {
    getOpenInstallments().then(data => {
      setInstallments(data)
      setLoading(false)
    })
  }, [])

  const lateCount = useMemo(() => installments.filter(isLate).length, [installments])
  const pendingCount = useMemo(() => installments.filter(i => !isLate(i)).length, [installments])
  const totalOpen = useMemo(
    () => installments.reduce((sum, i) => sum + (i.amount || 0), 0),
    [installments]
  )

  const closers = useMemo(() => {
    const names = new Set<string>()
    installments.forEach(i => {
      if (i.call?.closer?.name) names.add(i.call.closer.name)
    })
    return [...names].sort()
  }, [installments])

  const filtered = useMemo(() => {
    let list = [...installments]

    if (statusFilter === 'late') {
      list = list.filter(isLate)
    } else if (statusFilter === 'pending') {
      list = list.filter(i => !isLate(i))
    }

    if (closerFilter) {
      list = list.filter(i => i.call?.closer?.name === closerFilter)
    }

    list.sort((a, b) => {
      switch (sortKey) {
        case 'due_date':
          return (a.due_date || '').localeCompare(b.due_date || '')
        case 'amount':
          return (b.amount || 0) - (a.amount || 0)
        case 'name':
          return (a.call?.name || '').localeCompare(b.call?.name || '')
        default:
          return 0
      }
    })

    return list
  }, [installments, statusFilter, closerFilter, sortKey])

  if (loading) return <SkeletonPage />

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Open Termijnen</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          <span className="tabular-nums">{installments.length}</span> openstaande termijnen
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Late */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 border-l-[3px] border-l-red-500">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-red-500" {...iconProps} />
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Te laat</span>
          </div>
          <div className="text-2xl font-semibold text-red-600 tabular-nums">{lateCount}</div>
        </div>

        {/* Pending */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 border-l-[3px] border-l-amber-400">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-amber-500" {...iconProps} />
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">In afwachting</span>
          </div>
          <div className="text-2xl font-semibold text-amber-600 tabular-nums">{pendingCount}</div>
        </div>

        {/* Total Open */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 border-l-[3px] border-l-gray-900">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-gray-500" {...iconProps} />
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Totaal open</span>
          </div>
          <div className="text-2xl font-semibold text-gray-900 tabular-nums">{eur(totalOpen)}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Status filter */}
        <div className="flex items-center rounded-lg border border-gray-200 bg-white overflow-hidden">
          {([
            ['all', 'Alles'],
            ['late', 'Te laat'],
            ['pending', 'In afwachting'],
          ] as [StatusFilter, string][]).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={`px-3 h-9 text-sm transition-colors duration-[120ms] ${
                statusFilter === value
                  ? 'bg-gray-900 text-white font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Closer filter */}
        <select
          value={closerFilter}
          onChange={e => setCloserFilter(e.target.value)}
          className="h-9 text-sm border border-gray-200 rounded-lg px-3 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-accent-500"
        >
          <option value="">Alle closers</option>
          {closers.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Sort */}
        <div className="flex items-center gap-1.5 text-sm text-gray-500">
          <ArrowUpDown className="w-3.5 h-3.5" {...iconProps} />
          <select
            value={sortKey}
            onChange={e => setSortKey(e.target.value as SortKey)}
            className="h-9 text-sm border border-gray-200 rounded-lg px-3 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-accent-500"
          >
            <option value="due_date">Vervaldatum</option>
            <option value="amount">Bedrag</option>
            <option value="name">Naam</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_1fr_1fr_80px_100px_120px_80px_100px_80px] gap-4 px-5 py-3 border-b border-gray-100 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
          <div>Student</div>
          <div>Closer</div>
          <div>Setter</div>
          <div className="text-center">Termijn</div>
          <div className="text-right">Bedrag</div>
          <div>Vervaldatum</div>
          <div className="text-center">Dagen</div>
          <div>Status</div>
          <div></div>
        </div>

        {/* Table body */}
        {filtered.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <DollarSign className="w-8 h-8 text-gray-200 mx-auto mb-3" {...iconProps} />
            <p className="text-sm text-gray-400">Geen openstaande termijnen gevonden</p>
          </div>
        ) : (
          filtered.map(inst => {
            const days = daysBetween(inst.due_date)
            const late = days !== null && days < 0
            const soon = days !== null && days >= 0 && days <= 7
            const daysColor = late
              ? 'text-red-600 bg-red-50'
              : soon
                ? 'text-amber-600 bg-amber-50'
                : 'text-emerald-600 bg-emerald-50'

            return (
              <div
                key={inst.id}
                className="grid grid-cols-[1fr_1fr_1fr_80px_100px_120px_80px_100px_80px] gap-4 px-5 py-3.5 border-b border-gray-50 items-center hover:bg-gray-50 transition-colors duration-[120ms]"
              >
                {/* Student name + email */}
                <div>
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {inst.call?.name || 'Onbekend'}
                  </div>
                </div>

                {/* Closer */}
                <div className="text-sm text-gray-700 truncate">
                  {inst.call?.closer?.name || '—'}
                </div>

                {/* Setter */}
                <div className="text-sm text-gray-500 truncate">
                  {inst.call?.setter?.name || '—'}
                </div>

                {/* Installment # */}
                <div className="text-center">
                  <span className="text-sm text-gray-900 tabular-nums font-medium">
                    #{inst.installment_number}
                  </span>
                </div>

                {/* Amount */}
                <div className="text-sm text-right tabular-nums font-medium text-gray-900">
                  {inst.amount != null ? eur(inst.amount) : '—'}
                </div>

                {/* Due Date */}
                <div className="text-sm text-gray-700 tabular-nums">
                  {formatDueDate(inst.due_date)}
                </div>

                {/* Days */}
                <div className="text-center">
                  {days !== null ? (
                    <span className={`inline-flex items-center text-[11px] font-semibold rounded-md px-2 py-0.5 tabular-nums ${daysColor}`}>
                      {late ? `${Math.abs(days)}d` : `${days}d`}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-300">—</span>
                  )}
                </div>

                {/* Status */}
                <div>
                  <Badge status={inst.status} />
                </div>

                {/* Whop link */}
                <div className="text-center">
                  {inst.whop_link ? (
                    <a
                      href={inst.whop_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-accent-700 hover:text-accent-800 font-medium transition-colors duration-[120ms]"
                      onClick={e => e.stopPropagation()}
                    >
                      <ExternalLink className="w-3 h-3" {...iconProps} />
                      Whop
                    </a>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
