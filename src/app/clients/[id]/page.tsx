'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { getClientById, getStudentForClient, getPaymentsForClient, getDealsForClient, getFeedbackForClient, getHomeworkForClient, updateClientNotes } from '@/lib/queries/clients'
import { getCheckInsForStudent } from '@/lib/queries/delivery'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Progress, PhaseIndicator } from '@/components/ui/progress'
import { SkeletonPage } from '@/components/ui/skeleton'
import { formatDate, formatDateShort, eur } from '@/lib/format'
import { ArrowLeft, Pencil, MessageCircle, Mail, Phone, Calendar, AlertTriangle, TrendingUp, Save, Check } from 'lucide-react'

const vmLabels: Record<string, string> = { HIGH_TICKET_CLOSING: 'HIGH TICKET CLOSING', VA: 'VIRTUAL ASSISTANT', APPOINTMENT_SETTING: 'APPOINTMENT SETTING' }
const activityDots: Record<string, string> = { GREEN: 'bg-emerald-500', YELLOW: 'bg-amber-400', RED: 'bg-red-500' }
const activityText: Record<string, string> = { GREEN: 'text-emerald-600', YELLOW: 'text-amber-600', RED: 'text-red-600' }

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
        getStudentForClient(c.id), getPaymentsForClient(c.id),
        getDealsForClient(c.id), getFeedbackForClient(c.id),
      ])
      setStudent(s); setPayments(p); setDeals(d); setFeedback(f)
      if (s) {
        const [hw, ci] = await Promise.all([getHomeworkForClient(s.id), getCheckInsForStudent(s.id)])
        setHomework(hw); setCheckIns(ci)
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

  if (loading) return <SkeletonPage />
  if (!client) return <div className="text-center py-16"><p className="text-sm text-gray-500">Client niet gevonden</p></div>

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
  const statusDot = student?.activity_status === 'RED' ? 'red' : student?.activity_status === 'YELLOW' ? 'yellow' : 'green'

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link href="/clients" className="text-sm text-gray-500 hover:text-gray-700 inline-flex items-center gap-1.5 transition-colors duration-[120ms]">
          <ArrowLeft className="w-4 h-4" strokeWidth={1.75} /> Clients
        </Link>
      </div>

      {/* Header */}
      <Card className="mb-6">
        <div className="px-6 pt-6 pb-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <Avatar name={client.name || '?'} size="lg" status={statusDot as 'green' | 'yellow' | 'red'} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-lg font-semibold text-gray-900">{client.name}</h1>
                <Badge status={client.status} />
                {student?.verdienmodel && <Badge status={student.verdienmodel} />}
              </div>
              <div className="flex items-center gap-4 mt-1.5 text-sm text-gray-500 flex-wrap">
                {client.email && <span className="inline-flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" strokeWidth={1.75} /> {client.email}</span>}
                {client.phone && <span className="inline-flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" strokeWidth={1.75} /> {client.phone}</span>}
                {client.start_date && <span className="inline-flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" strokeWidth={1.75} /> {formatDate(client.start_date)}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="primary" size="sm"><Pencil className="w-3.5 h-3.5" /> Bewerken</Button>
              <Button variant="secondary" size="sm"><MessageCircle className="w-3.5 h-3.5" /> DM</Button>
            </div>
          </div>
        </div>

        {/* KPI strip */}
        <div className="border-t border-gray-100 px-6 py-4 grid grid-cols-3 lg:grid-cols-6 gap-6">
          {[
            { label: 'TCV', value: eur(client.tcv) },
            { label: 'Betaald', value: eur(totalPaid), color: 'text-emerald-600' },
            { label: 'Openstaand', value: eur(totalOpen) },
            { label: 'Collection', value: `${collectionRate}%`, color: collectionRate >= 80 ? 'text-emerald-600' : 'text-amber-600' },
            { label: 'Coaching', value: `${student?.coaching_hours || 0}h` },
            { label: 'Score', value: avgScore || '—', color: Number(avgScore) >= 8 ? 'text-emerald-600' : '' },
          ].map(kpi => (
            <div key={kpi.label}>
              <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">{kpi.label}</div>
              <div className={`text-lg font-semibold tabular-nums ${kpi.color || 'text-gray-900'}`}>{kpi.value}</div>
            </div>
          ))}
        </div>

        {/* Upsell alert */}
        {days != null && days <= 14 && client.status === 'ACTIVE' && (
          <div className="border-t border-amber-100 bg-amber-50 px-6 py-3 rounded-b-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" strokeWidth={1.75} />
              <span className="text-sm text-amber-700">
                <span className="font-medium">Traject verloopt {days <= 0 ? `${Math.abs(days)} dagen geleden` : `over ${days} dagen`}</span>
              </span>
            </div>
            <Button variant="primary" size="sm"><TrendingUp className="w-3.5 h-3.5" /> Upsell</Button>
          </div>
        )}
      </Card>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* LEFT (3/5) */}
        <div className="lg:col-span-3 space-y-6">

          {/* Delivery */}
          {student && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-medium text-gray-900">Delivery & Opdrachten</h2>
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${activityDots[student.activity_status] || activityDots.GREEN}`} />
                    <span className={`text-xs font-medium ${activityText[student.activity_status] || activityText.GREEN}`}>{student.activity_status}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <PhaseIndicator current={phaseIndex} className="mb-6" />

                {homework.length > 0 && (
                  <div className="mb-6">
                    <div className="flex justify-between text-xs mb-2">
                      <span className="text-gray-500">Opdrachten</span>
                      <span className="font-medium text-gray-700 tabular-nums">{approvedHw}/10</span>
                    </div>
                    <div className="flex gap-0.5 mb-2">
                      {Array.from({ length: 10 }, (_, i) => {
                        const color = i < approvedHw ? 'bg-emerald-400' : i < approvedHw + redoHw ? 'bg-red-400' : i < approvedHw + redoHw + submittedHw ? 'bg-amber-400' : 'bg-gray-100'
                        return <div key={i} className={`flex-1 h-2 rounded-sm ${color}`} />
                      })}
                    </div>
                    <div className="flex gap-4 text-xs text-gray-500">
                      {approvedHw > 0 && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-emerald-400" /> {approvedHw} approved</span>}
                      {submittedHw > 0 && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-amber-400" /> {submittedHw} submitted</span>}
                      {redoHw > 0 && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-red-400" /> {redoHw} redo</span>}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-4 gap-4 text-center bg-gray-50 rounded-lg p-3">
                  <div><div className="text-sm font-medium text-gray-900">{formatDateShort(student.kick_off_date)}</div><div className="text-[11px] text-gray-400">Kick-off</div></div>
                  <div><div className="text-sm font-medium text-gray-900">{formatDateShort(student.last_check_in)}</div><div className="text-[11px] text-gray-400">Check-in</div></div>
                  <div><div className="text-sm font-medium text-gray-900 tabular-nums">{student.coaching_hours || 0}h</div><div className="text-[11px] text-gray-400">Coaching</div></div>
                  <div><div className="text-sm font-medium text-gray-900 tabular-nums">{checkIns.length}</div><div className="text-[11px] text-gray-400">Check-ins</div></div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Finance */}
          <Card>
            <CardHeader>
              <h2 className="text-sm font-medium text-gray-900">Finance & Betalingen</h2>
            </CardHeader>
            {(() => {
              return (
                <>
                  {activePayments.length > 0 && (
                    <CardContent>
                      <div className="space-y-1.5">
                        {activePayments.map(p => (
                          <div key={p.id} className={`flex items-center gap-3 rounded-md px-4 py-2.5 ${p.status === 'PAID' ? 'bg-emerald-50/60' : p.status === 'OVERDUE' ? 'bg-red-50/60 ring-1 ring-red-200' : 'bg-blue-50/60 ring-1 ring-blue-200'}`}>
                            <span className="text-xs font-medium text-gray-400 w-5 tabular-nums">{p.payment_number}</span>
                            <span className="text-sm text-gray-900 flex-1 tabular-nums">{eur(p.amount)}</span>
                            <span className="text-xs text-gray-400 w-24">{formatDateShort(p.due_date)}</span>
                            <Badge status={p.status} />
                            <span className="text-xs text-gray-400 w-16 text-right">{p.provider || ''}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}

                  {legacyPayments.length > 0 && (
                    <div className={`px-5 py-4 ${activePayments.length > 0 ? 'border-t border-gray-100' : ''}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Athena historie</h3>
                          <Badge status="LEGACY" />
                        </div>
                        <span className="text-xs font-medium text-gray-500 tabular-nums">{legacyPayments.length} betalingen · {eur(legacyTotal)}</span>
                      </div>
                      <div className="space-y-1">
                        {legacyPayments.map(p => (
                          <div key={p.id} className="flex items-center gap-3 rounded-md px-4 py-2 bg-gray-50/60">
                            <span className="text-xs text-gray-300 w-5 tabular-nums">{p.payment_number}</span>
                            <span className="text-sm text-gray-500 flex-1 tabular-nums">{eur(p.amount)}</span>
                            <span className="text-xs text-gray-400 w-24">{formatDateShort(p.due_date)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {payments.length === 0 && (
                    <div className="px-5 py-10 text-center text-sm text-gray-400">Geen betalingen</div>
                  )}
                </>
              )
            })()}
            {deals.length > 0 && (
              <div className="px-5 pb-5 pt-2 border-t border-gray-100">
                {deals.map(d => (
                  <div key={d.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Badge status={d.deal_type || 'FIRST DEAL'} />
                      <span className="text-sm text-gray-900 font-medium">{d.deal_name} — {eur(d.tcv)}</span>
                      <span className="text-xs text-gray-400">geclosed door {d.closer?.name || '—'} op {formatDate(d.date)}</span>
                    </div>
                    <Badge status={d.stage || ''} />
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Calls & Feedback */}
          <Card>
            <CardHeader>
              <h2 className="text-sm font-medium text-gray-900">Calls & Feedback</h2>
            </CardHeader>
            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-100">
              <div className="px-5 py-4">
                <h3 className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-3">Check-ins ({checkIns.length})</h3>
                {checkIns.length > 0 ? (
                  <div className="space-y-2">
                    {checkIns.slice(0, 5).map(ci => (
                      <div key={ci.id} className="rounded-md px-3 py-2.5 bg-gray-50">
                        <div className="flex justify-between mb-0.5">
                          <span className="text-xs text-gray-500">{formatDate(ci.date)}</span>
                          <span className="text-[11px] text-gray-400 bg-white px-2 py-0.5 rounded">{ci.type}</span>
                        </div>
                        {ci.notes && <p className="text-xs text-gray-600">{ci.notes}</p>}
                      </div>
                    ))}
                  </div>
                ) : <p className="text-xs text-gray-400">Geen check-ins</p>}
              </div>
              <div className="px-5 py-4">
                <h3 className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-3">Feedback ({feedback.length})</h3>
                {feedback.length > 0 ? (
                  <div className="space-y-2">
                    {feedback.slice(0, 5).map(f => (
                      <div key={f.id} className="rounded-md px-3 py-2.5 bg-gray-50">
                        <div className="flex justify-between mb-0.5">
                          <span className="text-xs text-gray-500">{formatDate(f.date)}</span>
                          <span className={`text-sm font-semibold tabular-nums ${(f.score || 0) >= 8 ? 'text-emerald-600' : (f.score || 0) >= 6 ? 'text-amber-600' : 'text-red-600'}`}>{f.score}/10</span>
                        </div>
                        {f.comments && <p className="text-xs text-gray-600">{f.comments}</p>}
                      </div>
                    ))}
                  </div>
                ) : <p className="text-xs text-gray-400">Geen feedback</p>}
              </div>
            </div>
          </Card>
        </div>

        {/* RIGHT (2/5) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Client info + Team */}
          <Card>
            <CardHeader><h2 className="text-sm font-medium text-gray-900">Klant</h2></CardHeader>
            <CardContent>
              <dl className="space-y-2.5 text-sm">
                <div className="flex justify-between"><dt className="text-gray-500">Programma</dt><dd className="font-medium text-gray-900">{client.program || '—'}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Bron</dt><dd className="text-gray-700">{client.source || '—'}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Provider</dt><dd className="text-gray-700">{client.payment_provider || '—'}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Upsell</dt><dd><Badge status={client.upsell_status || 'N/A'} /></dd></div>
              </dl>
              {days != null && (
                <div className="mt-5 pt-4 border-t border-gray-100">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-gray-500">Traject voortgang</span>
                    <span className={`font-medium tabular-nums ${days <= 0 ? 'text-red-600' : days <= 14 ? 'text-amber-600' : 'text-gray-600'}`}>
                      {days <= 0 ? `${Math.abs(days)}d over` : `${days}d`}
                    </span>
                  </div>
                  <Progress value={Math.min(100, Math.max(0, ((120 - days) / 120) * 100))} />
                </div>
              )}
            </CardContent>

            {/* Team */}
            <div className="px-5 pb-5 pt-2 border-t border-gray-100">
              <h3 className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-3">Team</h3>
              <div className="space-y-2.5">
                {client.coach && (
                  <div className="flex items-center gap-3">
                    <Avatar name={client.coach.name} size="sm" />
                    <span className="text-sm text-gray-900 font-medium flex-1">{client.coach.name}</span>
                    <span className="text-[11px] text-gray-400">Coach</span>
                  </div>
                )}
                {client.closer && (
                  <div className="flex items-center gap-3">
                    <Avatar name={client.closer.name} size="sm" />
                    <span className="text-sm text-gray-900 font-medium flex-1">{client.closer.name}</span>
                    <span className="text-[11px] text-gray-400">Closer</span>
                  </div>
                )}
                {client.creator && (
                  <div className="flex items-center gap-3">
                    <Avatar name={client.creator.name} size="sm" />
                    <span className="text-sm text-gray-900 font-medium flex-1">{client.creator.name}</span>
                    <span className="text-[11px] text-gray-400">Creator</span>
                  </div>
                )}
                {!client.coach && !client.closer && !client.creator && <p className="text-xs text-gray-400">Nog geen team</p>}
              </div>
            </div>
          </Card>

          {/* Notes */}
          <Card className="p-5">
            <h2 className="text-sm font-medium text-gray-900 mb-2">Notities</h2>
            <textarea
              value={notes}
              onChange={e => { setNotes(e.target.value); setNotesSaved(false) }}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent transition-shadow duration-[120ms]"
              rows={4}
              placeholder="Notities over deze klant..."
            />
            <div className="flex items-center gap-2 mt-2">
              <Button variant="primary" size="sm" onClick={saveNotes}>
                <Save className="w-3.5 h-3.5" /> Opslaan
              </Button>
              {notesSaved && <span className="text-xs text-emerald-600 inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Opgeslagen</span>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
