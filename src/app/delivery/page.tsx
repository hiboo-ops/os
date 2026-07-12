'use client'

import { useState } from 'react'
import Link from 'next/link'
import { KpiCard } from '@/components/kpi-card'
import { StatusBadge } from '@/components/status-badge'
import { ClipboardCheck, Clock, MessageSquare, CheckCircle, AlertTriangle, Star, Video, Trophy, UserPlus, FileCheck, Upload, Award, MessageCircle } from 'lucide-react'

// ── MOCK DATA ──
const coaches = [
  { id: 1, naam: 'Demi van Leeuwen', role: 'Head of Community', email: 'demi@hiboo.nl', status: 'ACTIVE', foto: 'DL', studenten: 18, f1: 3, f2: 8, f3: 5, certified: 2, completed: 4, stopped: 1, uren: 124, urenGem: 6.9, tevredenheid: 8.6, upsells: 4, satisfactionTrend: [8.0,8.2,8.3,8.5,8.4,8.6] },
  { id: 2, naam: 'Sanne de Vries', role: 'Coach', email: 'sanne@hiboo.nl', status: 'ACTIVE', foto: 'SV', studenten: 12, f1: 2, f2: 5, f3: 3, certified: 1, completed: 3, stopped: 1, uren: 84, urenGem: 7.0, tevredenheid: 8.4, upsells: 3, satisfactionTrend: [7.8,8.0,8.1,8.3,8.2,8.4] },
  { id: 3, naam: 'Priya Sharma', role: 'Coach', email: 'priya@hiboo.nl', status: 'ACTIVE', foto: 'PS', studenten: 15, f1: 3, f2: 6, f3: 4, certified: 2, completed: 3, stopped: 0, uren: 110, urenGem: 7.4, tevredenheid: 9.1, upsells: 5, satisfactionTrend: [8.6,8.8,8.9,9.0,8.9,9.1] },
]

const vmLabels: Record<string, string> = { HTC: 'HIGH TICKET CLOSING', VA: 'VIRTUAL ASSISTANT', AS: 'APPOINTMENT SETTING' }
const vmColors: Record<string, string> = { HTC: 'bg-violet-100 text-violet-700', VA: 'bg-sky-100 text-sky-700', AS: 'bg-amber-100 text-amber-700' }

const students = [
  { id: 1, naam: 'Marieke Hofman', vm: 'HTC', phase: 'PHASE_2', color: 'GREEN', score: 9, approved: 6, submitted: 0, redo: 1, kickOff: '15 mrt 2026', eind: '15 jul 2026', uren: 6.5, nextCheckIn: '9 jul', coach: 'Demi van Leeuwen', certified: false },
  { id: 2, naam: 'Rick Bos', vm: 'AS', phase: 'PHASE_2', color: 'GREEN', score: 8, approved: 3, submitted: 1, redo: 0, kickOff: '01 apr 2026', eind: '01 aug 2026', uren: 4.0, nextCheckIn: '15 jul', coach: 'Demi van Leeuwen', certified: false },
  { id: 3, naam: 'Anna Vermeer', vm: 'VA', phase: 'PHASE_2', color: 'RED', score: 5, approved: 2, submitted: 0, redo: 1, kickOff: '10 feb 2026', eind: '10 jun 2026', uren: 8.5, nextCheckIn: 'OVERDUE', coach: 'Demi van Leeuwen', certified: false },
  { id: 4, naam: 'Tom van Dijk', vm: 'HTC', phase: 'PHASE_1', color: 'GREEN', score: null, approved: 0, submitted: 0, redo: 0, kickOff: '05 jul 2026', eind: '05 nov 2026', uren: 0, nextCheckIn: '19 jul', coach: 'Demi van Leeuwen', certified: false },
  { id: 5, naam: 'Eva Martens', vm: 'HTC', phase: 'PHASE_3', color: 'GREEN', score: 8, approved: 10, submitted: 0, redo: 0, kickOff: '20 mrt 2026', eind: '20 jul 2026', uren: 12, nextCheckIn: '22 jul', coach: 'Sanne de Vries', certified: true },
  { id: 6, naam: 'Jasper Smit', vm: 'AS', phase: 'PHASE_2', color: 'YELLOW', score: 6, approved: 4, submitted: 1, redo: 0, kickOff: '01 feb 2026', eind: '01 jun 2026', uren: 5.5, nextCheckIn: 'OVERDUE', coach: 'Sanne de Vries', certified: false },
  { id: 7, naam: 'Sarah Klein', vm: 'VA', phase: 'COMPLETED', color: 'GREEN', score: 9, approved: 10, submitted: 0, redo: 0, kickOff: '01 jan 2026', eind: '01 mei 2026', uren: 16, nextCheckIn: '-', coach: 'Sanne de Vries', certified: true },
  { id: 8, naam: 'Britt Rikkerink', vm: 'AS', phase: 'PHASE_2', color: 'GREEN', score: 7, approved: 7, submitted: 1, redo: 0, kickOff: '15 apr 2026', eind: '15 aug 2026', uren: 8, nextCheckIn: '18 jul', coach: 'Priya Sharma', certified: false },
  { id: 9, naam: 'Lotte Jansen', vm: 'VA', phase: 'PHASE_3', color: 'GREEN', score: 8, approved: 10, submitted: 0, redo: 0, kickOff: '10 mrt 2026', eind: '10 jul 2026', uren: 14, nextCheckIn: '20 jul', coach: 'Priya Sharma', certified: true },
]

const upsellPipeline = [
  { naam: 'Eva Martens', vm: 'HTC', dagen: 9, status: 'COMING_UP', coach: 'Sanne de Vries', score: 8, certified: true },
  { naam: 'Lotte Jansen', vm: 'VA', dagen: -1, status: 'COMING_UP', coach: 'Priya Sharma', score: 8, certified: true },
  { naam: 'Anna Vermeer', vm: 'VA', dagen: -31, status: 'COMING_UP', coach: 'Demi van Leeuwen', score: 5, certified: false },
  { naam: 'Max Hulst', vm: 'HTC', dagen: -23, status: 'IN_CONVERSATION', coach: 'Priya Sharma', score: 9, certified: true },
  { naam: 'Sarah Klein', vm: 'VA', dagen: -71, status: 'RENEWED', coach: 'Sanne de Vries', score: 9, certified: true },
  { naam: 'Demi Steentjes', vm: 'AS', dagen: -25, status: 'RENEWED', coach: 'Priya Sharma', score: 10, certified: true },
  { naam: 'Britt Preuter', vm: 'HTC', dagen: -52, status: 'RENEWED', coach: 'Priya Sharma', score: 8, certified: true },
]

const activityFeed = [
  { icon: FileCheck, color: 'text-emerald-500 bg-emerald-50', time: '32 min geleden', text: 'Opdracht 7 van Marieke Hofman goedgekeurd', sub: 'HTC — Demi van Leeuwen' },
  { icon: Upload, color: 'text-blue-500 bg-blue-50', time: '1 uur geleden', text: 'Rick Bos heeft opdracht 4 ingeleverd', sub: 'Appointment Setting — wacht op review' },
  { icon: Star, color: 'text-yellow-500 bg-yellow-50', time: '2 uur geleden', text: 'Marieke Hofman gaf 9/10 feedback', sub: 'HTC — week 16' },
  { icon: Video, color: 'text-brand-500 bg-brand-50', time: '3 uur geleden', text: '1-op-1 call met Eva Martens (45 min)', sub: 'Fase 3 — opdrachtgevers besproken' },
  { icon: Trophy, color: 'text-purple-500 bg-purple-50', time: 'Gisteren', text: 'Sarah Klein — COMMUNITY MEMBERSHIP gestart', sub: '€100/maand — upsell renewed' },
  { icon: AlertTriangle, color: 'text-red-500 bg-red-50', time: 'Gisteren', text: 'Anna Vermeer: 14 dagen geen activiteit', sub: 'VA Fase 2 — 2/10 opdrachten — CHECK-IN NODIG' },
  { icon: UserPlus, color: 'text-cyan-500 bg-cyan-50', time: '2 dagen geleden', text: 'Tom van Dijk gestart met onboarding', sub: 'HTC — kick-off op 5 jul' },
  { icon: Award, color: 'text-violet-500 bg-violet-50', time: '3 dagen geleden', text: 'Britt Rikkerink: opdracht 7 submitted', sub: 'Appointment Setting — wacht op review' },
  { icon: MessageCircle, color: 'text-slate-500 bg-slate-100', time: '4 dagen geleden', text: 'Check-in met Jasper Smit', sub: '"Druk met werk, pakt volgende week weer op"' },
]

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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Delivery & Coaching</h1>
          <p className="text-sm text-slate-500 mt-0.5">Student journey, opdrachten, check-ins en upsell pipeline</p>
        </div>
        <div className="flex gap-2">
          <Link href="/delivery/backfill" className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
            <ClipboardCheck className="w-4 h-4" /> Backfill
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
            <KpiCard label="Total students" value={45} caption="+6 deze maand" captionColor="green" />
            <KpiCard label="In Fase 2" value={19} caption="actief aan opdrachten" />
            <KpiCard label="Opdrachten deze week" value={14} caption="8 approved, 3 pending" />
            <KpiCard label="Needs attention" value={4} caption="2 OVERDUE check-in" captionColor="red" />
            <KpiCard label="Gecertificeerd" value={5} caption="deze maand: 2" captionColor="green" />
            <KpiCard label="Upsell revenue" value="€ 51K" caption="12 upsells total" captionColor="green" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Coach cards */}
            <div className="lg:col-span-2">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Coaches</h3>
              <div className="space-y-3">
                {coaches.map(c => {
                  const phases = [{ l: 'F1', n: c.f1, cl: 'bg-cyan-400' }, { l: 'F2', n: c.f2, cl: 'bg-blue-400' }, { l: 'F3', n: c.f3, cl: 'bg-purple-400' }, { l: 'Done', n: c.completed, cl: 'bg-emerald-400' }]
                  return (
                    <div key={c.id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 hover:shadow-md transition cursor-pointer" onClick={() => setTab('phases')}>
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-brand-500 flex items-center justify-center text-white text-sm font-bold shrink-0">{c.foto}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div><div className="font-semibold text-slate-900">{c.naam}</div><div className="text-[11px] text-slate-400">{c.role}</div></div>
                            <StatusBadge status={c.status} />
                          </div>
                          <div className="grid grid-cols-5 gap-2 mt-3 text-center">
                            {[
                              { v: c.studenten, l: 'Students', cl: '' },
                              { v: c.uren, l: 'Hours', cl: '' },
                              { v: c.tevredenheid, l: 'Score', cl: c.tevredenheid >= 8 ? 'text-emerald-600' : 'text-yellow-600' },
                              { v: c.certified, l: 'Certified', cl: 'text-violet-600' },
                              { v: c.upsells, l: 'Upsells', cl: 'text-brand-600' },
                            ].map((s, i) => (
                              <div key={i}><div className={`text-base font-bold ${s.cl || 'text-slate-900'}`}>{s.v}</div><div className="text-[10px] text-slate-400">{s.l}</div></div>
                            ))}
                          </div>
                          <div className="mt-3 flex w-full h-2 rounded-full overflow-hidden bg-slate-100">
                            {phases.map((p, i) => <div key={i} className={`${p.cl}`} style={{ width: `${(p.n / c.studenten) * 100}%` }} />)}
                          </div>
                          <div className="flex gap-3 mt-1.5">{phases.map((p, i) => <span key={i} className="text-[10px] text-slate-400">{p.l}: {p.n}</span>)}</div>
                          {c.stopped > 0 && (
                            <div className="mt-2 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                              <AlertTriangle className="w-3.5 h-3.5" /> {c.stopped} student needs attention
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Activity feed */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Activiteit</h3>
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 space-y-4">
                {activityFeed.map((a, i) => {
                  const Icon = a.icon
                  return (
                    <div key={i} className="flex gap-3">
                      <div className="shrink-0"><div className={`w-8 h-8 rounded-full ${a.color} flex items-center justify-center`}><Icon className="w-3.5 h-3.5" /></div></div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <p className="text-[13px] text-slate-700">{a.text}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{a.time} · {a.sub}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ═══ FASE BOARD ═══ */}
      {tab === 'phases' && (
        <>
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
                      <div className="p-2 space-y-2 min-h-[200px]">
                        {items.length === 0 ? <div className="text-[10px] text-slate-300 text-center py-8">Geen studenten</div> :
                          items.map(s => {
                            const cs = colorStyles[s.color]
                            return (
                              <div key={s.id} className={`cursor-pointer bg-white border border-slate-100 rounded-lg p-3 ${cs.bg} ring-1 ${cs.ring} hover:shadow-md transition`}>
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="relative">
                                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
                                      {s.naam.split(' ').map(w => w[0]).join('').slice(0, 2)}
                                    </div>
                                    <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ${cs.dot} ring-2 ring-white`} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-[13px] font-medium text-slate-900 truncate">{s.naam}</div>
                                    <div className="text-[10px] text-slate-400">{vmLabels[s.vm]}</div>
                                  </div>
                                </div>
                                {s.phase === 'PHASE_2' && (
                                  <div className="mb-2">
                                    <div className="flex justify-between text-[10px] mb-0.5">
                                      <span className="text-slate-500">Opdrachten</span>
                                      <span className={`font-medium ${cs.text}`}>{s.approved}/10</span>
                                    </div>
                                    <div className="flex gap-0.5">
                                      {Array.from({ length: 10 }, (_, i) => {
                                        const st = i < s.approved ? 'bg-emerald-400' : i < s.approved + s.redo ? 'bg-red-400' : i < s.approved + s.redo + s.submitted ? 'bg-yellow-400' : 'bg-slate-200'
                                        return <div key={i} className={`flex-1 h-1.5 rounded-full ${st}`} />
                                      })}
                                    </div>
                                  </div>
                                )}
                                {s.phase === 'PHASE_3' && s.certified && (
                                  <div className="mb-2"><span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">Gecertificeerd</span></div>
                                )}
                                <div className="flex items-center justify-between text-[10px]">
                                  <div className="flex items-center gap-1.5">
                                    {s.score && <span className={`${s.score >= 8 ? 'text-emerald-600' : s.score >= 6 ? 'text-yellow-600' : 'text-red-600'} font-medium`}>{s.score}/10</span>}
                                    <span className="text-slate-300">·</span>
                                    <span className="text-slate-400">{s.uren}h</span>
                                  </div>
                                  <span className={s.nextCheckIn === 'OVERDUE' ? 'text-red-500 font-semibold' : 'text-slate-400'}>
                                    {s.nextCheckIn === 'OVERDUE' ? 'CHECK-IN!' : s.nextCheckIn === '-' ? '' : s.nextCheckIn}
                                  </span>
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KpiCard label="Traject verloopt" value={3} caption="binnen 14 dagen" />
            <KpiCard label="In gesprek" value={1} caption="community membership" />
            <KpiCard label="Renewed" value={3} caption="€ 300/maand recurring" captionColor="green" />
            <KpiCard label="Conversion rate" value="75%" caption="3 van 4 geconverteerd" captionColor="green" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {[
              { key: 'COMING_UP', label: 'Traject verloopt', desc: 'Binnen 14 dagen / verlopen', border: 'border-yellow-400', Icon: Clock, hbg: 'bg-yellow-50' },
              { key: 'IN_CONVERSATION', label: 'In gesprek', desc: 'Community membership besproken', border: 'border-orange-400', Icon: MessageSquare, hbg: 'bg-orange-50' },
              { key: 'RENEWED', label: 'Renewed', desc: 'Community membership gestart', border: 'border-emerald-400', Icon: CheckCircle, hbg: 'bg-emerald-50' },
            ].map(col => {
              const items = upsellPipeline.filter(u => u.status === col.key)
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
                    {items.map((u, i) => (
                      <div key={i} className="px-5 py-4 hover:bg-slate-50 transition cursor-pointer">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
                            {u.naam.split(' ').map(w => w[0]).join('').slice(0, 2)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-900">{u.naam}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full ${vmColors[u.vm]}`}>{vmLabels[u.vm]}</span>
                              {u.certified && <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">Certified</span>}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`${u.score >= 8 ? 'text-emerald-600' : u.score >= 6 ? 'text-yellow-600' : 'text-red-600'} text-sm font-bold`}>{u.score}/10</div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">{u.coach}</span>
                          <span className={u.dagen <= 0 ? 'text-red-500 font-semibold' : u.dagen <= 7 ? 'text-amber-600 font-medium' : 'text-slate-400'}>
                            {u.dagen <= 0 ? `${Math.abs(u.dagen)}d over` : `${u.dagen}d left`}
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
