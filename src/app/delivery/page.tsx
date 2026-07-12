'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { KpiCard } from '@/components/kpi-card'
import { StatusBadge } from '@/components/status-badge'
import { getDeliveryStats, getCoachesWithStats, getStudentsForPhaseBoard, getUpsellPipeline } from '@/lib/queries/delivery'
import { ClipboardCheck, Clock, MessageSquare, CheckCircle, AlertTriangle, UserPlus } from 'lucide-react'

const vmLabels: Record<string, string> = { HIGH_TICKET_CLOSING: 'HIGH TICKET CLOSING', VA: 'VIRTUAL ASSISTANT', APPOINTMENT_SETTING: 'APPOINTMENT SETTING' }
const vmColors: Record<string, string> = { HIGH_TICKET_CLOSING: 'bg-violet-100 text-violet-700', VA: 'bg-sky-100 text-sky-700', APPOINTMENT_SETTING: 'bg-amber-100 text-amber-700' }

const colorStyles: Record<string, { dot: string; ring: string; bg: string; text: string }> = {
  GREEN: { dot: 'bg-emerald-400', ring: 'ring-emerald-400/30', bg: '', text: 'text-emerald-600' },
  YELLOW: { dot: 'bg-yellow-400', ring: 'ring-yellow-400/30', bg: 'bg-yellow-50/50', text: 'text-yellow-600' },
  RED: { dot: 'bg-red-400', ring: 'ring-red-400/30', bg: 'bg-red-50/50', text: 'text-red-600' },
}

const phaseConfig: Record<string, { label: string; border: string; dot: string; desc: string }> = {
  PHASE_1: { label: 'Fase 1 — Leren', border: 'border-cyan-400', dot: 'bg-cyan-400', desc: 'Modules kijken, verdienmodel kiezen' },
  PHASE_2: { label: 'Fase 2 — Opdrachten', border: 'border-blue-400', dot: 'bg-blue-400', desc: '10 opdrachten inleveren + nakijken' },
  PHASE_3: { label: 'Fase 3 — Opdrachtgevers', border: 'border-purple-400', dot: 'bg-purple-400', desc: 'Gecertificeerd, opdrachtgevers zoeken' },
  COMPLETED: { label: 'Afgerond', border: 'border-emerald-400', dot: 'bg-emerald-400', desc: 'Traject voltooid' },
}

export default function DeliveryPage() {
  const [tab, setTab] = useState<'overview' | 'phases' | 'upsell'>('overview')
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getDeliveryStats>> | null>(null)
  const [coaches, setCoaches] = useState<Awaited<ReturnType<typeof getCoachesWithStats>>>([])
  const [students, setStudents] = useState<Awaited<ReturnType<typeof getStudentsForPhaseBoard>>>([])
  const [upsells, setUpsells] = useState<Awaited<ReturnType<typeof getUpsellPipeline>>>([])
  const [loading, setLoading] = useState(true)
  const [selectedCoach, setSelectedCoach] = useState<string>('')

  const loadData = useCallback(async () => {
    setLoading(true)
    const [s, c, st, u] = await Promise.all([
      getDeliveryStats(),
      getCoachesWithStats(),
      getStudentsForPhaseBoard(selectedCoach || undefined),
      getUpsellPipeline(),
    ])
    setStats(s)
    setCoaches(c)
    setStudents(st)
    setUpsells(u)
    setLoading(false)
  }, [selectedCoach])

  useEffect(() => { loadData() }, [loadData])

  if (loading || !stats) {
    return <div className="flex items-center justify-center h-64"><div className="text-slate-400">Laden...</div></div>
  }

  const incomplete = stats.total - stats.withCoach
  const pct = stats.total > 0 ? Math.round((stats.withCoach / stats.total) * 100) : 0

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Delivery & Coaching</h1>
          <p className="text-sm text-slate-500 mt-0.5">{stats.total} studenten · {coaches.length} coaches</p>
        </div>
        <div className="flex gap-2">
          <Link href="/delivery/backfill" className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 hover:bg-amber-100 transition">
            <ClipboardCheck className="w-4 h-4" /> Backfill ({incomplete})
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 mb-6">
        {(['overview', 'phases', 'upsell'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${tab === t ? 'text-brand-600 border-brand-600' : 'text-slate-500 border-transparent'}`}>
            {{ overview: 'Overview', phases: 'Fase Board', upsell: 'Upsell Pipeline' }[t]}
          </button>
        ))}
      </div>

      {/* ═══ OVERVIEW ═══ */}
      {tab === 'overview' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
            <KpiCard label="Total students" value={stats.total} />
            <KpiCard label="Fase 1" value={stats.phase1} caption="leren" />
            <KpiCard label="Fase 2" value={stats.phase2} caption="opdrachten" />
            <KpiCard label="Fase 3" value={stats.phase3} caption="opdrachtgevers" />
            <KpiCard label="Needs attention" value={stats.needsAttention} caption={`${stats.yellow} yellow`} captionColor={stats.needsAttention > 0 ? 'red' : 'default'} />
            <KpiCard label="Backfill" value={`${pct}%`} caption={`${incomplete} zonder coach`} captionColor={pct < 50 ? 'amber' : 'green'} />
          </div>

          {/* Verdienmodel verdeling */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-violet-400" />
                <span className="text-xs font-medium text-slate-500 uppercase">High Ticket Closing</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">{stats.htc}</div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                <div className="bg-violet-400 h-1.5 rounded-full" style={{ width: `${stats.total > 0 ? (stats.htc / stats.total) * 100 : 0}%` }} />
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-sky-400" />
                <span className="text-xs font-medium text-slate-500 uppercase">Virtual Assistant</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">{stats.va}</div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                <div className="bg-sky-400 h-1.5 rounded-full" style={{ width: `${stats.total > 0 ? (stats.va / stats.total) * 100 : 0}%` }} />
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <span className="text-xs font-medium text-slate-500 uppercase">Appointment Setting</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">{stats.as}</div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                <div className="bg-amber-400 h-1.5 rounded-full" style={{ width: `${stats.total > 0 ? (stats.as / stats.total) * 100 : 0}%` }} />
              </div>
            </div>
          </div>

          {/* Coach cards */}
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Coaches</h3>
          <div className="space-y-3 mb-6">
            {coaches.map(c => {
              const phases = [{ l: 'F1', n: c.f1, cl: 'bg-cyan-400' }, { l: 'F2', n: c.f2, cl: 'bg-blue-400' }, { l: 'F3', n: c.f3, cl: 'bg-purple-400' }, { l: 'Done', n: c.completed, cl: 'bg-emerald-400' }]
              const initials = c.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
              return (
                <div key={c.id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 hover:shadow-md transition cursor-pointer" onClick={() => { setSelectedCoach(c.id); setTab('phases') }}>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-brand-500 flex items-center justify-center text-white text-sm font-bold shrink-0">{initials}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div><div className="font-semibold text-slate-900">{c.name}</div><div className="text-[11px] text-slate-400">{c.email}</div></div>
                        <StatusBadge status={c.status} />
                      </div>
                      <div className="grid grid-cols-4 gap-2 mt-3 text-center">
                        <div><div className="text-base font-bold text-slate-900">{c.studenten}</div><div className="text-[10px] text-slate-400">Students</div></div>
                        <div><div className="text-base font-bold text-slate-900">{c.uren.toFixed(1)}</div><div className="text-[10px] text-slate-400">Hours</div></div>
                        <div><div className="text-base font-bold text-violet-600">{c.certified}</div><div className="text-[10px] text-slate-400">Certified</div></div>
                        <div><div className="text-base font-bold text-emerald-600">{c.completed}</div><div className="text-[10px] text-slate-400">Completed</div></div>
                      </div>
                      {c.studenten > 0 && (
                        <>
                          <div className="mt-3 flex w-full h-2 rounded-full overflow-hidden bg-slate-100">
                            {phases.map((p, i) => c.studenten > 0 ? <div key={i} className={p.cl} style={{ width: `${(p.n / c.studenten) * 100}%` }} /> : null)}
                          </div>
                          <div className="flex gap-3 mt-1.5">{phases.map((p, i) => <span key={i} className="text-[10px] text-slate-400">{p.l}: {p.n}</span>)}</div>
                        </>
                      )}
                      {c.red > 0 && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2">
                          <AlertTriangle className="w-3.5 h-3.5" /> {c.red} student{c.red > 1 ? 's' : ''} needs attention
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            {coaches.length === 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 text-center">
                <UserPlus className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Nog geen coaches. Voeg coaches toe in Supabase.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══ FASE BOARD ═══ */}
      {tab === 'phases' && (
        <>
          {/* Coach filter */}
          <div className="mb-4">
            <select
              value={selectedCoach}
              onChange={e => setSelectedCoach(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white"
            >
              <option value="">Alle coaches</option>
              {coaches.map(c => <option key={c.id} value={c.id}>{c.name} ({c.studenten})</option>)}
            </select>
          </div>

          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-[1100px]">
              {Object.entries(phaseConfig).map(([key, cfg]) => {
                const items = students.filter(s => s.phase === key)
                return (
                  <div key={key} className="flex-1 min-w-[260px]">
                    <div className={`border-t-2 ${cfg.border} bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden`}>
                      <div className="px-4 py-3 border-b border-slate-100">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                          <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">{cfg.label}</span>
                          <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full ml-auto">{items.length}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 ml-4">{cfg.desc}</p>
                      </div>
                      <div className="p-2 space-y-2 min-h-[200px] max-h-[600px] overflow-y-auto">
                        {items.length === 0 ? <div className="text-[10px] text-slate-300 text-center py-8">Geen studenten</div> :
                          items.map(s => {
                            const cs = colorStyles[s.activity_status] || colorStyles.GREEN
                            const vm = s.verdienmodel
                            return (
                              <div key={s.id} className={`bg-white border border-slate-100 rounded-lg p-3 ${cs.bg} ring-1 ${cs.ring} hover:shadow-md transition`}>
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="relative">
                                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
                                      {s.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                                    </div>
                                    <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ${cs.dot} ring-2 ring-white`} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-[13px] font-medium text-slate-900 truncate">{s.name}</div>
                                    <div className="text-[10px] text-slate-400">{vm ? vmLabels[vm] || vm : 'Geen verdienmodel'}</div>
                                  </div>
                                </div>
                                {s.certification_date && (
                                  <div className="mb-2"><span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">Gecertificeerd</span></div>
                                )}
                                <div className="flex items-center justify-between text-[10px]">
                                  <span className="text-slate-400">{s.coaching_hours || 0}h</span>
                                  {s.coach && <span className="text-slate-400">{s.coach.name.split(' ')[0]}</span>}
                                </div>
                              </div>
                            )
                          })}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* ═══ UPSELL PIPELINE ═══ */}
      {tab === 'upsell' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <KpiCard label="Coming up" value={upsells.filter(u => u.pipelineStatus === 'COMING_UP').length} caption="traject verloopt" />
            <KpiCard label="In gesprek" value={upsells.filter(u => u.pipelineStatus === 'IN_CONVERSATION').length} />
            <KpiCard label="Renewed" value={upsells.filter(u => u.pipelineStatus === 'RENEWED').length} captionColor="green" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {[
              { key: 'COMING_UP' as const, label: 'Traject verloopt', desc: 'Binnen 30 dagen / verlopen', border: 'border-yellow-400', Icon: Clock, hbg: 'bg-yellow-50' },
              { key: 'IN_CONVERSATION' as const, label: 'In gesprek', desc: 'Upsell besproken', border: 'border-orange-400', Icon: MessageSquare, hbg: 'bg-orange-50' },
              { key: 'RENEWED' as const, label: 'Renewed', desc: 'Upsell gestart', border: 'border-emerald-400', Icon: CheckCircle, hbg: 'bg-emerald-50' },
            ].map(col => {
              const items = upsells.filter(u => u.pipelineStatus === col.key)
              return (
                <div key={col.key} className={`border-t-2 ${col.border} bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden`}>
                  <div className={`px-5 py-4 border-b border-slate-100 ${col.hbg}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <col.Icon className="w-4 h-4 text-slate-500" />
                      <span className="text-sm font-semibold text-slate-700">{col.label}</span>
                      <span className="text-xs font-medium text-slate-400 bg-white/80 px-2 py-0.5 rounded-full ml-auto">{items.length}</span>
                    </div>
                    <p className="text-xs text-slate-500">{col.desc}</p>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {items.length === 0 ? <div className="px-5 py-8 text-xs text-slate-300 text-center">Geen studenten</div> :
                      items.map(u => (
                        <div key={u.id} className="px-5 py-4 hover:bg-slate-50 transition">
                          <div className="flex items-center gap-3 mb-1">
                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
                              {u.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-medium text-slate-900">{u.name}</div>
                              {u.verdienmodel && <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full ${vmColors[u.verdienmodel] || 'bg-slate-100 text-slate-600'}`}>{vmLabels[u.verdienmodel] || u.verdienmodel}</span>}
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500">{u.coach?.name || 'Geen coach'}</span>
                            <span className={u.daysLeft <= 0 ? 'text-red-500 font-semibold' : u.daysLeft <= 7 ? 'text-amber-600 font-medium' : 'text-slate-400'}>
                              {u.daysLeft <= 0 ? `${Math.abs(u.daysLeft)}d over` : `${u.daysLeft}d left`}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
