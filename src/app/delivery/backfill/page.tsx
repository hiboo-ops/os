'use client'

import { supabase } from '@/lib/supabase'
import { useEffect, useState, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { formatDate, eur } from '@/lib/format'
import { ChevronLeft, ChevronRight, Check, AlertTriangle, Search, FileCheck, Star, MessageCircle, Award, Calendar, CreditCard } from 'lucide-react'

const iconProps = { strokeWidth: 1.75 } as const

interface Student {
  id: string
  name: string
  phase: string | null
  verdienmodel: string | null
  activity_status: string
  coach_id: string | null
  kick_off_date: string | null
  last_check_in: string | null
  certification_date: string | null
  coaching_hours: number | null
  coach_notes: string | null
  typeform_homework_link: string | null
  typeform_feedback_link: string | null
  google_docs_link: string | null
  client: {
    id: string
    name: string
    email: string
    phone: string | null
    start_date: string | null
    program: string | null
    status: string
    tcv: number | null
    source: string | null
    client_satisfaction: number | null
  }
  hwApproved: number
  hwTotal: number
  latestScore: number | null
  checkInCount: number
  totalPaid: number
  totalValue: number
  paymentCount: number
}

interface Coach {
  id: string
  name: string
  status: string
}

const PHASES = ['PHASE_1', 'PHASE_2', 'PHASE_3', 'CERTIFIED', 'COMPLETED'] as const
const VERDIENMODELLEN = ['HIGH_TICKET_CLOSING', 'VA', 'APPOINTMENT_SETTING'] as const
const COLORS = ['GREEN', 'YELLOW', 'RED'] as const

const phaseLabels: Record<string, string> = {
  PHASE_1: 'Fase 1 — Leren', PHASE_2: 'Fase 2 — Opdrachten',
  PHASE_3: 'Fase 3 — Opdrachtgevers', CERTIFIED: 'Gecertificeerd', COMPLETED: 'Afgerond',
}
const vmLabels: Record<string, string> = {
  HIGH_TICKET_CLOSING: 'High Ticket Closing', VA: 'Virtual Assistant', APPOINTMENT_SETTING: 'Appointment Setting',
}

export default function BackfillPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [loading, setLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [filter, setFilter] = useState<'all' | 'incomplete'>('incomplete')
  const [search, setSearch] = useState('')

  const [form, setForm] = useState({
    phase: '' as string,
    verdienmodel: '' as string,
    activity_status: 'GREEN' as string,
    coach_id: '' as string,
    kick_off_date: '' as string,
    last_check_in: '' as string,
    deal_value: '' as string,
    satisfaction: '' as string,
    coach_notes: '' as string,
    typeform_homework_link: '' as string,
    typeform_feedback_link: '' as string,
    google_docs_link: '' as string,
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    const [studentsRes, coachesRes] = await Promise.all([
      supabase
        .from('students')
        .select('id, name, phase, verdienmodel, activity_status, coach_id, kick_off_date, last_check_in, certification_date, coaching_hours, coach_notes, typeform_homework_link, typeform_feedback_link, google_docs_link, client:clients(id, name, email, phone, start_date, program, status, tcv, source, client_satisfaction)')
        .order('name'),
      supabase.from('coaches').select('id, name, status').order('name'),
    ])

    const rawStudents = (studentsRes.data || []) as unknown as Student[]

    // Get homework stats
    const { data: allHw } = await supabase.from('homework_assignments').select('student_id, status')
    const hwStats: Record<string, { approved: number; total: number }> = {}
    ;(allHw || []).forEach((h: { student_id: string; status: string }) => {
      if (!hwStats[h.student_id]) hwStats[h.student_id] = { approved: 0, total: 0 }
      hwStats[h.student_id].total++
      if (h.status === 'APPROVED') hwStats[h.student_id].approved++
    })

    // Get latest feedback
    const { data: feedback } = await supabase.from('feedback').select('client_id, score').order('date', { ascending: false })
    const scoreByClient: Record<string, number> = {}
    ;(feedback || []).forEach((f: { client_id: string; score: number }) => {
      if (f.client_id && !scoreByClient[f.client_id]) scoreByClient[f.client_id] = f.score
    })

    // Get check-in counts
    const { data: checkIns } = await supabase.from('check_ins').select('student_id')
    const ciCount: Record<string, number> = {}
    ;(checkIns || []).forEach((c: { student_id: string }) => {
      ciCount[c.student_id] = (ciCount[c.student_id] || 0) + 1
    })

    // Get payment stats per client
    const { data: allPayments } = await supabase.from('payments').select('client_id, amount, paid')
    const payStats: Record<string, { totalPaid: number; totalValue: number; count: number }> = {}
    ;(allPayments || []).forEach((p: { client_id: string; amount: number; paid: boolean }) => {
      if (!p.client_id) return
      if (!payStats[p.client_id]) payStats[p.client_id] = { totalPaid: 0, totalValue: 0, count: 0 }
      payStats[p.client_id].totalValue += p.amount || 0
      payStats[p.client_id].count++
      if (p.paid) payStats[p.client_id].totalPaid += p.amount || 0
    })

    const enriched = rawStudents.map(s => ({
      ...s,
      hwApproved: hwStats[s.id]?.approved || 0,
      hwTotal: hwStats[s.id]?.total || 0,
      latestScore: s.client?.id ? scoreByClient[s.client.id] ?? null : null,
      checkInCount: ciCount[s.id] || 0,
      totalPaid: s.client?.id ? payStats[s.client.id]?.totalPaid ?? 0 : 0,
      totalValue: s.client?.id ? payStats[s.client.id]?.totalValue ?? 0 : 0,
      paymentCount: s.client?.id ? payStats[s.client.id]?.count ?? 0 : 0,
    }))

    setStudents(enriched)
    if (coachesRes.data) setCoaches(coachesRes.data)
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const isComplete = (s: Student) => !!(s.coach_id && s.verdienmodel && s.last_check_in && s.client?.tcv && s.client?.client_satisfaction)

  const filtered = students.filter(s => {
    if (filter === 'incomplete') {
      if (isComplete(s)) return false
    }
    if (search) {
      const q = search.toLowerCase()
      return s.name.toLowerCase().includes(q) || s.client?.email?.toLowerCase().includes(q)
    }
    return true
  })

  const current = filtered[currentIndex]
  const totalIncomplete = students.filter(s => !isComplete(s)).length
  const totalComplete = students.length - totalIncomplete
  const pct = students.length > 0 ? Math.round((totalComplete / students.length) * 100) : 0

  useEffect(() => {
    if (!current) return
    setForm({
      phase: current.phase || 'PHASE_1',
      verdienmodel: current.verdienmodel || '',
      activity_status: current.activity_status || 'GREEN',
      coach_id: current.coach_id || '',
      kick_off_date: current.kick_off_date || current.client?.start_date || '',
      last_check_in: current.last_check_in || '',
      deal_value: current.client?.tcv?.toString() || '',
      satisfaction: current.client?.client_satisfaction?.toString() || '',
      coach_notes: current.coach_notes || '',
      typeform_homework_link: current.typeform_homework_link || '',
      typeform_feedback_link: current.typeform_feedback_link || '',
      google_docs_link: current.google_docs_link || '',
    })
    setSaved(false)
  }, [currentIndex, current])

  const save = async () => {
    if (!current) return
    setSaving(true)
    await fetch('/api/students', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId: current.id,
        phase: form.phase || null,
        verdienmodel: form.verdienmodel || null,
        activity_status: form.activity_status,
        coach_id: form.coach_id || null,
        kick_off_date: form.kick_off_date || null,
        last_check_in: form.last_check_in || null,
        coach_notes: form.coach_notes || null,
        typeform_homework_link: form.typeform_homework_link || null,
        typeform_feedback_link: form.typeform_feedback_link || null,
        google_docs_link: form.google_docs_link || null,
      }),
    })
    // Update TCV + satisfaction on client
    if (current.client?.id) {
      const clientUpdate: Record<string, unknown> = {}
      if (form.deal_value) clientUpdate.tcv = parseFloat(form.deal_value)
      if (form.satisfaction) clientUpdate.client_satisfaction = parseFloat(form.satisfaction)
      if (Object.keys(clientUpdate).length > 0) {
        await supabase.from('clients').update(clientUpdate).eq('id', current.client.id)
      }
    }

    setSaving(false)
    setSaved(true)
    setStudents(prev => prev.map(s =>
      s.id === current.id ? { ...s, ...form, client: s.client ? { ...s.client, tcv: form.deal_value ? parseFloat(form.deal_value) : s.client.tcv } : s.client } as Student : s
    ))
  }

  const saveAndNext = async () => {
    await save()
    if (currentIndex < filtered.length - 1) setCurrentIndex(currentIndex + 1)
  }

  const markCheckIn = () => {
    setForm({ ...form, last_check_in: new Date().toISOString().split('T')[0] })
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-gray-400">Laden...</div></div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Student Backfill</h1>
          <p className="text-sm text-gray-500 mt-0.5">Vul ontbrekende data aan per student</p>
        </div>
      </div>

      {/* Progress */}
      <div className="bg-white rounded-lg p-5 border border-gray-100 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Voortgang</span>
          <span className="text-sm font-semibold text-accent-700 tabular-nums">{totalComplete} / {students.length} compleet ({pct}%)</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3">
          <div className="bg-accent-700 h-3 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex bg-white rounded-lg border border-gray-200 p-0.5">
          <button onClick={() => { setFilter('incomplete'); setCurrentIndex(0) }} className={`px-3 py-1.5 text-xs font-medium rounded-md transition duration-[120ms] ${filter === 'incomplete' ? 'bg-accent-700 text-white' : 'text-gray-500'}`}>Incompleet ({totalIncomplete})</button>
          <button onClick={() => { setFilter('all'); setCurrentIndex(0) }} className={`px-3 py-1.5 text-xs font-medium rounded-md transition duration-[120ms] ${filter === 'all' ? 'bg-accent-700 text-white' : 'text-gray-500'}`}>Alles ({students.length})</button>
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" {...iconProps} />
          <input type="text" placeholder="Zoek..." value={search} onChange={e => { setSearch(e.target.value); setCurrentIndex(0) }}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-accent-700" />
        </div>
        <span className="text-xs text-gray-400 tabular-nums">{currentIndex + 1} / {filtered.length}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-lg p-12 border border-gray-100 text-center">
          <Check className="w-12 h-12 text-emerald-500 mx-auto mb-3" {...iconProps} />
          <h3 className="text-lg font-semibold text-gray-900">Alles is compleet!</h3>
        </div>
      ) : current && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT: Student info */}
          <div className="space-y-4">
            <div className="bg-white rounded-lg border border-gray-100 p-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Student info</h3>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-accent-700 flex items-center justify-center text-white font-semibold">
                  {current.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold text-gray-900">{current.name}</div>
                  <div className="text-xs text-gray-400">{current.client?.email}</div>
                </div>
              </div>
              <dl className="space-y-2.5 text-sm">
                <div className="flex justify-between"><dt className="text-gray-500">Telefoon</dt><dd className="text-gray-900">{current.client?.phone || '—'}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Programma</dt><dd className="text-gray-900">{current.client?.program || '—'}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Startdatum</dt><dd className="text-gray-900">{formatDate(current.client?.start_date)}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Status</dt><dd><Badge status={current.client?.status || 'UNKNOWN'} /></dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Bron</dt><dd><Badge status={current.client?.source || 'UNKNOWN'} /></dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Deal value</dt><dd className="text-gray-900 tabular-nums font-medium">{current.client?.tcv ? eur(current.client.tcv) : '—'}</dd></div>
              </dl>
            </div>

            {/* Gemigreerde data */}
            <div className="bg-white rounded-lg border border-gray-100 p-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Gemigreerde data</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <FileCheck className="w-4 h-4 text-blue-500 mx-auto mb-1" {...iconProps} />
                  <div className="text-lg font-semibold text-gray-900 tabular-nums">{current.hwApproved}/{Math.max(current.hwTotal, 10)}</div>
                  <div className="text-[11px] text-gray-500">Opdrachten</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <Star className="w-4 h-4 text-yellow-500 mx-auto mb-1" {...iconProps} />
                  <div className={`text-lg font-semibold tabular-nums ${(current.latestScore ?? 0) >= 8 ? 'text-emerald-600' : (current.latestScore ?? 0) >= 6 ? 'text-yellow-600' : current.latestScore ? 'text-red-600' : 'text-gray-300'}`}>
                    {current.latestScore ?? '—'}
                  </div>
                  <div className="text-[11px] text-gray-500">Feedback</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <CreditCard className="w-4 h-4 text-emerald-500 mx-auto mb-1" {...iconProps} />
                  <div className="text-lg font-semibold text-gray-900 tabular-nums">{eur(current.totalPaid)}</div>
                  <div className="text-[11px] text-gray-500">Betaald ({current.paymentCount}x)</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <MessageCircle className="w-4 h-4 text-accent-700 mx-auto mb-1" {...iconProps} />
                  <div className="text-lg font-semibold text-gray-900 tabular-nums">{current.checkInCount}</div>
                  <div className="text-[11px] text-gray-500">Check-ins</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center col-span-2">
                  <Award className="w-4 h-4 text-violet-500 mx-auto mb-1" {...iconProps} />
                  <div className="text-lg font-semibold text-gray-900">{current.certification_date ? '✓ Gecertificeerd' : '—'}</div>
                  <div className="text-[11px] text-gray-500">{current.certification_date ? formatDate(current.certification_date) : 'Certificaat'}</div>
                </div>
              </div>
              {current.certification_date && (
                <div className="mt-2 text-xs text-violet-600 bg-violet-50 rounded-lg px-3 py-2 text-center">
                  Gecertificeerd op {formatDate(current.certification_date)}
                </div>
              )}
            </div>

            {/* Warnings */}
            <div className="space-y-1.5">
              {!current.coach_id && <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2"><AlertTriangle className="w-3.5 h-3.5" {...iconProps} /> Coach ontbreekt</div>}
              {!current.verdienmodel && <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2"><AlertTriangle className="w-3.5 h-3.5" {...iconProps} /> Verdienmodel ontbreekt</div>}
              {!current.client?.tcv && <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2"><AlertTriangle className="w-3.5 h-3.5" {...iconProps} /> Deal value ontbreekt</div>}
              {!current.last_check_in && <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2"><AlertTriangle className="w-3.5 h-3.5" {...iconProps} /> Laatste check-in ontbreekt</div>}
              {!current.client?.client_satisfaction && <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2"><AlertTriangle className="w-3.5 h-3.5" {...iconProps} /> Tevredenheid ontbreekt</div>}
              {current.coach_notes && (
                <div className="bg-gray-50 rounded-lg px-3 py-2">
                  <div className="text-[11px] text-gray-400 mb-0.5">Oude notitie</div>
                  <p className="text-xs text-gray-600">{current.coach_notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Form */}
          <div className="lg:col-span-2 bg-white rounded-lg border border-gray-100 p-6">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Backfill data</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Coach */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Coach *</label>
                <select value={form.coach_id} onChange={e => setForm({ ...form, coach_id: e.target.value })}
                  className={`mt-1.5 w-full text-sm border rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700 ${!form.coach_id ? 'border-amber-300 bg-amber-50/50' : 'border-gray-200'}`}>
                  <option value="">— Selecteer —</option>
                  {coaches.filter(c => c.status === 'ACTIVE').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  <optgroup label="Inactief">{coaches.filter(c => c.status === 'INACTIVE').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
                </select>
              </div>

              {/* Verdienmodel */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Verdienmodel *</label>
                <select value={form.verdienmodel} onChange={e => setForm({ ...form, verdienmodel: e.target.value })}
                  className={`mt-1.5 w-full text-sm border rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700 ${!form.verdienmodel ? 'border-amber-300 bg-amber-50/50' : 'border-gray-200'}`}>
                  <option value="">— Selecteer —</option>
                  {VERDIENMODELLEN.map(vm => <option key={vm} value={vm}>{vmLabels[vm]}</option>)}
                </select>
              </div>

              {/* Fase */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Fase</label>
                <select value={form.phase} onChange={e => setForm({ ...form, phase: e.target.value })}
                  className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700">
                  {PHASES.map(p => <option key={p} value={p}>{phaseLabels[p]}</option>)}
                </select>
              </div>

              {/* Activiteitsstatus */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Activiteitsstatus</label>
                <div className="mt-1.5 flex gap-2">
                  {COLORS.map(c => {
                    const colorMap: Record<string, string> = { GREEN: 'bg-emerald-400', YELLOW: 'bg-yellow-400', RED: 'bg-red-400' }
                    return (
                      <button key={c} onClick={() => setForm({ ...form, activity_status: c })}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition ${form.activity_status === c ? 'border-gray-400 bg-gray-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                        <div className={`w-3 h-3 rounded-full ${colorMap[c]}`} />{c}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Kick-off datum */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Kick-off datum</label>
                <input type="date" value={form.kick_off_date} onChange={e => setForm({ ...form, kick_off_date: e.target.value })}
                  className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700" />
              </div>

              {/* Deal value */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Deal value (€) *</label>
                <input type="number" step="0.01" value={form.deal_value} onChange={e => setForm({ ...form, deal_value: e.target.value })}
                  placeholder="bijv. 3000"
                  className={`mt-1.5 w-full text-sm border rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700 tabular-nums ${!form.deal_value ? 'border-amber-300 bg-amber-50/50' : 'border-gray-200'}`} />
              </div>

              {/* Tevredenheid */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tevredenheid (1-10) *</label>
                <input type="number" min="1" max="10" step="0.1" value={form.satisfaction} onChange={e => setForm({ ...form, satisfaction: e.target.value })}
                  placeholder="bijv. 8"
                  className={`mt-1.5 w-full text-sm border rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700 tabular-nums ${!form.satisfaction ? 'border-amber-300 bg-amber-50/50' : 'border-gray-200'}`} />
              </div>

              {/* Laatste check-in */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Laatste check-in *</label>
                <div className="mt-1.5 flex gap-2">
                  <input type="date" value={form.last_check_in} onChange={e => setForm({ ...form, last_check_in: e.target.value })}
                    className={`flex-1 text-sm border rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700 ${!form.last_check_in ? 'border-amber-300 bg-amber-50/50' : 'border-gray-200'}`} />
                  <button onClick={markCheckIn} className="px-3 py-2.5 bg-accent-700 text-white rounded-lg text-xs font-medium hover:bg-accent-800 inline-flex items-center gap-1 shrink-0">
                    <Calendar className="w-3.5 h-3.5" {...iconProps} /> Vandaag
                  </button>
                </div>
              </div>

              {/* Links */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Huiswerk link</label>
                <input type="text" value={form.typeform_homework_link} onChange={e => setForm({ ...form, typeform_homework_link: e.target.value })}
                  placeholder="Typeform link..." className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Feedback link</label>
                <input type="text" value={form.typeform_feedback_link} onChange={e => setForm({ ...form, typeform_feedback_link: e.target.value })}
                  placeholder="Typeform link..." className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Google Docs link</label>
                <input type="text" value={form.google_docs_link} onChange={e => setForm({ ...form, google_docs_link: e.target.value })}
                  placeholder="Google Docs link..." className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700" />
              </div>

              {/* Notities */}
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notities</label>
                <textarea value={form.coach_notes} onChange={e => setForm({ ...form, coach_notes: e.target.value })}
                  placeholder="Eventuele notities..." rows={3}
                  className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-accent-700" />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
              <div className="flex gap-2">
                <button onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))} disabled={currentIndex === 0}
                  className="inline-flex items-center gap-1 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-30 transition duration-[120ms]">
                  <ChevronLeft className="w-4 h-4" {...iconProps} /> Vorige
                </button>
                <button onClick={() => setCurrentIndex(Math.min(filtered.length - 1, currentIndex + 1))} disabled={currentIndex >= filtered.length - 1}
                  className="inline-flex items-center gap-1 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-30 transition duration-[120ms]">
                  Volgende <ChevronRight className="w-4 h-4" {...iconProps} />
                </button>
              </div>
              <div className="flex items-center gap-3">
                {saved && <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><Check className="w-3.5 h-3.5" {...iconProps} /> Opgeslagen</span>}
                <button onClick={save} disabled={saving} className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition duration-[120ms]">Opslaan</button>
                <button onClick={saveAndNext} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent-700 text-white rounded-lg text-sm font-medium hover:bg-accent-800 disabled:opacity-50 transition duration-[120ms]">
                  {saving ? 'Opslaan...' : 'Opslaan & volgende'} <ChevronRight className="w-4 h-4" {...iconProps} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Student list */}
      <div className="mt-6 bg-white rounded-lg border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Alle studenten ({filtered.length})</h3>
        </div>
        <div className="max-h-64 overflow-y-auto divide-y divide-slate-50">
          {filtered.map((s, i) => {
            const isComplete = !!(s.coach_id && s.verdienmodel)
            const isCurrent = i === currentIndex
            return (
              <button key={s.id} onClick={() => setCurrentIndex(i)}
                className={`w-full flex items-center gap-3 px-5 py-2.5 text-left transition duration-[120ms] ${isCurrent ? 'bg-accent-50' : 'hover:bg-gray-50'}`}>
                <div className={`w-2 h-2 rounded-full ${isComplete ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <span className={`text-sm flex-1 ${isCurrent ? 'font-semibold text-accent-700' : 'text-gray-700'}`}>{s.name}</span>
                <span className="text-[11px] text-gray-400 w-8 tabular-nums">{s.hwApproved > 0 ? `${s.hwApproved}hw` : ''}</span>
                <span className="text-[11px] text-gray-400 w-8 tabular-nums">{s.latestScore ? `${s.latestScore}★` : ''}</span>
                <span className="text-[11px] text-gray-400 w-8 tabular-nums">{s.checkInCount > 0 ? `${s.checkInCount}ci` : ''}</span>
                <span className="text-[11px] text-gray-400">{s.client?.email}</span>
                {isComplete && <Check className="w-3.5 h-3.5 text-emerald-500" {...iconProps} />}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
