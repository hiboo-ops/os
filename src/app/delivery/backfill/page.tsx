'use client'

import { supabase } from '@/lib/supabase'
import { useEffect, useState, useCallback } from 'react'
import { StatusBadge } from '@/components/status-badge'
import { ChevronLeft, ChevronRight, Check, AlertTriangle, Search } from 'lucide-react'

interface Student {
  id: string
  name: string
  phase: string | null
  verdienmodel: string | null
  activity_status: string
  coach_id: string | null
  kick_off_date: string | null
  coach_notes: string | null
  client: {
    id: string
    name: string
    email: string
    phone: string | null
    start_date: string | null
    program: string | null
    status: string
  }
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
  PHASE_1: 'Fase 1 — Leren',
  PHASE_2: 'Fase 2 — Opdrachten',
  PHASE_3: 'Fase 3 — Opdrachtgevers',
  CERTIFIED: 'Gecertificeerd',
  COMPLETED: 'Afgerond',
}

const vmLabels: Record<string, string> = {
  HIGH_TICKET_CLOSING: 'High Ticket Closing',
  VA: 'Virtual Assistant',
  APPOINTMENT_SETTING: 'Appointment Setting',
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

  // Form state for current student
  const [form, setForm] = useState({
    phase: '' as string,
    verdienmodel: '' as string,
    activity_status: 'GREEN' as string,
    coach_id: '' as string,
    kick_off_date: '' as string,
    coach_notes: '' as string,
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    const [studentsRes, coachesRes] = await Promise.all([
      supabase
        .from('students')
        .select('id, name, phase, verdienmodel, activity_status, coach_id, kick_off_date, coach_notes, client:clients(id, name, email, phone, start_date, program, status)')
        .order('name'),
      supabase.from('coaches').select('id, name, status').order('name'),
    ])

    if (studentsRes.data) setStudents(studentsRes.data as unknown as Student[])
    if (coachesRes.data) setCoaches(coachesRes.data)
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const filtered = students.filter(s => {
    if (filter === 'incomplete') {
      const isIncomplete = !s.coach_id || !s.verdienmodel
      if (!isIncomplete) return false
    }
    if (search) {
      const q = search.toLowerCase()
      return s.name.toLowerCase().includes(q) || s.client?.email?.toLowerCase().includes(q)
    }
    return true
  })

  const current = filtered[currentIndex]
  const totalIncomplete = students.filter(s => !s.coach_id || !s.verdienmodel).length
  const totalComplete = students.length - totalIncomplete
  const pct = students.length > 0 ? Math.round((totalComplete / students.length) * 100) : 0

  // Load form when current student changes
  useEffect(() => {
    if (!current) return
    setForm({
      phase: current.phase || 'PHASE_1',
      verdienmodel: current.verdienmodel || '',
      activity_status: current.activity_status || 'GREEN',
      coach_id: current.coach_id || '',
      kick_off_date: current.kick_off_date || current.client?.start_date || '',
      coach_notes: current.coach_notes || '',
    })
    setSaved(false)
  }, [currentIndex, current])

  const save = async () => {
    if (!current) return
    setSaving(true)
    const res = await fetch('/api/students', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId: current.id,
        phase: form.phase || null,
        verdienmodel: form.verdienmodel || null,
        activity_status: form.activity_status,
        coach_id: form.coach_id || null,
        kick_off_date: form.kick_off_date || null,
        coach_notes: form.coach_notes || null,
      }),
    })
    setSaving(false)
    if (res.ok) {
      setSaved(true)
      // Update local state
      setStudents(prev => prev.map(s =>
        s.id === current.id ? { ...s, ...form, phase: form.phase, verdienmodel: form.verdienmodel } : s
      ))
    }
  }

  const saveAndNext = async () => {
    await save()
    if (currentIndex < filtered.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Laden...</div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Student Backfill</h1>
          <p className="text-sm text-slate-500 mt-0.5">Vul ontbrekende data aan per student</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-700">Voortgang</span>
          <span className="text-sm font-bold text-brand-600">{totalComplete} / {students.length} compleet ({pct}%)</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-3">
          <div
            className="bg-brand-500 h-3 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-slate-400">
          <span>{totalIncomplete} nog te doen</span>
          <span>{totalComplete} afgerond</span>
        </div>
      </div>

      {/* Filters + search */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex bg-white rounded-lg border border-slate-200 p-0.5">
          <button
            onClick={() => { setFilter('incomplete'); setCurrentIndex(0) }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${filter === 'incomplete' ? 'bg-brand-600 text-white' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Incompleet ({totalIncomplete})
          </button>
          <button
            onClick={() => { setFilter('all'); setCurrentIndex(0) }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${filter === 'all' ? 'bg-brand-600 text-white' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Alles ({students.length})
          </button>
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Zoek op naam of email..."
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentIndex(0) }}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <span className="text-xs text-slate-400">{currentIndex + 1} / {filtered.length}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl p-12 shadow-sm border border-slate-100 text-center">
          <Check className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-900">Alles is compleet!</h3>
          <p className="text-sm text-slate-500 mt-1">Alle studenten hebben coach en verdienmodel ingevuld.</p>
        </div>
      ) : current && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Student info (read-only) */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Student info</h3>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-brand-500 flex items-center justify-center text-white font-bold">
                {current.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="font-semibold text-slate-900">{current.name}</div>
                <div className="text-xs text-slate-400">{current.client?.email}</div>
              </div>
            </div>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Telefoon</dt>
                <dd className="text-slate-900">{current.client?.phone || '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Programma</dt>
                <dd className="text-slate-900">{current.client?.program || '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Startdatum</dt>
                <dd className="text-slate-900">{current.client?.start_date || '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Status</dt>
                <dd><StatusBadge status={current.client?.status || 'UNKNOWN'} /></dd>
              </div>
            </dl>
            {current.coach_notes && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Oude notitie</div>
                <p className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">{current.coach_notes}</p>
              </div>
            )}

            {/* Missing fields warning */}
            <div className="mt-4 space-y-1.5">
              {!current.coach_id && (
                <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5" /> Coach ontbreekt
                </div>
              )}
              {!current.verdienmodel && (
                <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5" /> Verdienmodel ontbreekt
                </div>
              )}
            </div>
          </div>

          {/* Right: Edit form */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Backfill data</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Coach */}
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Coach *</label>
                <select
                  value={form.coach_id}
                  onChange={e => setForm({ ...form, coach_id: e.target.value })}
                  className={`mt-1.5 w-full text-sm border rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 ${!form.coach_id ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200'}`}
                >
                  <option value="">— Selecteer coach —</option>
                  {coaches.filter(c => c.status === 'ACTIVE').map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                  <optgroup label="Inactief">
                    {coaches.filter(c => c.status === 'INACTIVE').map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* Verdienmodel */}
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Verdienmodel *</label>
                <select
                  value={form.verdienmodel}
                  onChange={e => setForm({ ...form, verdienmodel: e.target.value })}
                  className={`mt-1.5 w-full text-sm border rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 ${!form.verdienmodel ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200'}`}
                >
                  <option value="">— Selecteer verdienmodel —</option>
                  {VERDIENMODELLEN.map(vm => (
                    <option key={vm} value={vm}>{vmLabels[vm]}</option>
                  ))}
                </select>
              </div>

              {/* Fase */}
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Fase</label>
                <select
                  value={form.phase}
                  onChange={e => setForm({ ...form, phase: e.target.value })}
                  className="mt-1.5 w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {PHASES.map(p => (
                    <option key={p} value={p}>{phaseLabels[p]}</option>
                  ))}
                </select>
              </div>

              {/* Activiteitsstatus */}
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Activiteitsstatus</label>
                <div className="mt-1.5 flex gap-2">
                  {COLORS.map(c => {
                    const colorMap = { GREEN: 'bg-emerald-400', YELLOW: 'bg-yellow-400', RED: 'bg-red-400' }
                    const selected = form.activity_status === c
                    return (
                      <button
                        key={c}
                        onClick={() => setForm({ ...form, activity_status: c })}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition ${selected ? 'border-slate-400 bg-slate-50' : 'border-slate-200 hover:bg-slate-50'}`}
                      >
                        <div className={`w-3 h-3 rounded-full ${colorMap[c]}`} />
                        {c}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Kick-off datum */}
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Kick-off datum</label>
                <input
                  type="date"
                  value={form.kick_off_date}
                  onChange={e => setForm({ ...form, kick_off_date: e.target.value })}
                  className="mt-1.5 w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Notities */}
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Coach notities</label>
                <textarea
                  value={form.coach_notes}
                  onChange={e => setForm({ ...form, coach_notes: e.target.value })}
                  placeholder="Eventuele notities..."
                  rows={3}
                  className="mt-1.5 w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100">
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                  disabled={currentIndex === 0}
                  className="inline-flex items-center gap-1 px-3 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" /> Vorige
                </button>
                <button
                  onClick={() => setCurrentIndex(Math.min(filtered.length - 1, currentIndex + 1))}
                  disabled={currentIndex >= filtered.length - 1}
                  className="inline-flex items-center gap-1 px-3 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Volgende <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-3">
                {saved && (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                    <Check className="w-3.5 h-3.5" /> Opgeslagen
                  </span>
                )}
                <button
                  onClick={save}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Opslaan
                </button>
                <button
                  onClick={saveAndNext}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
                >
                  {saving ? 'Opslaan...' : 'Opslaan & volgende'}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Student list below */}
      <div className="mt-6 bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Alle studenten ({filtered.length})</h3>
        </div>
        <div className="max-h-64 overflow-y-auto divide-y divide-slate-50">
          {filtered.map((s, i) => {
            const isComplete = s.coach_id && s.verdienmodel
            const isCurrent = i === currentIndex
            return (
              <button
                key={s.id}
                onClick={() => setCurrentIndex(i)}
                className={`w-full flex items-center gap-3 px-5 py-2.5 text-left transition ${isCurrent ? 'bg-brand-50' : 'hover:bg-slate-50'}`}
              >
                <div className={`w-2 h-2 rounded-full ${isComplete ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <span className={`text-sm flex-1 ${isCurrent ? 'font-semibold text-brand-700' : 'text-slate-700'}`}>{s.name}</span>
                <span className="text-[10px] text-slate-400">{s.client?.email}</span>
                {isComplete && <Check className="w-3.5 h-3.5 text-emerald-500" />}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
