'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getHomeworkForClient, getCheckInsForClient } from '@/lib/queries/clients'
import { StatusBadge } from '@/components/status-badge'
import { X, Save, Check, ExternalLink, Copy, Plus, Video, FileCheck, Clock, Circle, RotateCcw, AlertCircle, Award, MessageCircle, Link as LinkIcon, FileEdit, Star } from 'lucide-react'

const vmLabels: Record<string, string> = { HIGH_TICKET_CLOSING: 'HIGH TICKET CLOSING', VA: 'VIRTUAL ASSISTANT', APPOINTMENT_SETTING: 'APPOINTMENT SETTING' }
const activityDots: Record<string, string> = { GREEN: 'bg-emerald-400', YELLOW: 'bg-yellow-400', RED: 'bg-red-400' }
const activityText: Record<string, string> = { GREEN: 'text-emerald-600', YELLOW: 'text-yellow-600', RED: 'text-red-600' }

const hwIcons: Record<string, typeof Check> = { APPROVED: Check, SUBMITTED: Clock, REDO: RotateCcw, NOT_SUBMITTED: Circle }
const hwColors: Record<string, string> = { APPROVED: 'text-emerald-600 bg-emerald-50', SUBMITTED: 'text-yellow-600 bg-yellow-50', REDO: 'text-red-600 bg-red-50', NOT_SUBMITTED: 'text-slate-400 bg-slate-50' }

interface StudentDetailProps {
  student: {
    id: string
    name: string
    phase: string | null
    verdienmodel: string | null
    activity_status: string
    coaching_hours: number | null
    kick_off_date: string | null
    certification_date: string | null
    last_check_in: string | null
    next_check_in: string | null
    coach_notes: string | null
    typeform_homework_link: string | null
    typeform_feedback_link: string | null
    google_docs_link: string | null
    coach: { id: string; name: string } | null
    client: { id: string; name: string; email: string; start_date: string | null; program: string | null; status: string } | null
  }
  onClose: () => void
  onUpdate: () => void
}

export function StudentDetail({ student: s, onClose, onUpdate }: StudentDetailProps) {
  const [homework, setHomework] = useState<Awaited<ReturnType<typeof getHomeworkForClient>>>([])
  const [checkIns, setCheckIns] = useState<Awaited<ReturnType<typeof getCheckInsForClient>>>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [newCheckIn, setNewCheckIn] = useState('')
  const [addingCheckIn, setAddingCheckIn] = useState(false)

  // Editable fields
  const [notes, setNotes] = useState(s.coach_notes || '')
  const [hwLink, setHwLink] = useState(s.typeform_homework_link || '')
  const [fbLink, setFbLink] = useState(s.typeform_feedback_link || '')
  const [docsLink, setDocsLink] = useState(s.google_docs_link || '')
  const [phase, setPhase] = useState(s.phase || 'PHASE_1')
  const [activityStatus, setActivityStatus] = useState(s.activity_status || 'GREEN')
  const [copied, setCopied] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    const [hw, ci] = await Promise.all([
      getHomeworkForClient(s.id),
      getCheckInsForClient(s.id),
    ])
    setHomework(hw)
    setCheckIns(ci)
    setLoading(false)
  }, [s.id])

  useEffect(() => { loadData() }, [loadData])

  const saveAll = async () => {
    setSaving(true)
    await supabase.from('students').update({
      coach_notes: notes || null,
      typeform_homework_link: hwLink || null,
      typeform_feedback_link: fbLink || null,
      google_docs_link: docsLink || null,
      phase,
      activity_status: activityStatus,
    }).eq('id', s.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    onUpdate()
  }

  const updateHomework = async (assignmentId: string, status: string) => {
    await fetch('/api/homework', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignmentId, status }),
    })
    loadData()
    onUpdate()
  }

  const createHomework = async () => {
    await fetch('/api/homework', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: s.id }),
    })
    loadData()
  }

  const addCheckIn = async () => {
    if (!newCheckIn.trim()) return
    setAddingCheckIn(true)
    await fetch('/api/check-ins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: s.id, notes: newCheckIn, type: 'MANUAL' }),
    })
    setNewCheckIn('')
    setAddingCheckIn(false)
    loadData()
    onUpdate()
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(''), 2000)
  }

  const phases = ['PHASE_1', 'PHASE_2', 'PHASE_3', 'COMPLETED']
  const phaseLabels: Record<string, string> = { PHASE_1: 'Fase 1', PHASE_2: 'Fase 2', PHASE_3: 'Fase 3', CERTIFIED: 'Gecertificeerd', COMPLETED: 'Afgerond' }
  const phaseIndex = phases.indexOf(phase)
  const approvedHw = homework.filter(h => h.status === 'APPROVED').length

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-slate-100 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-brand-500 flex items-center justify-center text-white text-sm font-bold">
                {s.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ${activityDots[activityStatus]} ring-2 ring-white`} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{s.name}</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">{s.client?.email}</span>
                {s.verdienmodel && <span className="inline-flex items-center text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">{vmLabels[s.verdienmodel] || s.verdienmodel}</span>}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100"><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        {/* Phase + Activity */}
        <div className="px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-1 mb-4">
            {['Leren', 'Opdrachten', 'Werk', 'Klaar'].map((label, i) => {
              const active = phaseIndex >= i
              const current = phaseIndex === i
              return (
                <div key={i} className="contents">
                  {i > 0 && <div className={`flex-1 h-0.5 ${active ? 'bg-brand-500' : 'bg-slate-200'}`} />}
                  <div className="flex flex-col items-center">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${active ? 'bg-brand-500 text-white' : 'bg-slate-200 text-slate-400'} ${current ? 'ring-2 ring-brand-200' : ''}`}>
                      {active && i < phaseIndex ? '✓' : i + 1}
                    </div>
                    <span className={`text-[9px] mt-1 ${active ? 'text-brand-600 font-medium' : 'text-slate-400'}`}>{label}</span>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[10px] font-semibold text-slate-400 uppercase">Fase</label>
              <select value={phase} onChange={e => setPhase(e.target.value)} className="mt-1 w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white">
                {Object.entries(phaseLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase">Status</label>
              <div className="mt-1 flex gap-1">
                {(['GREEN', 'YELLOW', 'RED'] as const).map(c => (
                  <button key={c} onClick={() => setActivityStatus(c)} className={`w-9 h-9 rounded-lg border flex items-center justify-center transition ${activityStatus === c ? 'border-slate-400 bg-slate-50' : 'border-slate-200'}`}>
                    <div className={`w-3.5 h-3.5 rounded-full ${activityDots[c]}`} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Opdrachten tracker */}
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Opdrachten ({approvedHw}/10)</h3>
            {docsLink && (
              <a href={docsLink} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 hover:text-brand-700 font-medium inline-flex items-center gap-1">
                <ExternalLink className="w-3 h-3" /> Google Docs
              </a>
            )}
          </div>

          {homework.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-slate-400 mb-3">Nog geen opdrachten aangemaakt</p>
              <button onClick={createHomework} className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 inline-flex items-center gap-2">
                <Plus className="w-4 h-4" /> 10 opdrachten aanmaken
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              {homework.map(hw => {
                const Icon = hwIcons[hw.status] || Circle
                const color = hwColors[hw.status] || hwColors.NOT_SUBMITTED
                return (
                  <div key={hw.id} className={`flex items-center gap-3 border border-slate-100 rounded-lg px-4 py-2.5 ${hw.status === 'SUBMITTED' ? 'ring-1 ring-yellow-300 bg-yellow-50/30' : ''}`}>
                    <span className="text-xs font-bold text-slate-400 w-5">{hw.assignment_number}</span>
                    <div className="flex-1">
                      <span className="text-sm text-slate-700">Opdracht {hw.assignment_number}</span>
                      {hw.reviewed_at && <span className="text-[10px] text-slate-400 ml-2">{new Date(hw.reviewed_at).toLocaleDateString('nl-NL')}</span>}
                    </div>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${color}`}>
                      <Icon className="w-3 h-3" /> {hw.status}
                    </span>
                    {hw.status === 'SUBMITTED' && (
                      <div className="flex gap-1 ml-1">
                        <button onClick={() => updateHomework(hw.id, 'APPROVED')} className="px-2 py-1 text-[10px] font-medium bg-emerald-500 text-white rounded hover:bg-emerald-600">Approve</button>
                        <button onClick={() => updateHomework(hw.id, 'REDO')} className="px-2 py-1 text-[10px] font-medium bg-red-500 text-white rounded hover:bg-red-600">Redo</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {approvedHw >= 10 && !s.certification_date && (
            <div className="mt-3 p-4 bg-violet-50 border border-violet-200 rounded-lg flex items-center gap-3">
              <Award className="w-5 h-5 text-violet-600" />
              <div>
                <span className="text-sm font-semibold text-violet-700">Alle opdrachten goedgekeurd!</span>
                <p className="text-xs text-violet-600">Certificeringsopdracht kan verstuurd worden.</p>
              </div>
            </div>
          )}
          {s.certification_date && (
            <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3">
              <Award className="w-5 h-5 text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-700">Gecertificeerd op {s.certification_date}</span>
            </div>
          )}
        </div>

        {/* Links */}
        <div className="px-6 py-5 border-b border-slate-100">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Links</h3>
          <div className="space-y-3">
            {[
              { label: 'Huiswerk link', icon: FileCheck, value: hwLink, setter: setHwLink, key: 'hw' },
              { label: 'Feedback link', icon: Star, value: fbLink, setter: setFbLink, key: 'fb' },
              { label: 'Google Docs', icon: FileEdit, value: docsLink, setter: setDocsLink, key: 'docs' },
            ].map(link => (
              <div key={link.key}>
                <label className="text-[10px] font-semibold text-slate-400 uppercase">{link.label}</label>
                <div className="mt-1 flex items-center gap-2">
                  <div className="flex-1 relative">
                    <link.icon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={link.value}
                      onChange={e => link.setter(e.target.value)}
                      placeholder={`Plak ${link.label.toLowerCase()} hier...`}
                      className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  {link.value && (
                    <>
                      <button onClick={() => copyToClipboard(link.value, link.key)} className={`px-2 py-2 rounded-lg text-xs font-medium transition ${copied === link.key ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                        {copied === link.key ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <a href={link.value} target="_blank" rel="noopener noreferrer" className="px-2 py-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Check-ins */}
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Check-ins ({checkIns.length})</h3>
          </div>

          {/* Add check-in */}
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newCheckIn}
              onChange={e => setNewCheckIn(e.target.value)}
              placeholder="Check-in notitie toevoegen..."
              onKeyDown={e => e.key === 'Enter' && addCheckIn()}
              className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              onClick={addCheckIn}
              disabled={addingCheckIn || !newCheckIn.trim()}
              className="px-3 py-2 bg-brand-600 text-white rounded-lg text-xs font-medium hover:bg-brand-700 disabled:opacity-50 inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>

          {checkIns.length > 0 ? (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {checkIns.map(ci => (
                <div key={ci.id} className="bg-slate-50 rounded-lg px-4 py-3">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs text-slate-500">{ci.date}</span>
                    <span className="text-[10px] text-slate-400 bg-white px-2 py-0.5 rounded">{ci.type}</span>
                  </div>
                  {ci.notes && <p className="text-sm text-slate-700">{ci.notes}</p>}
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-slate-400">Nog geen check-ins</p>}
        </div>

        {/* Coach notes */}
        <div className="px-6 py-5 border-b border-slate-100">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Coach notities</h3>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Notities over deze student..."
            rows={3}
            className="w-full text-sm border border-slate-200 rounded-lg px-4 py-3 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>

        {/* Quick info */}
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Programma</span><span className="font-medium text-slate-900">{s.client?.program || '—'}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Coach</span><span className="font-medium text-slate-900">{s.coach?.name || '—'}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Kick-off</span><span className="text-slate-900">{s.kick_off_date || '—'}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Coaching uren</span><span className="font-medium text-slate-900">{s.coaching_hours || 0}h</span></div>
          </div>
        </div>

        {/* Actions */}
        <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-slate-100 px-6 py-4 flex gap-3">
          <button onClick={saveAll} disabled={saving} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
            {saving ? 'Opslaan...' : saved ? <><Check className="w-4 h-4" /> Opgeslagen</> : <><Save className="w-4 h-4" /> Opslaan</>}
          </button>
          <a href={`/clients/${s.client?.id}`} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
            Client profiel
          </a>
        </div>
      </div>
    </div>
  )
}
