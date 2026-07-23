'use client'

import { useEffect, useState } from 'react'
import type { PartnerManagerOverview } from '@/lib/queries/partner-manager'
import { ScreenHeader, Panel } from '@/components/ui/industry-ui'
import { KpiStrip, KpiCell } from '@/components/ui/kpi-strip'
import { GroupedSteelBars, SteelBars, SegmentBar } from '@/components/ui/industry-charts'
import { Tag } from '@/components/ui/tag'
import { eur } from '@/lib/format'
import { SkeletonPage } from '@/components/ui/skeleton'

export default function PartnerManagerOverviewPage() {
  const [data, setData] = useState<PartnerManagerOverview | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/partner-manager/overview')
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <SkeletonPage />

  if (!data) {
    return (
      <div>
        <ScreenHeader eyebrow="PARTNER MANAGEMENT" title="Creator Overview" />
        <p className="text-ink/50 text-sm">Geen toegang of data beschikbaar.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <ScreenHeader eyebrow="PARTNER MANAGEMENT" title="Creator Overview" />

      {/* ── Core KPIs ── */}
      <KpiStrip cols={5}>
        <KpiCell label="TOTAL REVENUE" value={eur(data.totalRevenue)} size="sm" />
        <KpiCell label="TOTAL CASH" value={eur(data.totalCash)} size="sm" />
        <KpiCell label="AVG REV / CREATOR" value={eur(data.avgRevenuePerCreator)} size="sm" />
        <KpiCell label="AVG CASH / CREATOR" value={eur(data.avgCashPerCreator)} size="sm" />
        <KpiCell label="AVG REV / LEAD" value={eur(data.avgRevPerLead)} size="sm" />
      </KpiStrip>

      {/* ── Status ── */}
      <KpiStrip cols={3}>
        <KpiCell label="ACTIVE" value={data.activeCount} />
        <KpiCell label="CHURNED" value={data.churnedCount} danger={data.churnedCount > 0} />
        <KpiCell label="ONBOARDING" value={data.onboardingCount} />
      </KpiStrip>

      {/* ── Key-Man Risk ── */}
      <Panel title="KEY-MAN RISK">
        {data.keyManRisk.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Tag variant="danger">WARNING</Tag>
              <span className="font-body text-[12px] text-ink/60">
                {data.keyManRisk.length === 1 ? '1 creator' : `${data.keyManRisk.length} creators`} with &gt;30% revenue share
              </span>
            </div>
            {data.leaderboard.length > 0 && (
              <SegmentBar
                a={data.leaderboard[0]?.revenue || 0}
                b={data.leaderboard.slice(1).reduce((s, c) => s + c.revenue, 0)}
              />
            )}
            <div className="flex items-center gap-4 mt-1">
              {data.keyManRisk.map(c => (
                <div key={c.name} className="flex items-center gap-1.5">
                  <Tag variant="danger">{c.share}%</Tag>
                  <span className="font-body text-[12px] text-ink">{c.name}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-ink/35 font-body">
            {data.totalRevenue === 0
              ? 'No revenue data yet. Link creators to accounts to see risk analysis.'
              : 'No key-man risk detected. Revenue is well distributed.'}
          </p>
        )}
      </Panel>

      {/* ── Leaderboard ── */}
      <Panel title="LEADERBOARD">
        {data.leaderboard.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-divider">
                  {['#', 'NAME', 'STATUS', 'REVENUE', 'CASH', 'LEADS', 'REV/LEAD', 'SHARE', 'CHURN'].map(h => (
                    <th key={h} className="font-heading font-semibold uppercase text-[9.5px] tracking-[0.08em] text-ink/50 text-left pb-2 pr-3 last:pr-0">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.leaderboard.map((c, i) => (
                  <tr key={c.id} className="border-b border-divider last:border-0">
                    <td className="font-heading font-semibold text-[11px] text-ink/40 py-2.5 pr-3">{i + 1}</td>
                    <td className="font-body text-[12px] text-ink py-2.5 pr-3">{c.name}</td>
                    <td className="py-2.5 pr-3">
                      <Tag variant={c.status === 'ACTIVE' ? 'accent' : c.status === 'ONBOARDING' ? 'neutral' : 'danger'}>{c.status}</Tag>
                    </td>
                    <td className="font-heading font-semibold tabular-nums text-[12px] text-ink py-2.5 pr-3">{eur(c.revenue)}</td>
                    <td className="font-heading font-semibold tabular-nums text-[12px] text-ink py-2.5 pr-3">{eur(c.cash)}</td>
                    <td className="font-heading tabular-nums text-[12px] text-ink py-2.5 pr-3">{c.leadCount}</td>
                    <td className="font-heading tabular-nums text-[12px] text-ink py-2.5 pr-3">{eur(c.revPerLead)}</td>
                    <td className="py-2.5 pr-3">
                      <Tag variant={c.shareOfRevenue > 30 ? 'danger' : 'outline'}>{c.shareOfRevenue}%</Tag>
                    </td>
                    <td className="font-heading tabular-nums text-[12px] text-ink py-2.5">{c.churnCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[11px] text-ink/35 font-body">No creator data available.</p>
        )}
      </Panel>

      {/* ── Highest Churn ── */}
      {data.highestChurnCreator && (
        <Panel title="HIGHEST CHURN PARTNER">
          <div className="flex items-center gap-3">
            <Tag variant="danger">ALERT</Tag>
            <span className="font-body text-[13px] text-ink">
              {data.highestChurnCreator.name} — {data.highestChurnCreator.churnCount} churned accounts
            </span>
          </div>
        </Panel>
      )}

      {/* ── Growth Charts ── */}
      <div className="grid grid-cols-2 gap-6">
        <Panel title="CREATOR GROWTH (12M)">
          <div className="h-[180px]">
            <SteelBars
              labels={data.creatorGrowth.map(m => m.month.split(' ')[0])}
              data={data.creatorGrowth.map(m => m.count)}
            />
          </div>
        </Panel>

        <Panel title="REVENUE GROWTH (12M)">
          <div className="h-[180px]">
            <SteelBars
              labels={data.revenueGrowth.map(m => m.month.split(' ')[0])}
              data={data.revenueGrowth.map(m => m.revenue)}
            />
          </div>
        </Panel>
      </div>
    </div>
  )
}
