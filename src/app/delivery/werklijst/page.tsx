'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { StudentDetail } from '@/components/student-detail'
import {
  getPendingHomework, getCheckInOverdue, getStudentsForWorkList, getUpsellPipeline,
  StudentWithRelations, PendingHomework, WorkListStudent
} from '@/lib/queries/delivery'
import { eur } from '@/lib/format'
import {
  FileText, Clock, TrendingUp, Check, RotateCcw, ExternalLink,
  MessageCircle, ChevronRight, ClipboardCheck, AlertCircle, Send,
  Search, ArrowUpDown
} from 'lucide-react'

const iconProps = { strokeWidth: 1.75 } as const

const vmColors: Record<string, string> = { HIGH_TICKET_CLOSING: 'bg-violet-100 text-violet-700', VA: 'bg-sky-100 text-sky-700', APPOINTMENT_SETTING: 'bg-amber-100 text-amber-700' }
const vmShort: Record<string, string> = { HIGH_TICKET_CLOSING: 'HTC', VA: 'VA', APPOINTMENT_SETTING: 'AS' }
const dots: Record<string, string> = { GREEN: 'bg-emerald-400', YELLOW: 'bg-yellow-400', RED: 'bg-red-400' }
const phaseShort: Record<string, string> = { PHASE_1: 'F1', PHASE_2: 'F2', PHASE_3: 'F3', CERTIFIED: 'Cert', COMPLETED: 'Done' }

function initials(name: string) { return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() }
function timeAgo(dateStr: string | null) {
  if (!dateStr) return 'nooit'
  const days = Math.ceil((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
  if (days <= 0) return 'vandaag'
  if (days === 1) return '1 dag'
  return `${days}d`
}

export default function DeliveryPage() {
  const [pendingHw, setPendingHw] = useState<PendingHomework[]>([])
  const [overdueCheckins, setOverdueCheckins] = useState<(StudentWithRelations & { daysSinceContact: number })[]>([])
  const [upsells, setUpsells] = useState<Awaited<ReturnType<typeof getUpsellPipeline>>>([])
  const [students, setStudents] = useState<WorkListStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStudent, setSelectedStudent] = useState<StudentWithRelations | null>(null)
  const [sort, setSort] = useState<'contact' | 'name' | 'score' | 'hw'>('contact')
  const [search, setSearch] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    const [hw, ci, up, st] = await Promise.all([
      getPendingHomework(),
      getCheckInOverdue(14),
      getUpsellPipeline(),
      getStudentsForWorkList(),
    ])
    setPendingHw(hw)
    setOverdueCheckins(ci)
    setUpsells(up)
    setStudents(st as WorkListStudent[])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const approveHw = async (id: string) => {
    await fetch('/api/homework', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignmentId: id, status: 'APPROVED' }),
    })
    loadData()
  }

  const redoHw = async (id: string) => {
    await fetch('/api/homework', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignmentId: id, status: 'REDO' }),
    })
    loadData()
  }

  const sorted = [...students]
    .filter(s => {
      if (!search) return true
      const q = search.toLowerCase()
      return s.name.toLowerCase().includes(q) || s.client?.email?.toLowerCase().includes(q)
    })
    .sort((a, b) => {
      if (sort === 'contact') return b.daysSinceContact - a.daysSinceContact
      if (sort === 'name') return a.name.localeCompare(b.name)
      if (sort === 'score') return (b.latestScore ?? -1) - (a.latestScore ?? -1)
      if (sort === 'hw') return a.hwApproved - b.hwApproved
      return 0
    })

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-gray-400">Laden...</div></div>

  const totalActions = pendingHw.length + overdueCheckins.length + upsells.length

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Werklijst</h1>
          <p className="text-sm text-gray-500"><span className="tabular-nums">{students.length}</span> studenten</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {pendingHw.length > 0 && (
            <div className="flex items-center gap-2 bg-red-50 text-red-700 px-3 py-1.5 rounded-lg font-medium">
              <FileText className="w-4 h-4" {...iconProps} /> <span className="tabular-nums">{pendingHw.length}</span> huiswerk wacht
            </div>
          )}
          {overdueCheckins.length > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg font-medium">
              <Clock className="w-4 h-4" {...iconProps} /> <span className="tabular-nums">{overdueCheckins.length}</span> check-in overdue
            </div>
          )}
          <Link href="/delivery/backfill" className="flex items-center gap-2 bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg font-medium hover:bg-gray-200 transition duration-[120ms]">
            <ClipboardCheck className="w-4 h-4" {...iconProps} /> Backfill
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* LEFT (3/5): Inbox + Studenten */}
        <div className="lg:col-span-3 space-y-6">

          {/* HUISWERK NAKIJKEN */}
          {pendingHw.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-100">
              <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center"><FileText className="w-3.5 h-3.5 text-red-600" {...iconProps} /></div>
                  <h2 className="text-sm font-semibold text-gray-700">Huiswerk nakijken</h2>
                </div>
                <span className="inline-flex items-center justify-center w-6 h-6 text-[11px] font-semibold bg-red-500 text-white rounded-full tabular-nums">{pendingHw.length}</span>
              </div>
              <div className="divide-y divide-gray-50">
                {pendingHw.map(hw => (
                  <div key={hw.id} className="px-5 py-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-[11px] font-semibold text-gray-600">
                        {hw.student ? initials(hw.student.name) : '??'}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">{hw.student?.name || 'Onbekend'}</span>
                          {hw.student?.verdienmodel && <span className={`inline-flex items-center text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${vmColors[hw.student.verdienmodel] || 'bg-gray-100 text-gray-600'}`}>{vmShort[hw.student.verdienmodel] || hw.student.verdienmodel}</span>}
                        </div>
                        <div className="text-xs text-gray-500">Opdracht <span className="tabular-nums">{hw.assignment_number}</span> · {hw.submitted_at ? timeAgo(hw.submitted_at) : 'recent'}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-11">
                      {hw.google_docs_url && (
                        <a href={hw.google_docs_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200 transition duration-[120ms]">
                          <ExternalLink className="w-3 h-3" {...iconProps} /> Open docs
                        </a>
                      )}
                      <button onClick={() => approveHw(hw.id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-medium hover:bg-emerald-600 transition duration-[120ms]">
                        <Check className="w-3 h-3" {...iconProps} /> Approve
                      </button>
                      <button onClick={() => redoHw(hw.id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 transition duration-[120ms]">
                        <RotateCcw className="w-3 h-3" {...iconProps} /> Redo
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CHECK-IN OVERDUE */}
          {overdueCheckins.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-100">
              <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center"><Clock className="w-3.5 h-3.5 text-amber-600" {...iconProps} /></div>
                  <h2 className="text-sm font-semibold text-gray-700">Check-in nodig</h2>
                </div>
                <span className="inline-flex items-center justify-center w-6 h-6 text-[11px] font-semibold bg-amber-500 text-white rounded-full tabular-nums">{overdueCheckins.length}</span>
              </div>
              <div className="divide-y divide-gray-50">
                {overdueCheckins.slice(0, 10).map(s => (
                  <div key={s.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-gray-50/50 transition duration-[120ms]">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-[11px] font-semibold text-gray-600">{initials(s.name)}</div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ${dots[s.activity_status] || dots.GREEN} ring-2 ring-white`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{s.name}</span>
                        {s.verdienmodel && <span className={`inline-flex items-center text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${vmColors[s.verdienmodel] || ''}`}>{vmShort[s.verdienmodel] || s.verdienmodel}</span>}
                      </div>
                      <div className="text-xs text-gray-500">
                        {phaseShort[s.phase || ''] || '?'} · <span className="text-red-500 font-medium tabular-nums">{s.daysSinceContact}d geen contact</span>
                      </div>
                    </div>
                    <button onClick={() => setSelectedStudent(s)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent-700 text-white rounded-lg text-xs font-medium hover:bg-accent-800 transition duration-[120ms]">
                      <MessageCircle className="w-3 h-3" {...iconProps} /> Check-in
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* UPSELL SIGNAAL */}
          {upsells.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-100">
              <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center"><TrendingUp className="w-3.5 h-3.5 text-violet-600" {...iconProps} /></div>
                  <h2 className="text-sm font-semibold text-gray-700">Upsell signaal</h2>
                </div>
                <span className="inline-flex items-center justify-center w-6 h-6 text-[11px] font-semibold bg-violet-500 text-white rounded-full tabular-nums">{upsells.length}</span>
              </div>
              <div className="divide-y divide-gray-50">
                {upsells.map(u => (
                  <div key={u.id} className="px-5 py-3.5 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-[11px] font-semibold text-gray-600">{initials(u.name)}</div>
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-900">{u.name}</span>
                      <div className="text-xs">
                        <span className={u.daysLeft <= 0 ? 'text-red-500 font-semibold' : 'text-amber-600 font-medium'}>
                          {u.daysLeft <= 0 ? `${Math.abs(u.daysLeft)}d over` : `${u.daysLeft}d left`}
                        </span>
                        {u.certification_date && <span className="ml-2 text-violet-600">CERTIFIED</span>}
                      </div>
                    </div>
                    <button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-medium hover:bg-violet-700 transition duration-[120ms]">
                      <TrendingUp className="w-3 h-3" {...iconProps} /> Upsell
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Alle inbox leeg */}
          {totalActions === 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-8 text-center">
              <Check className="w-8 h-8 text-emerald-500 mx-auto mb-2" {...iconProps} />
              <h3 className="text-sm font-semibold text-emerald-700">Alles bijgewerkt!</h3>
              <p className="text-xs text-emerald-600 mt-1">Geen acties nodig op dit moment.</p>
            </div>
          )}

          {/* MIJN STUDENTEN */}
          <div className="bg-white rounded-lg border border-gray-100">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">Mijn studenten</h2>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" {...iconProps} />
                  <input
                    type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Zoek..."
                    className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white w-40 focus:outline-none focus:ring-2 focus:ring-accent-700"
                  />
                </div>
                <select value={sort} onChange={e => setSort(e.target.value as typeof sort)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
                  <option value="contact">Laatste contact</option>
                  <option value="name">Naam</option>
                  <option value="score">Score</option>
                  <option value="hw">Opdrachten</option>
                </select>
              </div>
            </div>

            {/* Column headers */}
            <div className="flex items-center gap-3 px-5 py-2 text-[11px] font-medium text-gray-400 uppercase tracking-wide border-b border-gray-100">
              <div className="w-8 shrink-0"></div>
              <div className="flex-1">Naam</div>
              <div className="w-10 text-center shrink-0">VM</div>
              <div className="w-8 text-center shrink-0">Fase</div>
              <div className="w-10 text-center shrink-0">HW</div>
              <div className="w-12 text-center shrink-0">Tevr.</div>
              <div className="w-20 text-right shrink-0">Betaald</div>
              <div className="w-16 text-right shrink-0">Contact</div>
              <div className="w-4 shrink-0"></div>
            </div>

            <div className="max-h-[500px] overflow-y-auto">
              {sorted.map(s => {
                const contactClass = s.daysSinceContact >= 14 ? 'text-red-500 font-semibold' : s.daysSinceContact >= 7 ? 'text-amber-600' : 'text-gray-400'
                return (
                  <div
                    key={s.id}
                    onClick={() => setSelectedStudent(s)}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 cursor-pointer transition duration-[120ms] border-b border-gray-50"
                  >
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-[11px] font-semibold text-gray-600">{initials(s.name)}</div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${dots[s.activity_status] || dots.GREEN} ring-2 ring-white`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 truncate">{s.name}</span>
                        {s.hwPending && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" title="HW pending" />}
                      </div>
                    </div>
                    <span className={`inline-flex items-center text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${vmColors[s.verdienmodel || ''] || 'bg-gray-100 text-gray-500'} shrink-0`}>
                      {vmShort[s.verdienmodel || ''] || '—'}
                    </span>
                    <span className="text-[11px] text-gray-500 w-8 text-center shrink-0">{phaseShort[s.phase || ''] || '?'}</span>
                    <span className="text-[11px] text-gray-500 w-10 text-center shrink-0 tabular-nums">{s.hwApproved}/{Math.max(s.hwTotal, 10)}</span>
                    <span className={`text-[11px] w-12 text-center shrink-0 tabular-nums ${(s.client?.client_satisfaction ?? 0) >= 8 ? 'text-emerald-600 font-medium' : (s.client?.client_satisfaction ?? 0) >= 6 ? 'text-amber-600' : s.client?.client_satisfaction ? 'text-red-600' : 'text-gray-300'}`}>
                      {s.client?.client_satisfaction ?? '—'}
                    </span>
                    <span className="text-[11px] text-gray-500 w-20 text-right shrink-0 tabular-nums">
                      {s.totalPaid > 0 ? eur(s.totalPaid) : '—'}
                    </span>
                    <span className={`text-[11px] tabular-nums ${contactClass} w-16 text-right shrink-0`}>
                      {s.daysSinceContact >= 999 ? 'nooit' : `${s.daysSinceContact}d`}
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" {...iconProps} />
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* RIGHT (2/5): Stats + Backfill */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg border border-gray-100 p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Overzicht</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-xl font-semibold text-red-600 tabular-nums">{pendingHw.length}</div>
                <div className="text-[11px] text-gray-500">HW te reviewen</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-xl font-semibold text-amber-600 tabular-nums">{overdueCheckins.length}</div>
                <div className="text-[11px] text-gray-500">Check-in overdue</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-xl font-semibold text-gray-900 tabular-nums">{students.length}</div>
                <div className="text-[11px] text-gray-500">Studenten</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-xl font-semibold text-violet-600 tabular-nums">{upsells.length}</div>
                <div className="text-[11px] text-gray-500">Upsell signalen</div>
              </div>
            </div>
          </div>

          {/* Fase verdeling */}
          <div className="bg-white rounded-lg border border-gray-100 p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Per fase</h3>
            {Object.entries(phaseShort).map(([key, label]) => {
              const count = students.filter(s => s.phase === key).length
              const pct = students.length > 0 ? (count / students.length) * 100 : 0
              const colors: Record<string, string> = { PHASE_1: 'bg-cyan-400', PHASE_2: 'bg-blue-400', PHASE_3: 'bg-purple-400', CERTIFIED: 'bg-violet-400', COMPLETED: 'bg-emerald-400' }
              return (
                <div key={key} className="flex items-center gap-3 mb-2">
                  <span className="text-xs text-gray-500 w-10">{label}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2"><div className={`${colors[key] || 'bg-gray-400'} h-2 rounded-full`} style={{ width: `${pct}%` }} /></div>
                  <span className="text-xs font-medium text-gray-700 w-8 text-right tabular-nums">{count}</span>
                </div>
              )
            })}
          </div>

          {/* Backfill link */}
          <Link href="/delivery/backfill" className="block bg-amber-50 border border-amber-200 rounded-lg p-5 hover:bg-amber-100 transition duration-[120ms]">
            <div className="flex items-center gap-2 mb-2">
              <ClipboardCheck className="w-4 h-4 text-amber-600" {...iconProps} />
              <h3 className="text-sm font-semibold text-amber-700">Backfill</h3>
            </div>
            <p className="text-xs text-amber-600">Werk ontbrekende data bij (coach, verdienmodel, fase).</p>
          </Link>
        </div>
      </div>

      {/* Student Detail Panel */}
      {selectedStudent && (
        <StudentDetail
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
          onUpdate={() => loadData()}
        />
      )}
    </div>
  )
}
