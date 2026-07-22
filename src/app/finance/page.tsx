'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { KpiCard } from '@/components/ui/card'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { AgingBarChart, CashForecastChart } from '@/components/ui/charts'
import { SkeletonPage } from '@/components/ui/skeleton'
import { MonthlyOverviewChart } from './components/monthly-overview-chart'
import { eur } from '@/lib/format'
import {
  Users, ClipboardCheck, Landmark, ArrowRight,
} from 'lucide-react'

import type {
  FinanceKpis,
  MonthlyData,
  AgingBucket,
  CashForecastWeek,
  AttributionRow,
  Period,
  AttributionDimension,
} from '@/lib/queries/finance-overview'

// ── Types ──

interface DashboardData {
  kpis: FinanceKpis
  monthly: MonthlyData[]
  aging: AgingBucket[]
  forecast: CashForecastWeek[]
  attribution: AttributionRow[]
}

// ── Constants ──

const iconProps = { strokeWidth: 1.75 } as const

const PERIODS: { value: Period; label: string }[] = [
  { value: 'all', label: 'All Time' },
  { value: 'year', label: 'Dit jaar' },
  { value: 'quarter', label: 'Kwartaal' },
  { value: 'month', label: 'Maand' },
]

const ATTRIBUTION_TABS: { value: AttributionDimension; label: string }[] = [
  { value: 'closer', label: 'Closer' },
  { value: 'setter', label: 'Setter' },
  { value: 'source', label: 'Source' },
]

// ── Component ──

export default function FinancePage() {
  const [period, setPeriod] = useState<Period>('all')
  const [includeLegacy, setIncludeLegacy] = useState(true)
  const [attrDimension, setAttrDimension] = useState<AttributionDimension>('closer')
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(() => {
    setLoading(true)
    const legacy = includeLegacy ? 'all' : 'active'
    fetch(`/api/finance/overview?period=${period}&legacy=${legacy}&attribution=${attrDimension}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false))
  }, [period, includeLegacy, attrDimension])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading && !data) return <SkeletonPage />

  const k = data?.kpis

  return (
    <div>
      {/* ── Header ── */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Finance</h1>
          <p className="text-sm text-gray-500 mt-0.5">Overzicht van cashflow, inning en attributie</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Period pills */}
          <div className="flex rounded-lg border border-gray-200 bg-white p-0.5">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors duration-[120ms] ${
                  period === p.value
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {/* Legacy toggle */}
          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={!includeLegacy}
              onChange={(e) => setIncludeLegacy(!e.target.checked)}
              className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
            />
            Excl. legacy
          </label>
        </div>
      </div>

      {/* ── KPI Grid (2 rows × 5 cols) ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {/* Row 1: Volume */}
        <KpiCard label="Total contracts" value={k?.totalContracts ?? 0} />
        <KpiCard label="Total deal value" value={eur(k?.totalDealValue ?? 0)} />
        <KpiCard label="Cash collected" value={eur(k?.cashCollected ?? 0)} />
        <KpiCard
          label="Open amount"
          value={eur(k?.openAmount ?? 0)}
          caption={`${k?.openCount ?? 0} termijnen`}
        />
        <KpiCard
          label="Gem. LTV"
          value={eur(k?.avgLtv ?? 0)}
          caption={`totaal: ${eur(k?.totalLtv ?? 0)}`}
        />
        {/* Row 2: Health */}
        <KpiCard
          label="Paid first deposits"
          value={eur(k?.paidFirstDepositsAmount ?? 0)}
          caption={`${k?.paidFirstDepositsCount ?? 0} deposits`}
          captionColor="success"
        />
        <KpiCard
          label="Pending installments"
          value={eur(k?.pendingAmount ?? 0)}
          caption={`${k?.pendingCount ?? 0} termijnen`}
          captionColor="warning"
        />
        <KpiCard
          label="Late installments"
          value={eur(k?.lateAmount ?? 0)}
          caption={`${k?.lateCount ?? 0} termijnen`}
          captionColor={(k?.lateCount ?? 0) > 0 ? 'danger' : 'default'}
        />
        <KpiCard
          label="Paid installments"
          value={eur(k?.paidInstallmentsAmount ?? 0)}
          caption={`${k?.paidInstallmentsCount ?? 0} termijnen`}
          captionColor="success"
        />
        <KpiCard
          label="Collection rate"
          value={`${k?.collectionRate ?? 0}%`}
          caption={`cash/deal: ${k?.cashVsDeal ?? 0}%`}
        />
      </div>

      {/* ── Monthly Overview Chart ── */}
      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-sm font-semibold text-gray-900">Maandoverzicht (12 maanden)</h2>
        </CardHeader>
        <CardContent>
          <div className="h-[320px]">
            {data?.monthly && (
              <MonthlyOverviewChart
                labels={data.monthly.map((m) => m.month)}
                dealValue={data.monthly.map((m) => m.dealValue)}
                cash={data.monthly.map((m) => m.cash)}
                open={data.monthly.map((m) => m.open)}
                late={data.monthly.map((m) => m.late)}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Bottom 2-column grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Left: Cash Forecast + Aging + Links ── */}
        <div className="space-y-6">
          {/* Cash Forecast */}
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-gray-900">Cash Forecast (12 weken)</h2>
            </CardHeader>
            <CardContent>
              <div className="h-[220px]">
                {data?.forecast && (
                  <CashForecastChart
                    labels={data.forecast.map((w) => w.weekLabel)}
                    data={data.forecast.map((w) => w.amount)}
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Aging */}
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-gray-900">Ouderdom openstaand</h2>
            </CardHeader>
            <CardContent>
              <div className="h-[220px]">
                {data?.aging && (
                  <AgingBarChart
                    labels={data.aging.map((b) => b.label)}
                    data={data.aging.map((b) => b.amount)}
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick links */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <QuickLink href="/finance/accounts" icon={Users} label="Accounts" />
            <QuickLink href="/finance/collections" icon={Landmark} label="Collections" />
            <QuickLink href="/finance/verificatie" icon={ClipboardCheck} label="Verificatie" />
          </div>
        </div>

        {/* ── Right: Attribution ── */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Omzet-attributie</h2>
            <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
              {ATTRIBUTION_TABS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setAttrDimension(t.value)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors duration-[120ms] ${
                    attrDimension === t.value
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {data?.attribution && data.attribution.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-5 py-3">Naam</th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wide px-5 py-3">Cash</th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wide px-5 py-3">Deal Value</th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wide px-5 py-3">Gem. LTV</th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wide px-5 py-3">Open</th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wide px-5 py-3">Accounts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.attribution.map((row, i) => (
                      <tr
                        key={row.id ?? row.name}
                        className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors duration-[120ms] ${
                          i % 2 === 0 ? '' : 'bg-gray-50/30'
                        }`}
                      >
                        <td className="px-5 py-3 font-medium text-gray-900">{row.name}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-gray-700">{eur(row.cash)}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-gray-700">{eur(row.dealValue)}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-gray-700">{eur(row.avgLtv)}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-gray-700">{eur(row.openAmount)}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-gray-500">{row.accountCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center text-sm text-gray-400">
                Geen attributiedata beschikbaar
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ── Quick link component ──

function QuickLink({
  href,
  icon: Icon,
  label,
}: {
  href: string
  icon: typeof Users
  label: string
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 transition-colors duration-[120ms]"
    >
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
          <Icon className="w-4 h-4 text-gray-500" {...iconProps} />
        </div>
        <span className="text-sm font-medium text-gray-900">{label}</span>
      </div>
      <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 transition-colors" {...iconProps} />
    </Link>
  )
}
