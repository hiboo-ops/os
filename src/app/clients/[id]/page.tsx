'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { getClientById, getStudentForClient, getPaymentsForClient, getDealsForClient, getFeedbackForClient, getHomeworkForClient, updateClientNotes } from '@/lib/queries/clients'
import { getCheckInsForStudent } from '@/lib/queries/delivery'
import { StatusBadge } from '@/components/status-badge'
import { formatDate, formatDateShort, eur } from '@/lib/format'
import { ArrowLeft, Pencil, MessageCircle, Mail, Phone, Calendar, Video, Star, CreditCard, FileCheck, Trophy, AlertTriangle, TrendingUp, Save, Check } from 'lucide-react'

const vmLabels: Record<string, string> = { HIGH_TICKET_CLOSING: 'HIGH TICKET CLOSING', VA: 'VIRTUAL ASSISTANT', APPOINTMENT_SETTING: 'APPOINTMENT SETTING' }
const activityDots: Record<string, string> = { GREEN: 'bg-emerald-400', YELLOW: 'bg-yellow-400', RED: 'bg-red-400' }
const activityText: Record<string, string> = { GREEN: 'text-emerald-600', YELLOW: 'text-yellow-600', RED: 'text-red-600' }
function daysLeft(startDate: string | null) {
  if (!startDate) return null
  const end = new Date(startDate)
  end.setMonth(end.getMonth() + 4)
  return Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

export default function ClientProfilePage() {
  const { id } = useParams<{ id: string }>()
  const [client, setClient] = useState<Awaited<ReturnType<typeof getClientById>>>(null)
  const [student, setStudent] = useState<Awaited<ReturnType<typeof getStudentForClient>>>(null)
  const [payments, setPayments] = useState<Awaited<ReturnType<typeof getPaymentsForClient>>>([])
  const [deals, setDeals] = useState<Awaited<ReturnType<typeof getDealsForClient>>>([])
  const [feedback, setFeedback] = useState<Awaited<ReturnType<typeof getFeedbackForClient>>>([])
  const [homework, setHomework] = useState<Awaited<ReturnType<typeof getHomeworkForClient>>>([])
  const [checkIns, setCheckIns] = useState<Awaited<ReturnType<typeof getCheckInsForStudent>>>([])
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState('')
  const [notesSaved, setNotesSaved] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const c = await getClientById(id)
    setClient(c)
    if (c) {
      setNotes(c.flags_notes || '')
      const [s, p, d, f] = await Promise.all([
        getStudentForClient(c.id),
        getPaymentsForClient(c.id),
        getDealsForClient(c.id),
        getFeedbackForClient(c.id),
      ])
      setStudent(s)
      setPayments(p)
      setDeals(d)
      setFeedback(f)
      if (s) {
        const [hw, ci] = await Promise.all([
          getHomeworkForClient(s.id),
          getCheckInsForStudent(s.id),
        ])
        setHomework(hw)
        setCheckIns(ci)
      }
    }
    setLoading(false)
  }, [id])

  useEffect(() => { loadData() }, [loadData])

  const saveNotes = async () => {
    if (!client) return
    const ok = await updateClientNotes(client.id, notes)
    if (ok) { setNotesSaved(true); setTimeout(() => setNotesSaved(false), 2000) }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-slate-400">Laden...</div></div>
  if (!client) return <div className="text-center py-12"><p className="text-slate-500">Client niet gevonden</p></div>

  const days = daysLeft(client.start_date)
  const activePayments = payments.filter(p => !p.legacy)
  const legacyPayments = payments.filter(p => p.legacy)
  const paidPayments = activePayments.filter(p => p.paid)
  const totalPaid = paidPayments.reduce((s, p) => s + (p.amount || 0), 0)
  const legacyTotal = legacyPayments.reduce((s, p) => s + (p.amount || 0), 0)
  const totalOpen = (client.tcv || 0) - totalPaid
  const collectionRate = activePayments.length > 0 ? Math.round((paidPayments.length / activePayments.length) * 100) : 0
  const avgScore = feedback.length > 0 ? (feedback.reduce((s, f) => s + (f.score || 0), 0) / feedback.length).toFixed(1) : null
  const approvedHw = homework.filter(h => h.status === 'APPROVED').length
  const submittedHw = homework.filter(h => h.status === 'SUBMITTED').length
  const redoHw = homework.filter(h => h.status === 'REDO').length
  const phases = ['PHASE_1', 'PHASE_2', 'PHASE_3', 'COMPLETED']
  const phaseIndex = student?.phase ? phases.indexOf(student.phase) : 0

  return (
    <div>
      <div className="mb-5">
        <Link href="/clients" className="text-sm text-brand-600 hover:text-brand-700 inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Clients
        </Link>
      </div>

      {/* ═══ HEADER ═══ */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 mb-6">
        <div className="px-6 pt-6 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-brand-500 flex items-center justify-center text-white text-xl font-bold">
                {client.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              {student && <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${activityDots[student.activity_status] || activityDots.GREEN} ring-3 ring-white`} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900">{client.name}</h1>
                <StatusBadge status={client.status} />
                {student?.verdienmodel && <span className="inline-flex items-center text-[10px] font-semibold px-2.5 py-1 rounded-full bg-violet-100 text-violet-700">{vmLabels[student.verdienmodel] || student.verdienmodel}</span>}
              </div>
              <div className="flex items-center gap-4 mt-1.5 text-sm text-slate-500 flex-wrap">
                {client.email && <span className="inline-flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {client.email}</span>}
                {client.phone && <span className="inline-flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {client.phone}</span>}
                {client.start_date && <span className="inline-flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {formatDate(client.start_date)}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700"><Pencil className="w-4 h-4" /> Bewerken</button>
              <button className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"><MessageCircle className="w-4 h-4" /> DM</button>
            </div>
          </div>
        </div>

        {/* KPI strip */}
        <div className="border-t border-slate-100 px-6 py-4 grid grid-cols-3 lg:grid-cols-6 gap-4">
          <div><div className="text-[10px] font-medium text-slate-400 uppercase">TCV</div><div className="text-lg font-bold text-slate-900">{eur(client.tcv)}</div></div>
          <div><div className="text-[10px] font-medium text-slate-400 uppercase">Betaald</div><div className="text-lg font-bold text-emerald-600">{eur(totalPaid)}</div></div>
          <div><div className="text-[10px] font-medium text-slate-400 uppercase">Openstaand</div><div className="text-lg font-bold text-slate-900">{eur(totalOpen)}</div></div>
          <div><div className="text-[10px] font-medium text-slate-400 uppercase">Collection</div><div className={`text-lg font-bold ${collectionRate >= 80 ? 'text-emerald-600' : 'text-amber-600'}`}>{collectionRate}%</div></div>
          <div><div className="text-[10px] font-medium text-slate-400 uppercase">Coaching</div><div className="text-lg font-bold text-slate-900">{student?.coaching_hours || 0}h</div></div>
          <div><div className="text-[10px] font-medium text-slate-400 uppercase">Satisfaction</div><div className="text-lg font-bold text-emerald-600">{avgScore || '—'}</div></div>
        </div>

        {/* Upsell alert */}
        {days != null && days <= 14 && client.status === 'ACTIVE' && (
          <div className="border-t border-yellow-200 bg-yellow-50 px-6 py-3 rounded-b-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
              <span className="text-sm text-yellow-700"><strong>Traject verloopt {days <= 0 ? `${Math.abs(days)} dagen geleden` : `over ${days} dagen`}</strong></span>
            </div>
            <button className="px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-medium hover:bg-brand-700 inline-flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> Start upsell</button>
          </div>
        )}
      </div>

      {/* ═══ TWO-COLUMN LAYOUT ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* LEFT (3/5) */}
        <div className="lg:col-span-3 space-y-6">

          {/* DELIVERY & OPDRACHTEN */}
          {student && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-100">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-700">Delivery & Opdrachten</h2>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${activityDots[student.activity_status] || activityDots.GREEN}`} />
                  <span className={`text-[10px] font-semibold ${activityText[student.activity_status] || activityText.GREEN}`}>{student.activity_status}</span>
                </div>
              </div>
              <div className="px-6 py-5">
                {/* Phase progress */}
                <div className="flex items-center gap-1 mb-5">
                  {['Leren', 'Opdrachten', 'Werk', 'Klaar'].map((label, i) => {
                    const active = phaseIndex >= i
                    const current = phaseIndex === i
                    return (
                      <div key={i} className="contents">
                        {i > 0 && <div className={`flex-1 h-0.5 ${active ? 'bg-brand-500' : 'bg-slate-200'}`} />}
                        <div className="flex flex-col items-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${active ? 'bg-brand-500 text-white' : 'bg-slate-200 text-slate-400'} ${current ? 'ring-2 ring-brand-200' : ''}`}>
                            {active && i < phaseIndex ? '✓' : i + 1}
                          </div>
                          <span className={`text-[9px] mt-1 ${active ? 'text-brand-600 font-medium' : 'text-slate-400'}`}>{label}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Assignments */}
                {homework.length > 0 && (
                  <div className="mb-5">
                    <div className="flex justify-between text-xs mb-1.5"><span className="text-slate-500">Opdrachten</span><span className="font-semibold text-brand-600">{approvedHw}/10 goedgekeurd</span></div>
                    <div className="flex gap-0.5 mb-2">
                      {Array.from({ length: 10 }, (_, i) => {
                        const st = i < approvedHw ? 'bg-emerald-400' : i < approvedHw + redoHw ? 'bg-red-400' : i < approvedHw + redoHw + submittedHw ? 'bg-yellow-400' : 'bg-slate-200'
                        return <div key={i} className={`flex-1 h-2.5 rounded-full ${st}`} />
                      })}
                    </div>
                    <div className="flex gap-4 text-[10px]">
                      {approvedHw > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> {approvedHw} approved</span>}
                      {submittedHw > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400" /> {submittedHw} submitted</span>}
                      {redoHw > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> {redoHw} redo</span>}
                    </div>
                  </div>
                )}

                {/* Quick stats */}
                <div className="grid grid-cols-4 gap-3 text-center bg-slate-50 rounded-lg p-3">
                  <div><div className="text-sm font-bold text-slate-900">{formatDateShort(student.kick_off_date)}</div><div className="text-[10px] text-slate-400">Kick-off</div></div>
                  <div><div className="text-sm font-bold text-slate-900">{formatDateShort(student.last_check_in)}</div><div className="text-[10px] text-slate-400">Last check-in</div></div>
                  <div><div className="text-sm font-bold text-slate-900">{student.coaching_hours || 0}h</div><div className="text-[10px] text-slate-400">Coaching</div></div>
                  <div><div className="text-sm font-bold text-slate-900">{checkIns.length}</div><div className="text-[10px] text-slate-400">Check-ins</div></div>
                </div>
              </div>
            </div>
          )}

          {/* FINANCE */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">Finance & Betalingen</h2>
            </div>
            {(() => {
              const activePayments = payments.filter(p => !p.legacy)
              const legacyPayments = payments.filter(p => p.legacy)
              const legacyTotal = legacyPayments.reduce((s, p) => s + (p.amount || 0), 0)

              return (
                <>
                  {/* Active payments */}
                  {activePayments.length > 0 && (
                    <div className="px-6 py-4">
                      <div className="space-y-1.5">
                        {activePayments.map(p => (
                          <div key={p.id} className={`flex items-center gap-3 rounded-lg px-4 py-2.5 ${p.status === 'PAID' ? 'bg-emerald-50/70' : p.status === 'OVERDUE' ? 'bg-red-50/70 ring-1 ring-red-200' : 'bg-blue-50/70 ring-1 ring-blue-200'}`}>
                            <span className="text-xs font-bold text-slate-400 w-5">{p.payment_number}</span>
                            <span className="text-sm text-slate-900 flex-1">{eur(p.amount)}</span>
                            <span className="text-xs text-slate-400 w-24">{formatDateShort(p.due_date)}</span>
                            <StatusBadge status={p.status} />
                            <span className="text-xs text-slate-400 w-16 text-right">{p.provider || ''}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Legacy payments */}
                  {legacyPayments.length > 0 && (
                    <div className={`px-6 py-4 ${activePayments.length > 0 ? 'border-t border-slate-100' : ''}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Athena historie</h3>
                          <span className="inline-flex items-center text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-600">LEGACY</span>
                        </div>
                        <span className="text-xs font-semibold text-slate-700">{legacyPayments.length} betalingen · {eur(legacyTotal)}</span>
                      </div>
                      <div className="space-y-1">
                        {legacyPayments.map(p => (
                          <div key={p.id} className="flex items-center gap-3 rounded-lg px-4 py-2 bg-slate-50/70">
                            <span className="text-xs font-bold text-slate-300 w-5">{p.payment_number}</span>
                            <span className="text-sm text-slate-600 flex-1">{eur(p.amount)}</span>
                            <span className="text-xs text-slate-400 w-24">{formatDateShort(p.due_date)}</span>
                            <span className="inline-flex items-center text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-500">PAID</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {payments.length === 0 && (
                    <div className="px-6 py-8 text-center text-sm text-slate-400">Geen betalingen</div>
                  )}
                </>
              )
            })()}
            {deals.length > 0 && (
              <div className="px-6 pb-5 pt-2 border-t border-slate-100">
                {deals.map(d => (
                  <div key={d.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <StatusBadge status={d.deal_type || 'FIRST DEAL'} />
                      <span className="text-sm text-slate-900 font-medium">{d.deal_name} — {eur(d.tcv)}</span>
                      <span className="text-xs text-slate-400">geclosed door {d.closer?.name || '—'} op {formatDate(d.date)}</span>
                    </div>
                    <StatusBadge status={d.stage || ''} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CALLS & FEEDBACK */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">Calls & Feedback</h2>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
              <div className="px-6 py-4">
                <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-3">Check-ins ({checkIns.length})</h3>
                {checkIns.length > 0 ? (
                  <div className="space-y-2">
                    {checkIns.slice(0, 5).map(ci => (
                      <div key={ci.id} className="rounded-lg px-3 py-2.5 bg-slate-50">
                        <div className="flex justify-between mb-0.5">
                          <span className="text-xs text-slate-500">{formatDate(ci.date)}</span>
                          <span className="text-[10px] bg-white px-2 py-0.5 rounded text-slate-400">{ci.type}</span>
                        </div>
                        {ci.notes && <p className="text-xs text-slate-600">{ci.notes}</p>}
                      </div>
                    ))}
                  </div>
                ) : <p className="text-xs text-slate-400">Geen check-ins</p>}
              </div>
              <div className="px-6 py-4">
                <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-3">Feedback ({feedback.length})</h3>
                {feedback.length > 0 ? (
                  <div className="space-y-2">
                    {feedback.slice(0, 5).map(f => (
                      <div key={f.id} className="rounded-lg px-3 py-2.5 bg-slate-50">
                        <div className="flex justify-between mb-0.5">
                          <span className="text-xs text-slate-500">{formatDate(f.date)}</span>
                          <span className={`text-sm font-bold ${(f.score || 0) >= 8 ? 'text-emerald-600' : (f.score || 0) >= 6 ? 'text-yellow-600' : 'text-red-600'}`}>{f.score}/10</span>
                        </div>
                        {f.comments && <p className="text-xs text-slate-600">{f.comments}</p>}
                      </div>
                    ))}
                  </div>
                ) : <p className="text-xs text-slate-400">Geen feedback</p>}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT (2/5) */}
        <div className="lg:col-span-2 space-y-6">

          {/* CLIENT INFO + TEAM */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-100"><h2 className="text-sm font-semibold text-slate-700">Klant</h2></div>
            <div className="px-6 py-4">
              <dl className="space-y-2.5 text-sm">
                <div className="flex justify-between"><dt className="text-slate-500">Programma</dt><dd className="font-medium text-slate-900">{client.program || '—'}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Bron</dt><dd className="text-slate-700">{client.source || '—'}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Provider</dt><dd className="text-slate-700">{client.payment_provider || '—'}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Upsell</dt><dd><StatusBadge status={client.upsell_status || 'N/A'} /></dd></div>
                {client.start_date && (
                  <div className="flex justify-between"><dt className="text-slate-500">Traject</dt><dd className="text-slate-900 font-medium">{formatDate(client.start_date)}</dd></div>
                )}
              </dl>
              {days != null && (
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500">Traject voortgang</span>
                    <span className={`font-medium ${days <= 0 ? 'text-red-600' : days <= 14 ? 'text-amber-600' : 'text-slate-600'}`}>
                      {days <= 0 ? `${Math.abs(days)}d over` : `${days}d resterend`}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div className="bg-brand-500 h-2 rounded-full" style={{ width: `${Math.min(100, Math.max(0, ((120 - days) / 120) * 100))}%` }} />
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 pb-5 pt-2 border-t border-slate-100">
              <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-3">Team</h3>
              <div className="space-y-2">
                {client.coach && (
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center text-white text-[9px] font-bold">{client.coach.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</div>
                    <span className="text-sm text-slate-900 font-medium flex-1">{client.coach.name}</span>
                    <span className="text-[10px] text-slate-400">Coach</span>
                  </div>
                )}
                {client.closer && (
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[9px] font-bold">{client.closer.name.slice(0, 2).toUpperCase()}</div>
                    <span className="text-sm text-slate-900 font-medium flex-1">{client.closer.name}</span>
                    <span className="text-[10px] text-slate-400">Closer</span>
                  </div>
                )}
                {client.creator && (
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-pink-500 flex items-center justify-center text-white text-[9px] font-bold">{client.creator.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</div>
                    <span className="text-sm text-slate-900 font-medium flex-1">{client.creator.name}</span>
                    <span className="text-[10px] text-slate-400">Creator</span>
                  </div>
                )}
                {!client.coach && !client.closer && !client.creator && <p className="text-xs text-slate-400">Nog geen team toegewezen</p>}
              </div>
            </div>
          </div>

          {/* NOTES */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-2">Notities</h2>
            <textarea
              value={notes}
              onChange={e => { setNotes(e.target.value); setNotesSaved(false) }}
              className="w-full text-sm border border-slate-200 rounded-lg px-4 py-3 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              rows={4}
              placeholder="Notities over deze klant..."
            />
            <div className="flex items-center gap-2 mt-2">
              <button onClick={saveNotes} className="px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-medium hover:bg-brand-700 inline-flex items-center gap-1">
                <Save className="w-3.5 h-3.5" /> Opslaan
              </button>
              {notesSaved && <span className="text-xs text-emerald-600 inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Opgeslagen</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
