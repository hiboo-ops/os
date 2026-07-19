'use client'

import { useState, useEffect } from 'react'
import { getFunnelMetrics, getSourcePerformance } from '@/lib/queries/lead-analytics'
import { SkeletonPage } from '@/components/ui/skeleton'
import { eur } from '@/lib/format'
import { ArrowRight, Users, PhoneCall, Calendar, DollarSign } from 'lucide-react'

const iconProps = { strokeWidth: 1.75 } as const

type Period = 'week' | 'month' | 'all'

function getDateRange(period: Period): { dateFrom?: string; dateTo?: string } {
  if (period === 'all') return {}
  const now = new Date()
  const dateTo = now.toISOString()
  if (period === 'week') {
    return { dateFrom: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(), dateTo }
  }
  return { dateFrom: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(), dateTo }
}

export default function LeadAnalyticsPage() {
  const [period, setPeriod] = useState<Period>('all')
  const [funnel, setFunnel] = useState<Awaited<ReturnType<typeof getFunnelMetrics>> | null>(null)
  const [sources, setSources] = useState<Awaited<ReturnType<typeof getSourcePerformance>> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const { dateFrom, dateTo } = getDateRange(period)
    Promise.all([
      getFunnelMetrics(dateFrom, dateTo),
      getSourcePerformance(dateFrom, dateTo),
    ]).then(([f, s]) => {
      setFunnel(f)
      setSources(s)
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
          <p className="text-sm text-gray-500 mt-0.5">Conversion funnel & source performance</p>
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

      {/* ── Conversion Funnel ── */}
      {funnel && (
        <div className="mb-8">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Conversion Funnel</h2>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center">
              <FunnelStep icon={Users} label="LEADS IN" value={funnel.leadsIn} rate={null} color="blue" />
              <FunnelArrow rate={funnel.contactedRate} />
              <FunnelStep icon={PhoneCall} label="CONTACTED" value={funnel.contacted} rate={`${Math.round(funnel.contactedRate)}%`} color="amber" />
              <FunnelArrow rate={funnel.callBookedRate} />
              <FunnelStep icon={Calendar} label="CALL BOOKED" value={funnel.callBooked} rate={`${Math.round(funnel.callBookedRate)}%`} color="violet" />
              <FunnelArrow rate={funnel.closedRate} />
              <FunnelStep icon={DollarSign} label="CLOSED" value={funnel.closed} rate={`${Math.round(funnel.closedRate)}%`} color="emerald" />
              <div className="ml-6 pl-6 border-l border-gray-200">
                <div className="text-2xl font-semibold text-gray-900 tabular-nums">{eur(funnel.revenue)}</div>
                <div className="text-[11px] text-gray-500 mt-0.5">{eur(funnel.revenuePerLead)} / lead</div>
              </div>
            </div>
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
                    <th className="px-4 py-3 text-right">Contacted</th>
                    <th className="px-4 py-3 text-right">Call Booked</th>
                    <th className="px-4 py-3 text-right">Closed</th>
                    <th className="px-4 py-3 text-right">Revenue</th>
                    <th className="px-4 py-3 text-right">End-to-end %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sources.map(row => {
                    const avgRate = sources.length > 0 ? sources.reduce((s, r) => s + r.endToEndRate, 0) / sources.length : 0
                    return (
                      <tr key={row.source} className="hover:bg-gray-50">
                        <td className="px-5 py-3 font-medium text-gray-900">{row.source}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700">{row.leads}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700">{row.contacted}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700">{row.callBooked}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700">{row.closed}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700">{eur(row.revenue)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          <span className={row.endToEndRate > avgRate && row.endToEndRate > 0 ? 'text-emerald-700 font-medium' : row.endToEndRate < avgRate * 0.5 ? 'text-red-600' : 'text-gray-700'}>
                            {Math.round(row.endToEndRate)}%
                          </span>
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

      {sources && sources.length === 0 && (
        <div className="bg-white rounded-lg border border-dashed border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-500">No lead data for this period</p>
        </div>
      )}
    </div>
  )
}

/* ── Funnel Components ── */
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
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
        <Icon className="w-5 h-5" strokeWidth={1.75} />
      </div>
      <div className="text-xl font-semibold text-gray-900 tabular-nums mt-2">{value}</div>
      <div className="text-[11px] text-gray-500 font-medium">{label}</div>
      {rate && <div className="text-[10px] font-medium text-gray-400 mt-0.5">{rate}</div>}
    </div>
  )
}

function FunnelArrow({ rate }: { rate: number }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-3 min-w-[60px]">
      <div className="text-[10px] font-medium text-gray-400 tabular-nums mb-1">{Math.round(rate)}%</div>
      <div className="flex items-center gap-1 w-full">
        <div className="h-[1px] flex-1 bg-gray-200" />
        <ArrowRight className="w-3.5 h-3.5 text-gray-300" strokeWidth={1.75} />
      </div>
    </div>
  )
}
