'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import type { UserRole } from '@/lib/auth'
import type { CeoDashboardData } from '@/lib/queries/ceo-dashboard'
import type { Period } from '@/lib/queries/finance-overview'
import { ScreenHeader, Panel, SegmentedControl } from '@/components/ui/industry-ui'
import { KpiStrip, KpiCell } from '@/components/ui/kpi-strip'
import { SteelBars, GroupedSteelBars, Sparkline, SegmentBar, ProgressRow } from '@/components/ui/industry-charts'
import { Tag } from '@/components/ui/tag'
import { eur } from '@/lib/format'
import { SkeletonPage } from '@/components/ui/skeleton'

// Non-admins redirect to their role-specific home
const ROLE_HOME: Partial<Record<UserRole, string>> = {
  CLOSER: '/sales',
  SETTER: '/sales/pipeline',
  FINANCE: '/finance',
  PARTNER_MANAGER: '/partner-manager',
  COACH: '/delivery',
  CREATOR: '/creator-dashboard',
}

type PeriodOption = 'all' | 'year' | 'quarter' | 'month'

const PERIOD_OPTIONS: { value: PeriodOption; label: string }[] = [
  { value: 'month', label: 'MONTH' },
  { value: 'quarter', label: 'QUARTER' },
  { value: 'year', label: 'YEAR' },
  { value: 'all', label: 'ALL' },
]

function deltaStr(today: number, yesterday: number): { delta: string; dir: 'up' | 'down' | 'flat' } {
  const diff = today - yesterday
  if (diff > 0) return { delta: `+${diff}`, dir: 'up' }
  if (diff < 0) return { delta: `${diff}`, dir: 'down' }
  return { delta: '0', dir: 'flat' }
}

function pct(n: number): string {
  return `${n}%`
}

export default function DashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<CeoDashboardData | null>(null)
  const [period, setPeriod] = useState<PeriodOption>('all')
  const [role, setRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async (p: PeriodOption) => {
    try {
      const res = await fetch(`/api/ceo/overview?period=${p}`)
      if (res.status === 401 || res.status === 403) {
        // Not admin — fetch role and redirect
        const meRes = await fetch('/api/me')
        if (meRes.ok) {
          const me = await meRes.json()
          setRole(me.role)
        }
        setLoading(false)
        return
      }
      if (res.ok) {
        const json = await res.json()
        setData(json)
        setRole('ADMIN')
      }
    } catch {
      // ignore
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData(period)
  }, [period, fetchData])

  // Redirect non-admins
  useEffect(() => {
    if (role && role !== 'ADMIN') {
      const home = ROLE_HOME[role]
      if (home) router.push(home)
    }
  }, [role, router])

  if (loading) return <SkeletonPage />

  if (!data) {
    return (
      <div>
        <ScreenHeader eyebrow="OPERATIONS" title="Dashboard" />
        <p className="text-ink/50 text-sm">Geen toegang of geen data beschikbaar.</p>
      </div>
    )
  }

  const callsDelta = deltaStr(data.callsToday, data.callsYesterday)
  const bookedDelta = deltaStr(data.bookedToday, data.bookedYesterday)
  const leadsDelta = deltaStr(data.leadsToday, data.leadsYesterday)

  return (
    <div className="space-y-6">
      <ScreenHeader
        eyebrow="COMMAND CENTER"
        title="CEO Dashboard"
        right={
          <SegmentedControl
            options={PERIOD_OPTIONS}
            value={period}
            onChange={(v) => { setPeriod(v); setLoading(true); fetchData(v) }}
            size="sm"
          />
        }
      />

      {/* ── Core KPIs ── */}
      <KpiStrip cols={6}>
        <KpiCell label="OMZET" value={eur(data.omzet)} size="sm" />
        <KpiCell label="CASH" value={eur(data.cash)} size="sm" />
        <KpiCell label="UPSELL RATE" value={pct(data.upsellRate)} size="sm" />
        <KpiCell label="PIF RATE" value={pct(data.pifRate)} size="sm" />
        <KpiCell label="SPLIT RATE" value={pct(data.splitRate)} size="sm" />
        <KpiCell label="COLLECTION RATE" value={pct(data.collectionRate)} size="sm" />
      </KpiStrip>

      {/* ── Comparisons (today vs yesterday) ── */}
      <Panel title="COMPARISONS — TODAY VS YESTERDAY">
        <div className="grid grid-cols-3 -m-4">
          <KpiCell label="CALLS" value={data.callsToday} delta={callsDelta.delta} deltaDir={callsDelta.dir} caption={`yesterday: ${data.callsYesterday}`} />
          <KpiCell label="NEW BOOKED" value={data.bookedToday} delta={bookedDelta.delta} deltaDir={bookedDelta.dir} caption={`yesterday: ${data.bookedYesterday}`} />
          <KpiCell label="NEW LEADS" value={data.leadsToday} delta={leadsDelta.delta} deltaDir={leadsDelta.dir} caption={`yesterday: ${data.leadsYesterday}`} />
        </div>
      </Panel>

      {/* ── Recurring & Customer ── */}
      <Panel title="RECURRING & CUSTOMER">
        <div className="grid grid-cols-4 -m-4">
          <KpiCell label="MRR" value={eur(data.mrr)} caption="community upsell — not live yet" />
          <KpiCell label="CHURN RATE" value={pct(data.churnRate)} caption={`${data.churnCount} churned / ${data.activeAccountCount} active`} danger={data.churnRate > 10} />
          <KpiCell label="NPS" value={data.nps != null ? data.nps.toFixed(1) : '—'} caption={data.npsCount > 0 ? `${data.npsCount} responses` : 'no data yet'} />
          <KpiCell label="REFUND RATE" value={pct(data.refundRate)} caption={data.refundCount > 0 ? `${data.refundCount} refunds (${eur(data.refundAmount)})` : 'no refunds'} danger={data.refundRate > 5} />
        </div>
      </Panel>

      {/* ── Outstanding ── */}
      <Panel title="OUTSTANDING">
        <div className="grid grid-cols-3 -m-4">
          <KpiCell label="OVERDUE" value={eur(data.outstandingToday)} danger={data.outstandingToday > 0} />
          <KpiCell label="THIS WEEK" value={eur(data.outstandingWeek)} />
          <KpiCell label="THIS MONTH" value={eur(data.outstandingMonth)} />
        </div>
      </Panel>

      {/* ── Financial ── */}
      <div className="grid grid-cols-2 gap-6">
        <Panel title="CASHFLOW (6M)">
          <div className="h-[180px]">
            <GroupedSteelBars
              labels={data.cashflowMonths.map(m => m.month.split(' ')[0])}
              a={data.cashflowMonths.map(m => m.cash)}
              b={data.cashflowMonths.map(m => m.cost)}
            />
          </div>
          <div className="flex items-center gap-4 mt-3 px-1">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2" style={{ background: '#d6ebff' }} />
              <span className="font-heading text-[9.5px] uppercase tracking-wider text-ink/50">Cash</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2" style={{ background: '#416180' }} />
              <span className="font-heading text-[9.5px] uppercase tracking-wider text-ink/50">Cost</span>
            </div>
          </div>
        </Panel>

        <Panel title="PROFIT & LOSS">
          <div className="grid grid-cols-3 -mx-4 -mt-4 mb-4">
            <KpiCell label="REVENUE" value={eur(data.revenue)} size="sm" />
            <KpiCell label="COST" value={eur(data.cost)} size="sm" />
            <KpiCell label="PROFIT" value={eur(data.profit)} size="sm" danger={data.profit < 0} />
          </div>
          {data.costByCategory.length > 0 ? (
            <div className="space-y-2">
              <div className="font-heading font-semibold uppercase text-[9.5px] tracking-[0.13em] text-ink/50">COST BREAKDOWN</div>
              {data.costByCategory.map(c => (
                <ProgressRow
                  key={c.category}
                  label={c.category}
                  value={eur(c.amount)}
                  pct={data.cost > 0 ? (c.amount / data.cost) * 100 : 0}
                />
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-ink/35 font-body">No cost data entered yet.</p>
          )}
        </Panel>
      </div>

      {/* ── Top Performers ── */}
      <div className="grid grid-cols-2 gap-6">
        <Panel title="TOP CLOSERS">
          {data.topClosers.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-divider">
                  <th className="font-heading font-semibold uppercase text-[9.5px] tracking-[0.08em] text-ink/50 text-left pb-2">#</th>
                  <th className="font-heading font-semibold uppercase text-[9.5px] tracking-[0.08em] text-ink/50 text-left pb-2">NAME</th>
                  <th className="font-heading font-semibold uppercase text-[9.5px] tracking-[0.08em] text-ink/50 text-right pb-2">CASH</th>
                </tr>
              </thead>
              <tbody>
                {data.topClosers.map((c, i) => (
                  <tr key={i} className="border-b border-divider last:border-0">
                    <td className="font-heading font-semibold text-[11px] text-ink/40 py-2">{i + 1}</td>
                    <td className="font-body text-[12px] text-ink py-2">{c.name}</td>
                    <td className="font-heading font-semibold tabular-nums text-[12px] text-ink text-right py-2">{eur(c.cash)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-[11px] text-ink/35 font-body">No closer data yet.</p>
          )}
        </Panel>

        <Panel title="TOP CREATORS">
          {data.topCreators.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-divider">
                  <th className="font-heading font-semibold uppercase text-[9.5px] tracking-[0.08em] text-ink/50 text-left pb-2">#</th>
                  <th className="font-heading font-semibold uppercase text-[9.5px] tracking-[0.08em] text-ink/50 text-left pb-2">NAME</th>
                  <th className="font-heading font-semibold uppercase text-[9.5px] tracking-[0.08em] text-ink/50 text-right pb-2">REVENUE</th>
                </tr>
              </thead>
              <tbody>
                {data.topCreators.map((c, i) => (
                  <tr key={i} className="border-b border-divider last:border-0">
                    <td className="font-heading font-semibold text-[11px] text-ink/40 py-2">{i + 1}</td>
                    <td className="font-body text-[12px] text-ink py-2">{c.name}</td>
                    <td className="font-heading font-semibold tabular-nums text-[12px] text-ink text-right py-2">{eur(c.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-[11px] text-ink/35 font-body">No creator attribution yet. Link creators to accounts to see data.</p>
          )}
        </Panel>
      </div>

      {/* ── LTV ── */}
      <Panel title="LIFETIME VALUE">
        <div className="grid grid-cols-2 -m-4">
          <KpiCell label="AVG LTV" value={eur(data.avgLtv)} />
          <KpiCell label="LTV : GP RATIO" value={data.ltvGpRatio != null ? `${data.ltvGpRatio}x` : '—'} caption={data.ltvGpRatio == null ? 'needs cost data' : undefined} />
        </div>
      </Panel>

      {/* ── Creator Rollup ── */}
      <Panel title="CREATORS — ROLLUP">
        <div className="grid grid-cols-4 -m-4">
          <KpiCell label="CREATOR REV" value={eur(data.creatorRev)} size="sm" />
          <KpiCell label="CREATOR CASH" value={eur(data.creatorCash)} size="sm" />
          <KpiCell label="CREATOR PIF%" value={pct(data.creatorPifRate)} size="sm" />
          <KpiCell label="CREATOR SPLIT%" value={pct(data.creatorSplitRate)} size="sm" />
        </div>
      </Panel>

      {/* ── Marketing placeholder ── */}
      <Panel title="MARKETING">
        <div className="grid grid-cols-4 -m-4">
          <KpiCell label="AD COST" value="—" caption="no data source" />
          <KpiCell label="ROAS" value="—" caption="no data source" />
          <KpiCell label="AD REV" value="—" caption="no data source" />
          <KpiCell label="CPL" value="—" caption="no data source" />
        </div>
      </Panel>
    </div>
  )
}
