'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { KpiStrip, KpiCell } from '@/components/ui/kpi-strip'
import { ScreenHeader } from '@/components/ui/industry-ui'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/format'
import { getDeliveryStats, getCoachesWithStats } from '@/lib/queries/delivery'
import { AlertTriangle, ListChecks, Columns3, FileEdit, UserPlus } from 'lucide-react'

// Lucide icon props
const iconProps = { strokeWidth: 1.75 } as const

export default function DeliveryOverview() {
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getDeliveryStats>> | null>(null)
  const [coaches, setCoaches] = useState<Awaited<ReturnType<typeof getCoachesWithStats>>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getDeliveryStats(), getCoachesWithStats()]).then(([s, c]) => {
      setStats(s); setCoaches(c); setLoading(false)
    })
  }, [])

  if (loading || !stats) return <div className="flex items-center justify-center h-64"><div className="text-gray-400">Laden...</div></div>

  const incomplete = stats.total - stats.withCoach
  const pct = stats.total > 0 ? Math.round((stats.withCoach / stats.total) * 100) : 0
  const phaseData = [
    { key: 'PHASE_1', label: 'Fase 1', count: stats.phase1, color: 'bg-cyan-400' },
    { key: 'PHASE_2', label: 'Fase 2', count: stats.phase2, color: 'bg-blue-400' },
    { key: 'PHASE_3', label: 'Fase 3', count: stats.phase3, color: 'bg-purple-400' },
    { key: 'COMPLETED', label: 'Afgerond', count: stats.completed, color: 'bg-emerald-400' },
  ]

  return (
    <div>
      <ScreenHeader
        eyebrow="DELIVERY & SYSTEM"
        title="Delivery Overview"
        right={<span className="font-body text-[12px] text-ink/50"><span className="font-heading font-semibold text-ink tabular-nums">{stats.total}</span> STUDENTS · <span className="font-heading font-semibold text-ink tabular-nums">{coaches.length}</span> COACHES</span>}
      />

      {/* KPIs */}
      <div className="mb-6">
        <KpiStrip cols={6}>
          <KpiCell size="sm" label="Total Students" value={stats.total} />
          <KpiCell size="sm" label="Phase 1" value={stats.phase1} caption="leren" />
          <KpiCell size="sm" label="Phase 2" value={stats.phase2} caption="opdrachten" />
          <KpiCell size="sm" label="Phase 3" value={stats.phase3} caption="opdrachtgevers" />
          <KpiCell size="sm" label="Satisfaction" value={stats.avgSatisfaction ?? '—'} />
          <KpiCell size="sm" label="Needs Attention" value={stats.needsAttention} caption={`${stats.yellow} yellow`} danger={stats.needsAttention > 0} />
        </KpiStrip>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Link href="/delivery/werklijst" className="bg-white rounded-lg border border-gray-100 p-5 hover:border-gray-200 transition duration-[120ms] group flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-accent-100 flex items-center justify-center"><ListChecks className="w-5 h-5 text-accent-700" {...iconProps} /></div>
          <div><h3 className="font-semibold text-gray-900 group-hover:text-accent-700 text-sm">Werklijst</h3><p className="text-xs text-gray-500">Inbox, huiswerk nakijken, check-ins</p></div>
        </Link>
        <Link href="/delivery/crm" className="bg-white rounded-lg border border-gray-100 p-5 hover:border-gray-200 transition duration-[120ms] group flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center"><Columns3 className="w-5 h-5 text-blue-600" {...iconProps} /></div>
          <div><h3 className="font-semibold text-gray-900 group-hover:text-accent-700 text-sm">CRM</h3><p className="text-xs text-gray-500">Fase board per coach</p></div>
        </Link>
        <Link href="/delivery/backfill" className="bg-white rounded-lg border border-gray-100 p-5 hover:border-gray-200 transition duration-[120ms] group flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center"><FileEdit className="w-5 h-5 text-amber-600" {...iconProps} /></div>
          <div><h3 className="font-semibold text-gray-900 group-hover:text-accent-700 text-sm">Backfill</h3><p className="text-xs text-gray-500"><span className="tabular-nums">{incomplete}</span> studenten incompleet</p></div>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coaches */}
        <div className="lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Coaches</h3>
          <div className="space-y-3">
            {coaches.map(c => {
              const phases = [{ l: 'F1', n: c.f1, cl: 'bg-cyan-400' }, { l: 'F2', n: c.f2, cl: 'bg-blue-400' }, { l: 'F3', n: c.f3, cl: 'bg-purple-400' }, { l: 'Done', n: c.completed, cl: 'bg-emerald-400' }]
              const initials = c.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
              return (
                <Link key={c.id} href={`/delivery/crm?coach=${c.id}`} className="block bg-white rounded-lg border border-gray-100 p-5 hover:border-gray-200 transition duration-[120ms]">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-accent-700 flex items-center justify-center text-white text-sm font-semibold shrink-0">{initials}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div><div className="font-semibold text-gray-900">{c.name}</div><div className="text-[11px] text-gray-400">{c.email}</div></div>
                        <Badge status={c.status} />
                      </div>
                      <div className="grid grid-cols-4 gap-2 mt-3 text-center">
                        <div><div className="text-base font-semibold text-gray-900 tabular-nums">{c.studenten}</div><div className="text-[11px] text-gray-400">Students</div></div>
                        <div><div className="text-base font-semibold text-gray-900 tabular-nums">{c.uren.toFixed(1)}</div><div className="text-[11px] text-gray-400">Hours</div></div>
                        <div><div className="text-base font-semibold text-violet-600 tabular-nums">{c.certified}</div><div className="text-[11px] text-gray-400">Certified</div></div>
                        <div><div className="text-base font-semibold text-emerald-600 tabular-nums">{c.completed}</div><div className="text-[11px] text-gray-400">Completed</div></div>
                      </div>
                      {c.studenten > 0 && (
                        <>
                          <div className="mt-3 flex w-full h-2 rounded-full overflow-hidden bg-gray-100">
                            {phases.map((p, i) => <div key={i} className={p.cl} style={{ width: `${(p.n / c.studenten) * 100}%` }} />)}
                          </div>
                          <div className="flex gap-3 mt-1.5">{phases.map((p, i) => <span key={i} className="text-[11px] text-gray-400">{p.l}: <span className="tabular-nums">{p.n}</span></span>)}</div>
                        </>
                      )}
                      {c.red > 0 && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2">
                          <AlertTriangle className="w-3.5 h-3.5" {...iconProps} /> <span className="tabular-nums">{c.red}</span> student{c.red > 1 ? 's' : ''} needs attention
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              )
            })}
            {coaches.length === 0 && (
              <div className="bg-white rounded-lg border border-gray-100 p-8 text-center">
                <UserPlus className="w-8 h-8 text-gray-300 mx-auto mb-2" {...iconProps} />
                <p className="text-sm text-gray-500">Nog geen coaches.</p>
              </div>
            )}
          </div>
        </div>

        {/* Fase verdeling + Verdienmodel */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-100 p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Per fase</h3>
            {phaseData.map(p => {
              const pctPhase = stats.total > 0 ? (p.count / stats.total) * 100 : 0
              return (
                <div key={p.key} className="flex items-center gap-3 mb-2">
                  <span className="text-xs text-gray-500 w-14">{p.label}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2"><div className={`${p.color} h-2 rounded-full`} style={{ width: `${pctPhase}%` }} /></div>
                  <span className="text-xs font-medium text-gray-700 w-8 text-right tabular-nums">{p.count}</span>
                </div>
              )
            })}
          </div>

          <div className="bg-white rounded-lg border border-gray-100 p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Verdienmodel</h3>
            {[
              { label: 'HTC', count: stats.htc, color: 'bg-violet-400' },
              { label: 'VA', count: stats.va, color: 'bg-sky-400' },
              { label: 'AS', count: stats.as, color: 'bg-amber-400' },
              { label: 'Geen', count: stats.total - stats.htc - stats.va - stats.as, color: 'bg-gray-300' },
            ].map(v => {
              const pctVm = stats.total > 0 ? (v.count / stats.total) * 100 : 0
              return (
                <div key={v.label} className="flex items-center gap-3 mb-2">
                  <span className="text-xs text-gray-500 w-14">{v.label}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2"><div className={`${v.color} h-2 rounded-full`} style={{ width: `${pctVm}%` }} /></div>
                  <span className="text-xs font-medium text-gray-700 w-8 text-right tabular-nums">{v.count}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
