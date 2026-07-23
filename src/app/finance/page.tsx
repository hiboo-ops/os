'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { SkeletonPage } from '@/components/ui/skeleton'
import { Blueprint } from '@/components/ui/blueprint'
import { ScreenHeader, SegmentedControl, Panel } from '@/components/ui/industry-ui'
import { KpiStrip, KpiCell } from '@/components/ui/kpi-strip'
import { SteelBars, GroupedSteelBars, ProgressRow } from '@/components/ui/industry-charts'
import { eur } from '@/lib/format'
import { ArrowRight } from 'lucide-react'
import type {
  FinanceKpis, MonthlyData, AgingBucket, CashForecastWeek, AttributionRow, Period, AttributionDimension,
} from '@/lib/queries/finance-overview'

interface DashboardData {
  kpis: FinanceKpis
  monthly: MonthlyData[]
  aging: AgingBucket[]
  forecast: CashForecastWeek[]
  attribution: AttributionRow[]
}

export default function FinancePage() {
  const [period, setPeriod] = useState<Period>('all')
  const includeLegacy = false
  const [attrDimension, setAttrDimension] = useState<AttributionDimension>('closer')
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(() => {
    setLoading(true)
    const legacy = includeLegacy ? 'all' : 'active'
    fetch(`/api/finance/overview?period=${period}&legacy=${legacy}&attribution=${attrDimension}`)
      .then(r => r.json()).then(d => setData(d)).finally(() => setLoading(false))
  }, [period, attrDimension])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading && !data) return <SkeletonPage />

  const k = data?.kpis
  const monthly = data?.monthly ?? []
  const aging = data?.aging ?? []
  const forecast = data?.forecast ?? []
  const attribution = data?.attribution ?? []
  const maxAging = Math.max(...aging.map(a => a.amount), 1)

  return (
    <div>
      <ScreenHeader
        eyebrow="REVENUE / FINANCE"
        title="Finance Overview"
        right={
          <SegmentedControl<Period>
            options={[{ value: 'all', label: 'All Time' }, { value: 'year', label: 'Year' }, { value: 'quarter', label: 'Quarter' }, { value: 'month', label: 'Month' }]}
            value={period} onChange={setPeriod}
          />
        }
      />

      {/* KPI strip */}
      <div className="mb-6">
        <KpiStrip cols={5}>
          <KpiCell label="Total Contracts" value={k?.totalContracts ?? 0} />
          <KpiCell label="Total Deal Value" value={eur(k?.totalDealValue ?? 0)} />
          <KpiCell label="Cash Collected" value={eur(k?.cashCollected ?? 0)} />
          <KpiCell label="Open Amount" value={eur(k?.openAmount ?? 0)} caption={`${k?.openCount ?? 0} installments`} />
          <KpiCell label="Avg LTV" value={eur(k?.avgLtv ?? 0)} caption={`total: ${eur(k?.totalLtv ?? 0)}`} />
          <KpiCell size="sm" label="Paid First Deposits" value={eur(k?.paidFirstDepositsAmount ?? 0)} caption={`${k?.paidFirstDepositsCount ?? 0} deposits`} />
          <KpiCell size="sm" label="Pending" value={eur(k?.pendingAmount ?? 0)} caption={`${k?.pendingCount ?? 0} installments`} />
          <KpiCell size="sm" label="Late" value={eur(k?.lateAmount ?? 0)} caption={`${k?.lateCount ?? 0} installments`} danger={(k?.lateCount ?? 0) > 0} />
          <KpiCell size="sm" label="Paid Installments" value={eur(k?.paidInstallmentsAmount ?? 0)} caption={`${k?.paidInstallmentsCount ?? 0} installments`} />
          <KpiCell size="sm" label="Collection Rate" value={`${k?.collectionRate ?? 0}%`} caption={`cash/deal: ${k?.cashVsDeal ?? 0}%`} />
        </KpiStrip>
      </div>

      {/* Monthly overview */}
      <Panel
        title="Monthly Overview · 12 Months"
        action={
          <div className="flex items-center gap-4">
            <Legend color="#d6ebff" label="Deal Value" />
            <Legend color="#416180" label="Cash" />
          </div>
        }
        className="mb-6"
      >
        <div className="h-[300px]">
          {monthly.length ? <GroupedSteelBars labels={monthly.map(m => m.month.slice(0, 3).toUpperCase())} a={monthly.map(m => m.dealValue)} b={monthly.map(m => m.cash)} /> : <Empty />}
        </div>
      </Panel>

      {/* Bottom grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.15fr] gap-[22px]">
        {/* Left */}
        <div className="space-y-[22px]">
          <Panel title="Cash Forecast · 12 Weeks">
            <div className="h-[170px]">{forecast.length ? <SteelBars labels={forecast.map(f => f.weekLabel)} data={forecast.map(f => f.amount)} /> : <Empty />}</div>
          </Panel>
          <Panel title="Ageing · Outstanding">
            <div className="space-y-3">
              {aging.length ? aging.map((b, i) => {
                const isDanger = /90/.test(b.label)
                return <ProgressRow key={i} label={b.label} value={eur(b.amount)} pct={(b.amount / maxAging) * 100} danger={isDanger} />
              }) : <Empty />}
            </div>
          </Panel>
          <div className="grid grid-cols-3 gap-[14px]">
            <QuickLink href="/finance/accounts" label="Accounts" />
            <QuickLink href="/finance/collections" label="Collections" />
            <QuickLink href="/finance/verificatie" label="Verification" />
          </div>
        </div>

        {/* Right — attribution */}
        <Panel
          title="Revenue Attribution"
          bodyClass="p-0"
          action={
            <SegmentedControl<AttributionDimension>
              size="sm"
              options={[{ value: 'closer', label: 'Closer' }, { value: 'setter', label: 'Setter' }, { value: 'source', label: 'Source' }]}
              value={attrDimension} onChange={setAttrDimension}
            />
          }
        >
          {attribution.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-divider">
                  {['Name', 'Cash', 'Deal Value', 'Avg LTV', 'Open', 'Acc.'].map((h, i) => (
                    <th key={h} className={`font-heading font-semibold uppercase text-[9.5px] tracking-[0.1em] text-ink/50 px-4 py-2.5 ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {attribution.map((row) => (
                  <tr key={row.id ?? row.name} className="border-b border-divider last:border-0 hover:bg-accent-100/40">
                    <td className="px-4 py-2.5 font-body text-[12.5px] text-ink">{row.name}</td>
                    <td className="px-4 py-2.5 text-right font-body tabular-nums text-[12.5px] text-ink/80">{eur(row.cash)}</td>
                    <td className="px-4 py-2.5 text-right font-body tabular-nums text-[12.5px] text-ink/80">{eur(row.dealValue)}</td>
                    <td className="px-4 py-2.5 text-right font-body tabular-nums text-[12.5px] text-ink/80">{eur(row.avgLtv)}</td>
                    <td className="px-4 py-2.5 text-right font-body tabular-nums text-[12.5px] text-ink/80">{eur(row.openAmount)}</td>
                    <td className="px-4 py-2.5 text-right font-body tabular-nums text-[12.5px] text-ink/40">{row.accountCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-12"><Empty /></div>
          )}
        </Panel>
      </div>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-2.5 h-2.5" style={{ background: color }} />
      <span className="font-heading font-semibold uppercase text-[9.5px] tracking-[0.08em] text-ink/55">{label}</span>
    </span>
  )
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href}>
      <Blueprint className="group flex items-center justify-between px-3.5 py-3 hover:bg-accent-100 transition-colors duration-[120ms]">
        <span className="font-heading font-semibold uppercase text-[11px] tracking-[0.06em] text-ink/70 group-hover:text-accent-800">{label}</span>
        <ArrowRight className="w-3.5 h-3.5 text-ink/30 group-hover:text-accent-700" strokeWidth={1.5} />
      </Blueprint>
    </Link>
  )
}

function Empty() {
  return <div className="flex items-center justify-center h-full min-h-[60px] font-body text-[12px] text-ink/40">No data</div>
}
