'use client'

import { useState, useEffect } from 'react'
import { getFunnelMetrics, getSourcePerformance, getTriagePerformance, getWeeklyTrends, getSLAStatus } from '@/lib/queries/lead-analytics'
import { SkeletonPage } from '@/components/ui/skeleton'
import { eur } from '@/lib/format'
import { ArrowRight, TrendingUp, TrendingDown, Minus, Users, Phone, Target, DollarSign } from 'lucide-react'

const iconProps = { strokeWidth: 1.75 } as const

type Period = 'week' | 'month' | 'all'

function getDateRange(period: Period): { dateFrom?: string; dateTo?: string } {
  if (period === 'all') return {}
  const now = new Date()
  const dateTo = now.toISOString()
  if (period === 'week') {
    const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    return { dateFrom: from.toISOString(), dateTo }
  }
  const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  return { dateFrom: from.toISOString(), dateTo }
}

export default function LeadAnalyticsPage() {
  const [period, setPeriod] = useState<Period>('month')
  const [funnel, setFunnel] = useState<Awaited<ReturnType<typeof getFunnelMetrics>> | null>(null)
  const [sources, setSources] = useState<Awaited<ReturnType<typeof getSourcePerformance>> | null>(null)
  const [triage, setTriage] = useState<Awaited<ReturnType<typeof getTriagePerformance>> | null>(null)
  const [trends, setTrends] = useState<Awaited<ReturnType<typeof getWeeklyTrends>> | null>(null)
  const [sla, setSla] = useState<Awaited<ReturnType<typeof getSLAStatus>> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const { dateFrom, dateTo } = getDateRange(period)
    Promise.all([
      getFunnelMetrics(dateFrom, dateTo),
      getSourcePerformance(dateFrom, dateTo),
      getTriagePerformance(dateFrom, dateTo),
      getWeeklyTrends(12),
      getSLAStatus(),
    ]).then(([f, s, t, w, slaData]) => {
      setFunnel(f)
      setSources(s)
      setTriage(t)
      setTrends(w)
      setSla(slaData)
      setLoading(false)
    })
  }, [period])

  if (loading) return <SkeletonPage />

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Lead Analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">Funnel performance, source ROI & team metrics</p>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          {(['week', 'month', 'all'] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-[120ms] ${period === p ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {p === 'week' ? '7d' : p === 'month' ? '30d' : 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Funnel Visualization ── */}
      {funnel && (
        <div className="mb-8">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Funnel</h2>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-0">
              <FunnelStep icon={Users} label="Leads" value={funnel.leads} rate={null} color="blue" />
              <FunnelArrow rate={funnel.setterRate} />
              <FunnelStep icon={Phone} label="To Setter" value={funnel.toSetter} rate={`${Math.round(funnel.setterRate)}%`} color="amber" />
              <FunnelArrow rate={funnel.calls > 0 ? 100 : 0} />
              <FunnelStep icon={Target} label="Calls" value={funnel.calls} rate={funnel.toSetter > 0 ? `${Math.round((funnel.calls / funnel.toSetter) * 100)}%` : null} color="violet" />
              <FunnelArrow rate={funnel.dealRate} />
              <FunnelStep icon={DollarSign} label="Deals" value={funnel.deals} rate={`${Math.round(funnel.dealRate)}%`} color="emerald" />
              <div className="ml-4 pl-4 border-l border-gray-200">
                <div className="text-lg font-semibold text-gray-900 tabular-nums">{eur(funnel.revenue)}</div>
                <div className="text-[11px] text-gray-500">{eur(funnel.revenuePerLead)}/lead</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SLA Summary ── */}
      {sla && (
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-[11px] text-gray-500 uppercase tracking-wide">SLA today</div>
            <div className={`text-2xl font-semibold tabular-nums mt-1 ${sla.today.slaPercent >= 80 ? 'text-emerald-700' : 'text-red-700'}`}>
              {sla.today.slaPercent}%
            </div>
            <div className="text-[11px] text-gray-400">{sla.today.withinSLA}/{sla.today.total} within 5 min</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-[11px] text-gray-500 uppercase tracking-wide">Waiting (uncalled)</div>
            <div className={`text-2xl font-semibold tabular-nums mt-1 ${sla.uncalled > 0 ? 'text-red-700' : 'text-gray-900'}`}>
              {sla.uncalled}
            </div>
            <div className="text-[11px] text-gray-400">leads in queue</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-[11px] text-gray-500 uppercase tracking-wide">Binnen SLA today</div>
            <div className="text-2xl font-semibold tabular-nums mt-1 text-emerald-700">{sla.today.withinSLA}</div>
            <div className="text-[11px] text-gray-400">&lt; 5 min gebeld</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-[11px] text-gray-500 uppercase tracking-wide">Buiten SLA today</div>
            <div className={`text-2xl font-semibold tabular-nums mt-1 ${sla.today.outsideSLA > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
              {sla.today.outsideSLA}
            </div>
            <div className="text-[11px] text-gray-400">&gt; 5 min gebeld</div>
          </div>
        </div>
      )}

      {/* ── Source Performance ── */}
      {sources && sources.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Source Performance</h2>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100">
                    <th className="px-5 py-3">Source</th>
                    <th className="px-4 py-3 text-right">Leads</th>
                    <th className="px-4 py-3 text-right">To Setter</th>
                    <th className="px-4 py-3 text-right">Setter %</th>
                    <th className="px-4 py-3 text-right">Deals</th>
                    <th className="px-4 py-3 text-right">Deal %</th>
                    <th className="px-4 py-3 text-right">Revenue</th>
                    <th className="px-4 py-3 text-right">Rev/Lead</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sources.map(row => {
                    const avgSetterRate = sources.reduce((s, r) => s + r.setterRate, 0) / sources.length
                    return (
                      <tr key={row.source} className="hover:bg-gray-50">
                        <td className="px-5 py-3 font-medium text-gray-900">{row.source}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700">{row.leads}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700">{row.toSetter}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          <span className={row.setterRate > avgSetterRate ? 'text-emerald-700 font-medium' : row.setterRate < avgSetterRate * 0.7 ? 'text-red-600' : 'text-gray-700'}>
                            {Math.round(row.setterRate)}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700">{row.deals}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700">{Math.round(row.dealRate)}%</td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700">{eur(row.revenue)}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium text-gray-900">{eur(row.revPerLead)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Triage Performance ── */}
      {triage && triage.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Triage Performance</h2>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100">
                    <th className="px-5 py-3">Caller</th>
                    <th className="px-4 py-3 text-right">Called</th>
                    <th className="px-4 py-3 text-right">Connected</th>
                    <th className="px-4 py-3 text-right">To Setter</th>
                    <th className="px-4 py-3 text-right">Gem. TTC</th>
                    <th className="px-4 py-3 text-right">SLA %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {triage.map(row => (
                    <tr key={row.callerId || 'unassigned'} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900">{row.name}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700">{row.called}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700">{row.connected}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700">{row.toSetter}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                        {row.avgTimeToCall != null ? `${row.avgTimeToCall}m` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span className={row.slaPercent >= 80 ? 'text-emerald-700 font-medium' : row.slaPercent >= 50 ? 'text-amber-600' : 'text-red-600'}>
                          {row.slaPercent}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Weekly Trends ── */}
      {trends && trends.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Weekly trends</h2>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100">
                    <th className="px-5 py-3">Week</th>
                    <th className="px-4 py-3 text-right">Leads</th>
                    <th className="px-4 py-3 text-right">To Setter</th>
                    <th className="px-4 py-3 text-right">Setter %</th>
                    <th className="px-4 py-3 text-right">Gem. TTC</th>
                    <th className="px-4 py-3 text-right">SLA %</th>
                    <th className="px-4 py-3 w-20">Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {trends.map((row, i) => {
                    const prev = trends[i - 1]
                    const leadsDelta = prev ? row.leads - prev.leads : 0
                    return (
                      <tr key={row.week} className="hover:bg-gray-50">
                        <td className="px-5 py-3 font-medium text-gray-900 tabular-nums">{row.week}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700">{row.leads}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700">{row.toSetter}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700">{row.setterRate}%</td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                          {row.avgTTC != null ? `${row.avgTTC}m` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          <span className={row.slaPercent >= 80 ? 'text-emerald-700' : 'text-red-600'}>
                            {row.slaPercent}%
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {leadsDelta > 0 && <TrendingUp className="w-4 h-4 text-emerald-500" {...iconProps} />}
                          {leadsDelta < 0 && <TrendingDown className="w-4 h-4 text-red-500" {...iconProps} />}
                          {leadsDelta === 0 && <Minus className="w-4 h-4 text-gray-300" {...iconProps} />}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Funnel Step Component ── */
function FunnelStep({ icon: Icon, label, value, rate, color }: {
  icon: typeof Users; label: string; value: number; rate: string | null; color: string
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    violet: 'bg-violet-50 text-violet-700',
    emerald: 'bg-emerald-50 text-emerald-700',
  }

  return (
    <div className="flex flex-col items-center min-w-[100px]">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorMap[color] || 'bg-gray-50 text-gray-700'}`}>
        <Icon className="w-5 h-5" {...iconProps} />
      </div>
      <div className="text-lg font-semibold text-gray-900 tabular-nums mt-2">{value}</div>
      <div className="text-[11px] text-gray-500">{label}</div>
      {rate && <div className="text-[10px] font-medium text-gray-400 mt-0.5">{rate}</div>}
    </div>
  )
}

function FunnelArrow({ rate }: { rate: number }) {
  return (
    <div className="flex-1 flex items-center justify-center px-2">
      <div className="flex items-center gap-1">
        <div className="h-[1px] flex-1 bg-gray-200 min-w-[20px]" />
        <ArrowRight className="w-3.5 h-3.5 text-gray-300" {...iconProps} />
      </div>
    </div>
  )
}
