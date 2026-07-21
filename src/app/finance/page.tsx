'use client'

import { useState, useEffect, useMemo } from 'react'
import { SkeletonPage } from '@/components/ui/skeleton'
import { KpiCard } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { eur, formatDate } from '@/lib/format'
import { getOpenInstallments, type Installment } from '@/lib/queries/sales'
import { getLatestFinanceEod, type FinanceEodAnswers } from '@/lib/queries/eod-finance'
import {
  DollarSign, AlertTriangle, Clock, TrendingDown,
  ExternalLink, ArrowUpDown, ClipboardList,
} from 'lucide-react'

const iconProps = { strokeWidth: 1.75 } as const

type PeriodFilter = '7d' | '30d' | 'all'

interface PaymentRow {
  id: string
  amount: number | null
  paid: boolean
  legacy: boolean
  payment_date: string | null
  payment_number: number | null
  client_id: string | null
}

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

export default function FinancePage() {
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [installments, setInstallments] = useState<Installment[]>([])
  const [eod, setEod] = useState<{ report_date: string; submitted_name: string; answers: FinanceEodAnswers } | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<PeriodFilter>('30d')
  const [sortKey, setSortKey] = useState<'due_date' | 'amount'>('due_date')

  useEffect(() => {
    Promise.all([
      supabase.from('payments').select('id, amount, paid, legacy, payment_date, payment_number, client_id'),
      getOpenInstallments(),
      getLatestFinanceEod(),
    ]).then(([paymentsRes, instData, eodData]) => {
      setPayments((paymentsRes.data || []) as PaymentRow[])
      setInstallments(instData)
      setEod(eodData)
      setLoading(false)
    })
  }, [])

  // Filter payments by period
  const filteredPayments = useMemo(() => {
    const active = payments.filter((p) => !p.legacy)
    if (period === 'all') return active
    const days = period === '7d' ? 7 : 30
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const cutoffStr = cutoff.toISOString().split('T')[0]
    return active.filter((p) => p.payment_date && p.payment_date >= cutoffStr)
  }, [payments, period])

  // KPI calculations
  const totalCashIn = useMemo(
    () => filteredPayments.filter((p) => p.paid).reduce((s, p) => s + (p.amount || 0), 0),
    [filteredPayments],
  )
  const totalOpenInstallments = useMemo(
    () => installments.reduce((s, i) => s + (i.amount || 0), 0),
    [installments],
  )
  const lateInstallments = useMemo(() => installments.filter(isLate), [installments])
  const lateCount = lateInstallments.length
  const lateBedrag = useMemo(
    () => lateInstallments.reduce((s, i) => s + (i.amount || 0), 0),
    [lateInstallments],
  )

  // Sort late installments
  const sortedLate = useMemo(() => {
    const list = [...lateInstallments]
    list.sort((a, b) => {
      if (sortKey === 'due_date') return (a.due_date || '').localeCompare(b.due_date || '')
      return (b.amount || 0) - (a.amount || 0)
    })
    return list
  }, [lateInstallments, sortKey])

  if (loading) return <SkeletonPage />

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Finance</h1>
          <p className="text-sm text-gray-500 mt-0.5">Overzicht betalingen & termijnen</p>
        </div>
        <div className="flex items-center rounded-lg border border-gray-200 bg-white overflow-hidden">
          {([
            ['7d', '7 dagen'],
            ['30d', '30 dagen'],
            ['all', 'Alles'],
          ] as [PeriodFilter, string][]).map(([value, label]) => (
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
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Cash-in"
          value={eur(totalCashIn)}
          caption={period === 'all' ? 'Totaal' : `Afgelopen ${period === '7d' ? '7' : '30'} dagen`}
          captionColor="success"
        />
        <KpiCard
          label="Termijnen openstaand"
          value={eur(totalOpenInstallments)}
          caption={`${installments.length} termijnen`}
        />
        <KpiCard
          label="Te laat"
          value={lateCount}
          caption={eur(lateBedrag)}
          captionColor={lateCount > 0 ? 'danger' : 'default'}
        />
        <KpiCard
          label="Refunds (EOD)"
          value={eod?.answers?.refunds?.aantal_refunds ?? '—'}
          caption={
            eod?.answers?.refunds?.bedrag_refunds != null
              ? eur(eod.answers.refunds.bedrag_refunds)
              : '—'
          }
          captionColor={
            eod?.answers?.refunds?.bedrag_refunds && eod.answers.refunds.bedrag_refunds > 0
              ? 'warning'
              : 'default'
          }
        />
      </div>

      {/* EOD summary */}
      {eod && (
        <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList className="w-4 h-4 text-gray-400" {...iconProps} />
            <h2 className="text-sm font-semibold text-gray-900">
              Laatste Finance EOD
            </h2>
            <span className="text-xs text-gray-400 ml-auto">
              {formatDate(eod.report_date)} &middot; {eod.submitted_name}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Geïncasseerd</span>
              <div className="font-semibold text-gray-900 tabular-nums">
                {eur(eod.answers?.cash?.totaal_geincasseerd)}
              </div>
            </div>
            <div>
              <span className="text-gray-500">Failed payments</span>
              <div className="font-semibold text-gray-900 tabular-nums">
                {eod.answers?.mislukt?.aantal_failed ?? '—'}
              </div>
            </div>
            <div>
              <span className="text-gray-500">Bedrag hersteld</span>
              <div className="font-semibold text-emerald-600 tabular-nums">
                {eur(eod.answers?.mislukt?.bedrag_hersteld)}
              </div>
            </div>
            <div>
              <span className="text-gray-500">Chargebacks</span>
              <div className="font-semibold text-gray-900 tabular-nums">
                {eod.answers?.refunds?.aantal_chargebacks ?? '—'}
              </div>
            </div>
            <div>
              <span className="text-gray-500">Openstaand risico</span>
              <div className="font-semibold text-red-600 tabular-nums">
                {eur(eod.answers?.mislukt?.openstaand_risico)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Late installments table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" {...iconProps} />
            <h2 className="text-sm font-semibold text-gray-900">
              Achterstallige termijnen
            </h2>
            <span className="text-xs text-gray-400">({lateCount})</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <ArrowUpDown className="w-3.5 h-3.5" {...iconProps} />
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as 'due_date' | 'amount')}
              className="h-8 text-sm border border-gray-200 rounded-lg px-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-accent-500"
            >
              <option value="due_date">Vervaldatum</option>
              <option value="amount">Bedrag</option>
            </select>
          </div>
        </div>

        {/* Table header */}
        <div className="grid grid-cols-[1fr_1fr_80px_100px_100px_80px_80px] gap-4 px-5 py-3 border-b border-gray-100 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
          <div>Student</div>
          <div>Closer</div>
          <div className="text-center">Termijn</div>
          <div className="text-right">Bedrag</div>
          <div>Vervaldatum</div>
          <div className="text-center">Dagen</div>
          <div></div>
        </div>

        {/* Table body */}
        {sortedLate.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Clock className="w-8 h-8 text-gray-200 mx-auto mb-3" {...iconProps} />
            <p className="text-sm text-gray-400">Geen achterstallige termijnen</p>
          </div>
        ) : (
          sortedLate.map((inst) => {
            const days = daysBetween(inst.due_date)
            return (
              <div
                key={inst.id}
                className="grid grid-cols-[1fr_1fr_80px_100px_100px_80px_80px] gap-4 px-5 py-3.5 border-b border-gray-50 items-center hover:bg-gray-50 transition-colors duration-[120ms]"
              >
                <div className="text-sm font-medium text-gray-900 truncate">
                  {inst.call?.name || 'Onbekend'}
                </div>
                <div className="text-sm text-gray-700 truncate">
                  {inst.call?.closer?.name || '—'}
                </div>
                <div className="text-center">
                  <span className="text-sm text-gray-900 tabular-nums font-medium">
                    #{inst.installment_number}
                  </span>
                </div>
                <div className="text-sm text-right tabular-nums font-medium text-gray-900">
                  {inst.amount != null ? eur(inst.amount) : '—'}
                </div>
                <div className="text-sm text-gray-700 tabular-nums">
                  {inst.due_date
                    ? new Date(inst.due_date).toLocaleDateString('nl-NL', {
                        day: 'numeric',
                        month: 'short',
                      })
                    : '—'}
                </div>
                <div className="text-center">
                  {days !== null && (
                    <span className="inline-flex items-center text-[11px] font-semibold rounded-md px-2 py-0.5 tabular-nums text-red-600 bg-red-50">
                      {Math.abs(days)}d
                    </span>
                  )}
                </div>
                <div className="text-center">
                  {inst.whop_link ? (
                    <a
                      href={inst.whop_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-accent-700 hover:text-accent-800 font-medium transition-colors duration-[120ms]"
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
