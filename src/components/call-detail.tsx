'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/format'
import type { Call, CallResult } from '@/lib/queries/sales'
import {
  X, Save, Check, Copy, ExternalLink,
  Phone, Mail, AtSign,
  Calendar, User, UserCheck, Globe, Video,
  Send, CreditCard, FileText, Plus,
} from 'lucide-react'

const iconProps = { strokeWidth: 1.75 } as const

const RESULT_OPTIONS: CallResult[] = [
  'CALL BOOKED', 'RESCHEDULE', 'FOLLOW UP', 'FOLLOW UP LONG TERM',
  'DEPOSIT', 'CLOSED', 'LOST - BROKE', 'LOST - NO INTEREST',
  'LOST - BAD FIT', 'NO SHOW', 'CANCELLED BY LEAD', 'CANCELLED BY CLOSER',
]

type PayProvider = 'STRIPE' | 'WHOP' | 'MANUAL'

interface PaymentLinkState {
  incoming_payment_id: string
  account_id: string
  pay_token: string
  provider: string
  url: string | null
  status: 'SCHEDULED' | 'PAID'
  is_deposit: boolean
}

interface ScheduleRow {
  amount: number
  due_date: string
}

interface CallDetailProps {
  call: Call
  onClose: () => void
  onUpdate: () => void
}

export function CallDetail({ call, onClose, onUpdate }: CallDetailProps) {
  // Editable state
  const [result, setResult] = useState<CallResult | ''>(call.result || '')
  const [fathomLink, setFathomLink] = useState(call.fathom_link || '')
  const [setterNotes, setSetterNotes] = useState(call.setter_notes || '')
  const [preCallNotes, setPreCallNotes] = useState(call.pre_call_notes || '')
  const [closingNotes, setClosingNotes] = useState(call.closing_notes || '')
  const [triageNotes, setTriageNotes] = useState(call.triage_notes || '')
  const [noDealReason, setNoDealReason] = useState(call.no_deal_reason || '')
  const [dealValue, setDealValue] = useState<number | ''>(call.deal_value ?? '')

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState('')
  const [slackSent, setSlackSent] = useState<Record<string, boolean>>({})

  // ── First Payment Link state ──
  const [payAmount, setPayAmount] = useState<number | ''>(call.first_deposit ?? '')
  const [payProvider, setPayProvider] = useState<PayProvider>('MANUAL')
  const [isDeposit, setIsDeposit] = useState(false)
  const [payLinkCreating, setPayLinkCreating] = useState(false)
  const [payLink, setPayLink] = useState<PaymentLinkState | null>(null)

  // ── Contract modal state ──
  const [showContractModal, setShowContractModal] = useState(false)

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(''), 2000)
  }

  const saveAll = async () => {
    setSaving(true)
    try {
      await fetch('/api/calls', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: call.id,
          result: result || null,
          fathom_link: fathomLink || null,
          setter_notes: setterNotes || null,
          pre_call_notes: preCallNotes || null,
          closing_notes: closingNotes || null,
          triage_notes: triageNotes || null,
          no_deal_reason: noDealReason || null,
          deal_value: dealValue === '' ? null : dealValue,
        }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      onUpdate()
    } catch (err) {
      console.error('Save failed:', err)
    } finally {
      setSaving(false)
    }
  }

  const sendToSlack = async (noteType: string) => {
    setSlackSent(prev => ({ ...prev, [noteType]: true }))
    setTimeout(() => {
      setSlackSent(prev => ({ ...prev, [noteType]: false }))
    }, 3000)
  }

  const createPaymentLink = async () => {
    if (!payAmount || payAmount <= 0) return
    setPayLinkCreating(true)
    try {
      const res = await fetch('/api/payment-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call_id: call.id,
          amount: payAmount,
          provider: payProvider,
          is_deposit: isDeposit,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setPayLink({
          incoming_payment_id: data.incoming_payment_id,
          account_id: data.account_id,
          pay_token: data.pay_token,
          provider: data.provider,
          url: data.url,
          status: 'SCHEDULED',
          is_deposit: data.is_deposit,
        })
        onUpdate()
      }
    } catch (err) {
      console.error('Payment link creation failed:', err)
    } finally {
      setPayLinkCreating(false)
    }
  }

  const formatTime = (dateStr: string | null): string => {
    if (!dateStr) return '—'
    try {
      const d = new Date(dateStr)
      return d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
    } catch {
      return '—'
    }
  }

  const showClosingPanel = result === 'CLOSED' || result === 'DEPOSIT'
  const canCreateContract = result === 'CLOSED' && payLink !== null

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl overflow-y-auto">

        {/* ── Header ── */}
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center text-white text-sm font-semibold shrink-0">
              {(call.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-gray-900 truncate">{call.name || 'Onbekend'}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                {call.result && <Badge status={call.result} size="sm" />}
                {call.source && (
                  <span className="inline-flex text-[10px] font-medium bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">
                    {call.source}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition duration-[120ms]">
            <X className="w-5 h-5 text-gray-400" {...iconProps} />
          </button>
        </div>

        {/* ── Contact Info ── */}
        <div className="px-6 py-5 border-b border-gray-100">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4 pb-2 border-b border-gray-50">Contactgegevens</h3>
          <div className="grid grid-cols-2 gap-4">
            <InfoRow icon={User} label="Naam" value={call.name} />
            <InfoRow icon={Mail} label="E-mail" value={call.email} />
            <InfoRow icon={Phone} label="Telefoon" value={call.phone} />
            <InfoRow icon={AtSign} label="Instagram" value={call.instagram} />
          </div>
        </div>

        {/* ── Scheduling ── */}
        <div className="px-6 py-5 border-b border-gray-100">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4 pb-2 border-b border-gray-50">Planning</h3>
          <div className="grid grid-cols-2 gap-4">
            <InfoRow icon={Calendar} label="Datum" value={call.date_start_time ? `${formatDate(call.date_start_time)} · ${formatTime(call.date_start_time)}` : null} />
            <InfoRow icon={UserCheck} label="Closer" value={call.closer?.name} />
            <InfoRow icon={User} label="Setter" value={call.setter?.name} />
            <InfoRow icon={Globe} label="Source" value={call.source} />
            {call.source_type && <InfoRow icon={Globe} label="Creator / Campaign" value={call.source_type} />}
            <InfoRow icon={Video} label="Event type" value={call.event_type} />
          </div>
        </div>

        {/* ── Meeting Links ── */}
        {(call.meeting_link || call.reschedule_link || call.cancel_link) && (
          <div className="px-6 py-5 border-b border-gray-100">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4 pb-2 border-b border-gray-50">Meeting Links</h3>
            <div className="flex flex-wrap gap-2">
              {call.meeting_link && (
                <a href={call.meeting_link} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-accent-700 text-white rounded-lg hover:bg-accent-800 transition-colors duration-[120ms]">
                  <Video className="w-3.5 h-3.5" {...iconProps} />
                  Meeting Link
                </a>
              )}
              {call.reschedule_link && (
                <a href={call.reschedule_link} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-[120ms]">
                  <Calendar className="w-3.5 h-3.5" {...iconProps} />
                  Reschedule
                </a>
              )}
              {call.cancel_link && (
                <a href={call.cancel_link} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-gray-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors duration-[120ms]">
                  <X className="w-3.5 h-3.5" {...iconProps} />
                  Cancel
                </a>
              )}
            </div>
          </div>
        )}

        {/* ── Sales Info (editable) ── */}
        <div className="px-6 py-5 border-b border-gray-100">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4 pb-2 border-b border-gray-50">Sales informatie</h3>
          <div className="space-y-4">

            {/* Result */}
            <div>
              <label className="text-[11px] font-semibold text-gray-400 uppercase">Result</label>
              <select
                value={result}
                onChange={e => setResult(e.target.value as CallResult)}
                className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700 transition-shadow duration-[120ms]"
              >
                <option value="">— Selecteer —</option>
                {RESULT_OPTIONS.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {/* Fathom Link */}
            <div>
              <label className="text-[11px] font-semibold text-gray-400 uppercase">Fathom Link</label>
              <input
                type="text"
                value={fathomLink}
                onChange={e => setFathomLink(e.target.value)}
                placeholder="Plak Fathom link hier..."
                className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700 transition-shadow duration-[120ms]"
              />
            </div>

            {/* Setter Notes */}
            <NoteField
              label="Setter Notes"
              value={setterNotes}
              onChange={setSetterNotes}
              onSendSlack={() => sendToSlack('setter')}
              slackSent={!!slackSent['setter']}
            />

            {/* Pre Call Notes */}
            <NoteField
              label="Pre Call Notes"
              value={preCallNotes}
              onChange={setPreCallNotes}
              onSendSlack={() => sendToSlack('pre_call')}
              slackSent={!!slackSent['pre_call']}
            />

            {/* Closing Notes */}
            <NoteField
              label="Closing Notes"
              value={closingNotes}
              onChange={setClosingNotes}
              onSendSlack={() => sendToSlack('closing')}
              slackSent={!!slackSent['closing']}
            />

            {/* Triage Notes */}
            <NoteField
              label="Triage Notes"
              value={triageNotes}
              onChange={setTriageNotes}
              onSendSlack={() => sendToSlack('triage')}
              slackSent={!!slackSent['triage']}
            />

            {/* No Deal Reason (conditional) */}
            {result?.startsWith('LOST') && (
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase">No Deal Reason</label>
                <input
                  type="text"
                  value={noDealReason}
                  onChange={e => setNoDealReason(e.target.value)}
                  placeholder="Reden..."
                  className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700 transition-shadow duration-[120ms]"
                />
              </div>
            )}

            {/* Deal Value (for CLOSED and DEPOSIT) */}
            {(result === 'CLOSED' || result === 'DEPOSIT') && (
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase">Deal Value</label>
                <div className="mt-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">EUR</span>
                  <input
                    type="number"
                    value={dealValue}
                    onChange={e => setDealValue(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="0"
                    className="w-full text-sm border border-gray-200 rounded-lg pl-12 pr-3 py-2 bg-white tabular-nums focus:outline-none focus:ring-2 focus:ring-accent-700 transition-shadow duration-[120ms]"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Closing Panel: First Payment + Contract ── */}
        {showClosingPanel && (
          <div className="px-6 py-5 border-b border-gray-100">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4 pb-2 border-b border-gray-50">
              <CreditCard className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5" {...iconProps} />
              First Payment Link
            </h3>

            {!payLink ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {/* Bedrag */}
                  <div>
                    <label className="text-[11px] font-semibold text-gray-400 uppercase">Bedrag</label>
                    <div className="mt-1 relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">EUR</span>
                      <input
                        type="number"
                        value={payAmount}
                        onChange={e => setPayAmount(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="0"
                        className="w-full text-sm border border-gray-200 rounded-lg pl-12 pr-3 py-2 bg-white tabular-nums focus:outline-none focus:ring-2 focus:ring-accent-700 transition-shadow duration-[120ms]"
                      />
                    </div>
                  </div>

                  {/* Provider */}
                  <div>
                    <label className="text-[11px] font-semibold text-gray-400 uppercase">Provider</label>
                    <select
                      value={payProvider}
                      onChange={e => setPayProvider(e.target.value as PayProvider)}
                      className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700 transition-shadow duration-[120ms]"
                    >
                      <option value="MANUAL">Handmatig (screenshot)</option>
                      <option value="STRIPE">Stripe</option>
                      <option value="WHOP">Whop</option>
                    </select>
                  </div>
                </div>

                {/* Deposit toggle */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDeposit}
                    onChange={e => setIsDeposit(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-accent-700 focus:ring-accent-700"
                  />
                  <span className="text-sm text-gray-600">Alleen deposit (geen contract)</span>
                </label>

                <Button
                  onClick={createPaymentLink}
                  disabled={payLinkCreating || !payAmount || payAmount <= 0}
                  className="w-full"
                >
                  {payLinkCreating ? 'Aanmaken...' : (
                    <><Plus className="w-4 h-4" {...iconProps} /> First payment link aanmaken</>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Check className="w-4 h-4 text-emerald-600" {...iconProps} />
                    <span className="text-sm font-medium text-emerald-800">
                      Payment link aangemaakt
                    </span>
                  </div>
                  <div className="text-xs text-emerald-600 space-y-0.5">
                    <div>Provider: {payLink.provider}</div>
                    <div>Status: {payLink.status}</div>
                    {payLink.is_deposit && <div>Type: Deposit (geen contract)</div>}
                    {payLink.url && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="truncate">{payLink.url}</span>
                        <button
                          onClick={() => copyToClipboard(payLink.url!, 'paylink')}
                          className={`p-1 rounded transition duration-[120ms] ${copied === 'paylink' ? 'bg-emerald-600 text-white' : 'bg-emerald-200 text-emerald-700 hover:bg-emerald-300'}`}
                        >
                          {copied === 'paylink' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Maak contract knop (alleen bij CLOSED, niet bij DEPOSIT) */}
                {canCreateContract && (
                  <Button
                    onClick={() => setShowContractModal(true)}
                    variant="secondary"
                    className="w-full mt-2"
                  >
                    <FileText className="w-4 h-4" {...iconProps} />
                    Maak contract
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Qualification Questions ── */}
        {call.questions && (Array.isArray(call.questions) ? call.questions.length > 0 : Object.keys(call.questions).length > 0) && (
          <div className="px-6 py-5 border-b border-gray-100">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4 pb-2 border-b border-gray-50">Qualification Questions</h3>
            <div className="space-y-2">
              {(Array.isArray(call.questions)
                ? call.questions.map((qa: { question: string; answer: string }, i: number) => (
                    <div key={i} className="bg-gray-50 rounded-md px-3 py-2.5 border-l-2 border-l-gray-300">
                      <div className="text-[11px] text-gray-500 mb-0.5">{qa.question}</div>
                      <div className="text-sm text-gray-900">{qa.answer}</div>
                    </div>
                  ))
                : Object.entries(call.questions).map(([question, answer]) => (
                    <div key={question} className="bg-gray-50 rounded-md px-3 py-2.5 border-l-2 border-l-gray-300">
                      <div className="text-[11px] text-gray-500 mb-0.5">{question}</div>
                      <div className="text-sm text-gray-900">{String(answer)}</div>
                    </div>
                  ))
              )}
            </div>
          </div>
        )}

        {/* ── Footer: Save ── */}
        <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-gray-100 px-6 py-4 flex gap-3">
          <button
            onClick={saveAll}
            disabled={saving}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 shadow-sm transition duration-[120ms]"
          >
            {saving ? 'Opslaan...' : saved ? <><Check className="w-4 h-4" {...iconProps} /> Opgeslagen</> : <><Save className="w-4 h-4" {...iconProps} /> Opslaan</>}
          </button>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition duration-[120ms]"
          >
            Sluiten
          </button>
        </div>
      </div>

      {/* ── Contract Modal ── */}
      {showContractModal && payLink && (
        <ContractModal
          call={call}
          accountId={payLink.account_id}
          firstPaymentId={payLink.incoming_payment_id}
          firstPaymentAmount={Number(payAmount) || 0}
          dealValue={Number(dealValue) || 0}
          onClose={() => setShowContractModal(false)}
          onCreated={() => {
            setShowContractModal(false)
            onUpdate()
          }}
        />
      )}
    </div>
  )
}

/* ── Contract Modal ── */

interface PackageOption {
  id: string
  name: string
  price: number
}

function ContractModal({ call, accountId, firstPaymentId, firstPaymentAmount, dealValue: initialDealValue, onClose, onCreated }: {
  call: Call
  accountId: string
  firstPaymentId: string
  firstPaymentAmount: number
  dealValue: number
  onClose: () => void
  onCreated: () => void
}) {
  const [signerName, setSignerName] = useState(call.name || '')
  const [signerEmail, setSignerEmail] = useState(call.email || '')
  const [signerMobile, setSignerMobile] = useState(call.phone || '')
  const [numInstallments, setNumInstallments] = useState(3)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  // Pakketten
  const [packages, setPackages] = useState<PackageOption[]>([])
  const [selectedPackageId, setSelectedPackageId] = useState<string>('')
  const [dealValue, setDealValue] = useState(initialDealValue)

  const loadPackages = useCallback(async () => {
    const res = await fetch('/api/packages').then(r => r.json()).catch(() => [])
    const active = (Array.isArray(res) ? res : []).filter((p: PackageOption & { active?: boolean }) => p.active !== false)
    setPackages(active)
  }, [])

  useEffect(() => { loadPackages() }, [loadPackages])

  const handlePackageChange = (pkgId: string) => {
    setSelectedPackageId(pkgId)
    if (pkgId) {
      const pkg = packages.find(p => p.id === pkgId)
      if (pkg) setDealValue(Number(pkg.price))
    }
  }

  const remaining = dealValue - firstPaymentAmount
  const perInstallment = numInstallments > 0 ? Math.round((remaining / numInstallments) * 100) / 100 : 0

  // Generate initial schedule
  const initialSchedule = useMemo(() => {
    const rows: ScheduleRow[] = []
    const today = new Date()
    for (let i = 0; i < numInstallments; i++) {
      const date = new Date(today)
      date.setMonth(date.getMonth() + i + 1)
      rows.push({
        amount: i === numInstallments - 1
          ? Math.round((remaining - perInstallment * (numInstallments - 1)) * 100) / 100
          : perInstallment,
        due_date: date.toISOString().split('T')[0],
      })
    }
    return rows
  }, [numInstallments, remaining, perInstallment])

  const [schedule, setSchedule] = useState<ScheduleRow[]>(initialSchedule)

  // Re-generate schedule when numInstallments changes
  useEffect(() => {
    setSchedule(initialSchedule)
  }, [initialSchedule])

  const updateScheduleRow = (index: number, field: keyof ScheduleRow, value: string | number) => {
    setSchedule(prev => prev.map((row, i) =>
      i === index ? { ...row, [field]: value } : row
    ))
  }

  const totalScheduled = schedule.reduce((sum, r) => sum + Number(r.amount), 0) + firstPaymentAmount

  const handleCreate = async () => {
    if (!signerName || !signerEmail) {
      setError('Naam en e-mail zijn verplicht')
      return
    }
    setCreating(true)
    setError('')
    try {
      const res = await fetch('/api/finance-contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call_id: call.id,
          account_id: accountId,
          deal_value: dealValue,
          first_payment_id: firstPaymentId,
          number_of_installments: numInstallments,
          schedule,
          signer_name: signerName,
          signer_email: signerEmail,
          signer_mobile: signerMobile || undefined,
          package_id: selectedPackageId || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Contract aanmaken mislukt')
        return
      }
      onCreated()
    } catch {
      setError('Netwerkfout bij aanmaken contract')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">
            <FileText className="w-4 h-4 inline-block mr-1.5 -mt-0.5" {...iconProps} />
            Contract aanmaken
          </h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition duration-[120ms]">
            <X className="w-4 h-4 text-gray-400" {...iconProps} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Signer info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-gray-400 uppercase">Naam</label>
              <input
                type="text"
                value={signerName}
                onChange={e => setSignerName(e.target.value)}
                className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700 transition-shadow duration-[120ms]"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-400 uppercase">E-mail</label>
              <input
                type="email"
                value={signerEmail}
                onChange={e => setSignerEmail(e.target.value)}
                className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700 transition-shadow duration-[120ms]"
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-400 uppercase">Telefoon (optioneel)</label>
            <input
              type="text"
              value={signerMobile}
              onChange={e => setSignerMobile(e.target.value)}
              className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700 transition-shadow duration-[120ms]"
            />
          </div>

          {/* Pakket selectie */}
          {packages.length > 0 && (
            <div>
              <label className="text-[11px] font-semibold text-gray-400 uppercase">Pakket</label>
              <select
                value={selectedPackageId}
                onChange={e => handlePackageChange(e.target.value)}
                className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700 transition-shadow duration-[120ms]"
              >
                <option value="">— Geen pakket —</option>
                {packages.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} — EUR {Number(p.price).toFixed(2)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Deal value (editable) */}
          <div>
            <label className="text-[11px] font-semibold text-gray-400 uppercase">Deal value</label>
            <div className="mt-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">EUR</span>
              <input
                type="number"
                value={dealValue}
                onChange={e => setDealValue(e.target.value === '' ? 0 : Number(e.target.value))}
                className="w-full text-sm border border-gray-200 rounded-lg pl-12 pr-3 py-2 bg-white tabular-nums focus:outline-none focus:ring-2 focus:ring-accent-700 transition-shadow duration-[120ms]"
              />
            </div>
          </div>

          {/* Summary */}
          <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">Deal value</span>
              <span className="font-medium tabular-nums">EUR {dealValue.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">First payment</span>
              <span className="font-medium tabular-nums">EUR {firstPaymentAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-1 mt-1">
              <span className="text-gray-500">Resterend</span>
              <span className="font-semibold tabular-nums">EUR {remaining.toFixed(2)}</span>
            </div>
          </div>

          {/* Aantal termijnen */}
          <div>
            <label className="text-[11px] font-semibold text-gray-400 uppercase">Aantal termijnen</label>
            <input
              type="number"
              min={1}
              max={24}
              value={numInstallments}
              onChange={e => setNumInstallments(Math.max(1, Number(e.target.value)))}
              className="mt-1 w-24 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white tabular-nums focus:outline-none focus:ring-2 focus:ring-accent-700 transition-shadow duration-[120ms]"
            />
          </div>

          {/* Schedule table */}
          <div>
            <label className="text-[11px] font-semibold text-gray-400 uppercase mb-2 block">Betalingsschema</label>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-[11px] text-gray-400 uppercase">
                    <th className="px-3 py-2 text-left font-semibold">#</th>
                    <th className="px-3 py-2 text-left font-semibold">Bedrag</th>
                    <th className="px-3 py-2 text-left font-semibold">Datum</th>
                  </tr>
                </thead>
                <tbody>
                  {/* First payment row (read-only) */}
                  <tr className="border-t border-gray-100 bg-emerald-50/50">
                    <td className="px-3 py-2 text-gray-400">1</td>
                    <td className="px-3 py-2 tabular-nums text-gray-600">EUR {firstPaymentAmount.toFixed(2)}</td>
                    <td className="px-3 py-2 text-gray-400 text-xs">First payment</td>
                  </tr>
                  {schedule.map((row, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="px-3 py-2 text-gray-400">{i + 2}</td>
                      <td className="px-3 py-1.5">
                        <input
                          type="number"
                          value={row.amount}
                          onChange={e => updateScheduleRow(i, 'amount', Number(e.target.value))}
                          className="w-24 text-sm border border-gray-200 rounded px-2 py-1 tabular-nums focus:outline-none focus:ring-1 focus:ring-accent-700"
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          type="date"
                          value={row.due_date}
                          onChange={e => updateScheduleRow(i, 'due_date', e.target.value)}
                          className="text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent-700"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200 bg-gray-50">
                    <td className="px-3 py-2 font-semibold text-gray-500">Totaal</td>
                    <td className="px-3 py-2 font-semibold tabular-nums" colSpan={2}>
                      <span className={totalScheduled !== dealValue ? 'text-red-600' : 'text-gray-900'}>
                        EUR {totalScheduled.toFixed(2)}
                      </span>
                      {totalScheduled !== dealValue && (
                        <span className="text-xs text-red-500 ml-2">
                          (verschil: EUR {(totalScheduled - dealValue).toFixed(2)})
                        </span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
              {error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <Button
            onClick={handleCreate}
            disabled={creating}
            className="flex-1"
          >
            {creating ? 'Aanmaken...' : 'Contract aanmaken + versturen'}
          </Button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition duration-[120ms]"
          >
            Annuleren
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Helper Components ── */

function InfoRow({ icon: Icon, label, value }: {
  icon: typeof User
  label: string
  value: string | null | undefined
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-7 h-7 rounded-md bg-gray-50 flex items-center justify-center shrink-0">
        <Icon className="w-3.5 h-3.5 text-gray-400" {...iconProps} />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] text-gray-400">{label}</div>
        <div className="text-sm text-gray-900 truncate">{value || '—'}</div>
      </div>
    </div>
  )
}

function NoteField({ label, value, onChange, onSendSlack, slackSent }: {
  label: string
  value: string
  onChange: (v: string) => void
  onSendSlack: () => void
  slackSent: boolean
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-semibold text-gray-400 uppercase">{label}</label>
        <button
          onClick={onSendSlack}
          disabled={slackSent || !value.trim()}
          className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md transition duration-[120ms] ${
            slackSent
              ? 'bg-emerald-50 text-emerald-600'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-30'
          }`}
        >
          {slackSent ? (
            <><Check className="w-3 h-3" {...iconProps} /> Verstuurd</>
          ) : (
            <><Send className="w-3 h-3" {...iconProps} /> Send to Slack</>
          )}
        </button>
      </div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={2}
        placeholder={`${label}...`}
        className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-accent-700 transition-shadow duration-[120ms]"
      />
    </div>
  )
}
