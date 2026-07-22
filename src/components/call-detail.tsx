'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/format'
import type { Call, CallResult } from '@/lib/queries/sales'
import {
  X, Save, Check, Copy,
  Phone, Mail, AtSign,
  Calendar, User, UserCheck, Globe, Video,
  Send, CreditCard, FileText, Plus, ClipboardList, MessageSquare,
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

interface PackageOption {
  id: string
  name: string
  price: number
}

interface ContextData {
  lead: { id: string; quiz_answers: { question: string; answer: string }[] | null; triage_notes: string | null } | null
  account: { id: string; status: string; ltv: number } | null
  payments: { id: string; installment_number: number; amount: number; due_date: string | null; status: string; pay_token: string }[]
  contract: { id: string; esign_status: string | null; contract_signed: boolean | null; contract_pdf_url: string | null; deal_value: number | null; payment_plan: string | null } | null
}

interface CallDetailProps {
  call: Call
  onClose: () => void
  onUpdate: () => void
}

export function CallDetail({ call, onClose, onUpdate }: CallDetailProps) {
  // ── Editable state ──
  const [result, setResult] = useState<CallResult | ''>(call.result || '')
  const [fathomLink, setFathomLink] = useState(call.fathom_link || '')
  const [preCallNotes, setPreCallNotes] = useState(call.pre_call_notes || '')
  const [closingNotes, setClosingNotes] = useState(call.closing_notes || '')
  const [noDealReason, setNoDealReason] = useState(call.no_deal_reason || '')
  const [dealValue, setDealValue] = useState<number | ''>(call.deal_value ?? '')
  const [cashCollected, setCashCollected] = useState<number | ''>(call.cash_collected ?? '')

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState('')
  const [slackSent, setSlackSent] = useState<Record<string, boolean>>({})

  // ── Context (enriched data from API) ──
  const [context, setContext] = useState<ContextData | null>(null)
  const [contextLoading, setContextLoading] = useState(true)

  // ── First Payment Link state ──
  const [payAmount, setPayAmount] = useState<number | ''>(call.first_deposit ?? '')
  const [payProvider, setPayProvider] = useState<PayProvider>('MANUAL')
  const [isDeposit, setIsDeposit] = useState(false)
  const [payLinkCreating, setPayLinkCreating] = useState(false)
  const [payLink, setPayLink] = useState<PaymentLinkState | null>(null)

  // ── Contract inline state (absorbed from ContractModal) ──
  const [showContractForm, setShowContractForm] = useState(false)
  const [signerName, setSignerName] = useState(call.name || '')
  const [signerEmail, setSignerEmail] = useState(call.email || '')
  const [signerMobile, setSignerMobile] = useState(call.phone || '')
  const [numInstallments, setNumInstallments] = useState(3)
  const [contractCreating, setContractCreating] = useState(false)
  const [contractError, setContractError] = useState('')
  const [packages, setPackages] = useState<PackageOption[]>([])
  const [selectedPackageId, setSelectedPackageId] = useState('')
  const [contractDealValue, setContractDealValue] = useState(Number(call.deal_value) || 0)

  // ── Effects ──

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Fetch context
  useEffect(() => {
    fetch(`/api/calls/${call.id}/context`)
      .then(r => r.json())
      .then(setContext)
      .catch(() => setContext(null))
      .finally(() => setContextLoading(false))
  }, [call.id])

  // Load packages when contract form opens
  const loadPackages = useCallback(async () => {
    const res = await fetch('/api/packages').then(r => r.json()).catch(() => [])
    const active = (Array.isArray(res) ? res : []).filter((p: PackageOption & { active?: boolean }) => p.active !== false)
    setPackages(active)
  }, [])

  useEffect(() => {
    if (showContractForm) loadPackages()
  }, [showContractForm, loadPackages])

  // Sync contractDealValue when dealValue changes
  useEffect(() => {
    if (dealValue !== '') setContractDealValue(Number(dealValue))
  }, [dealValue])

  // ── Derived values ──

  const showClosingPanel = result === 'CLOSED' || result === 'DEPOSIT'
  const canCreateContract = result === 'CLOSED' && payLink !== null

  const firstPaymentAmount = Number(payAmount) || 0
  const remaining = contractDealValue - firstPaymentAmount
  const perInstallment = numInstallments > 0 ? Math.round((remaining / numInstallments) * 100) / 100 : 0

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
  useEffect(() => { setSchedule(initialSchedule) }, [initialSchedule])

  const totalScheduled = schedule.reduce((sum, r) => sum + Number(r.amount), 0) + firstPaymentAmount

  // Payment status from context
  const paidCount = context?.payments.filter(p => p.status === 'PAID').length ?? 0
  const totalPayments = context?.payments.length ?? 0
  const contractStatus = context?.contract
    ? context.contract.contract_signed ? 'Getekend' : context.contract.esign_status === 'SENT' ? 'Verstuurd' : 'Pending'
    : null

  // ── Actions ──

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
          pre_call_notes: preCallNotes || null,
          closing_notes: closingNotes || null,
          no_deal_reason: noDealReason || null,
          deal_value: dealValue === '' ? null : dealValue,
          cash_collected: cashCollected === '' ? null : cashCollected,
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

  const handlePackageChange = (pkgId: string) => {
    setSelectedPackageId(pkgId)
    if (pkgId) {
      const pkg = packages.find(p => p.id === pkgId)
      if (pkg) setContractDealValue(Number(pkg.price))
    }
  }

  const updateScheduleRow = (index: number, field: keyof ScheduleRow, value: string | number) => {
    setSchedule(prev => prev.map((row, i) =>
      i === index ? { ...row, [field]: value } : row
    ))
  }

  const handleCreateContract = async () => {
    if (!signerName || !signerEmail) {
      setContractError('Naam en e-mail zijn verplicht')
      return
    }
    if (!payLink) return
    setContractCreating(true)
    setContractError('')
    try {
      const res = await fetch('/api/finance-contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call_id: call.id,
          account_id: payLink.account_id,
          deal_value: contractDealValue,
          first_payment_id: payLink.incoming_payment_id,
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
        setContractError(data.error || 'Contract aanmaken mislukt')
        return
      }
      setShowContractForm(false)
      onUpdate()
      // Refresh context to show new contract status
      fetch(`/api/calls/${call.id}/context`).then(r => r.json()).then(setContext).catch(() => {})
    } catch {
      setContractError('Netwerkfout bij aanmaken contract')
    } finally {
      setContractCreating(false)
    }
  }

  const formatTime = (dateStr: string | null): string => {
    if (!dateStr) return '—'
    try {
      return new Date(dateStr).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
    } catch {
      return '—'
    }
  }

  // ── Render helpers ──

  const hasQuestions = call.questions && (Array.isArray(call.questions) ? call.questions.length > 0 : Object.keys(call.questions).length > 0)
  const hasQuizAnswers = context?.lead?.quiz_answers && context.lead.quiz_answers.length > 0
  const triageNotesCombined = [call.triage_notes, context?.lead?.triage_notes].filter(Boolean).join('\n\n')

  const inputClass = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700 transition-shadow duration-[120ms]'
  const labelClass = 'text-[11px] font-semibold text-gray-400 uppercase'

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={onClose} />

      {/* Panel */}
      <div className="absolute right-0 top-0 h-full w-full max-w-4xl bg-white shadow-lg border-l border-gray-200 flex flex-col">

        {/* ── Header + Statusregel ── */}
        <div className="shrink-0 border-b border-gray-100 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center text-white text-sm font-semibold shrink-0">
                {(call.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-gray-900 truncate">{call.name || 'Onbekend'}</h2>
                  {call.result && <Badge status={call.result} size="sm" />}
                  {call.source && (
                    <span className="inline-flex text-[10px] font-medium bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">
                      {call.source}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                  {call.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{call.email}</span>}
                  {call.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{call.phone}</span>}
                  {call.instagram && <span className="flex items-center gap-1"><AtSign className="w-3 h-3" />@{call.instagram}</span>}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition duration-[120ms]">
              <X className="w-5 h-5 text-gray-400" {...iconProps} />
            </button>
          </div>

          {/* Status chips */}
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-50">
            <StatusChip label="Deal value" value={dealValue !== '' ? `EUR ${Number(dealValue).toLocaleString('nl-NL')}` : '—'} />
            <StatusChip label="Ontvangen" value={cashCollected !== '' ? `EUR ${Number(cashCollected).toLocaleString('nl-NL')}` : '—'} />
            <StatusChip
              label="Termijnen"
              value={totalPayments > 0 ? `${paidCount}/${totalPayments} betaald` : '—'}
            />
            <StatusChip
              label="Contract"
              value={contractStatus || '—'}
              accent={contractStatus === 'Getekend' ? 'emerald' : undefined}
            />
          </div>
        </div>

        {/* ── Two-column body ── */}
        <div className="flex-1 grid grid-cols-[1fr_1.2fr] min-h-0">

          {/* ── LEFT COLUMN: Voorbereiding (read-only) ── */}
          <div className="overflow-y-auto border-r border-gray-100">

            {/* Calendly-vragen */}
            {hasQuestions && (
              <div className="px-5 py-4 border-b border-gray-50">
                <SectionLabel icon={ClipboardList}>Calendly-vragen</SectionLabel>
                <div className="space-y-1.5 mt-3">
                  {Array.isArray(call.questions)
                    ? (call.questions as { question: string; answer: string }[]).map((qa, i) => (
                        <QARow key={i} question={qa.question} answer={qa.answer} />
                      ))
                    : Object.entries(call.questions!).map(([q, a]) => (
                        <QARow key={q} question={q} answer={String(a)} />
                      ))
                  }
                </div>
              </div>
            )}

            {/* Quiz-antwoorden */}
            {hasQuizAnswers && (
              <div className="px-5 py-4 border-b border-gray-50">
                <SectionLabel icon={ClipboardList}>Quiz-antwoorden</SectionLabel>
                <div className="space-y-1.5 mt-3">
                  {context!.lead!.quiz_answers!.map((qa, i) => (
                    <QARow key={i} question={qa.question} answer={qa.answer} />
                  ))}
                </div>
              </div>
            )}

            {/* Setter-notities */}
            {call.setter_notes && (
              <div className="px-5 py-4 border-b border-gray-50">
                <SectionLabel icon={MessageSquare}>Setter-notities</SectionLabel>
                <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{call.setter_notes}</p>
              </div>
            )}

            {/* Triage-notities */}
            {triageNotesCombined && (
              <div className="px-5 py-4 border-b border-gray-50">
                <SectionLabel icon={MessageSquare}>Triage-notities</SectionLabel>
                <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{triageNotesCombined}</p>
              </div>
            )}

            {/* Planning */}
            <div className="px-5 py-4 border-b border-gray-50">
              <SectionLabel icon={Calendar}>Planning</SectionLabel>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <InfoRow icon={Calendar} label="Datum" value={call.date_start_time ? `${formatDate(call.date_start_time)} · ${formatTime(call.date_start_time)}` : null} />
                <InfoRow icon={UserCheck} label="Closer" value={call.closer?.name} />
                <InfoRow icon={User} label="Setter" value={call.setter?.name} />
                <InfoRow icon={Globe} label="Source" value={call.source} />
                {call.source_type && <InfoRow icon={Globe} label="Campaign" value={call.source_type} />}
                <InfoRow icon={Video} label="Event type" value={call.event_type} />
                {call.week && <InfoRow icon={Calendar} label="Week" value={`W${call.week}`} />}
              </div>
            </div>

            {/* Meeting Links */}
            {(call.meeting_link || call.reschedule_link || call.cancel_link) && (
              <div className="px-5 py-4">
                <div className="flex flex-wrap gap-2">
                  {call.meeting_link && (
                    <a href={call.meeting_link} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-accent-700 text-white rounded-lg hover:bg-accent-800 transition-colors duration-[120ms]">
                      <Video className="w-3.5 h-3.5" {...iconProps} /> Meeting
                    </a>
                  )}
                  {call.reschedule_link && (
                    <a href={call.reschedule_link} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-[120ms]">
                      <Calendar className="w-3.5 h-3.5" {...iconProps} /> Reschedule
                    </a>
                  )}
                  {call.cancel_link && (
                    <a href={call.cancel_link} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-gray-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors duration-[120ms]">
                      <X className="w-3.5 h-3.5" {...iconProps} /> Cancel
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Loading state for context */}
            {contextLoading && (
              <div className="px-5 py-4 text-xs text-gray-400">Context laden...</div>
            )}
          </div>

          {/* ── RIGHT COLUMN: Closer bewerkt + Closen & Innen ── */}
          <div className="overflow-y-auto">

            {/* Closer bewerkt */}
            <div className="px-5 py-4 space-y-4">

              {/* Result */}
              <div>
                <label className={labelClass}>Result</label>
                <select
                  value={result}
                  onChange={e => setResult(e.target.value as CallResult)}
                  className={`mt-1 ${inputClass}`}
                >
                  <option value="">— Selecteer —</option>
                  {RESULT_OPTIONS.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* Pre Call Notes */}
              <NoteField
                label="Pre-call Notes"
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

              {/* Fathom Link */}
              <div>
                <label className={labelClass}>Fathom Link</label>
                <input
                  type="text"
                  value={fathomLink}
                  onChange={e => setFathomLink(e.target.value)}
                  placeholder="Plak Fathom link hier..."
                  className={`mt-1 ${inputClass}`}
                />
              </div>

              {/* Deal Value + Cash Collected */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Deal Value</label>
                  <div className="mt-1 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">EUR</span>
                    <input
                      type="number"
                      value={dealValue}
                      onChange={e => setDealValue(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="0"
                      className={`pl-12 tabular-nums ${inputClass}`}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Cash Collected</label>
                  <div className="mt-1 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">EUR</span>
                    <input
                      type="number"
                      value={cashCollected}
                      onChange={e => setCashCollected(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="0"
                      className={`pl-12 tabular-nums ${inputClass}`}
                    />
                  </div>
                </div>
              </div>

              {/* No Deal Reason (conditional) */}
              {result?.startsWith('LOST') && (
                <div>
                  <label className={labelClass}>No Deal Reason</label>
                  <input
                    type="text"
                    value={noDealReason}
                    onChange={e => setNoDealReason(e.target.value)}
                    placeholder="Reden..."
                    className={`mt-1 ${inputClass}`}
                  />
                </div>
              )}
            </div>

            {/* ── Closen & Innen ── */}
            {showClosingPanel && (
              <div className="px-5 py-4 border-t border-gray-100 space-y-4">
                <SectionLabel icon={CreditCard}>Closen & Innen</SectionLabel>

                {/* First Payment */}
                {!payLink ? (
                  <div className="space-y-3 mt-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>Bedrag</label>
                        <div className="mt-1 relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">EUR</span>
                          <input
                            type="number"
                            value={payAmount}
                            onChange={e => setPayAmount(e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder="0"
                            className={`pl-12 tabular-nums ${inputClass}`}
                          />
                        </div>
                      </div>
                      <div>
                        <label className={labelClass}>Provider</label>
                        <select
                          value={payProvider}
                          onChange={e => setPayProvider(e.target.value as PayProvider)}
                          className={`mt-1 ${inputClass}`}
                        >
                          <option value="MANUAL">Handmatig</option>
                          <option value="STRIPE">Stripe</option>
                          <option value="WHOP">Whop</option>
                        </select>
                      </div>
                    </div>

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
                  <div className="space-y-3 mt-3">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Check className="w-4 h-4 text-emerald-600" {...iconProps} />
                        <span className="text-sm font-medium text-emerald-800">Payment link aangemaakt</span>
                      </div>
                      <div className="text-xs text-emerald-600 space-y-0.5">
                        <div>Provider: {payLink.provider} · Status: {payLink.status}</div>
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

                    {/* Contract section */}
                    {canCreateContract && !context?.contract && (
                      <>
                        {!showContractForm ? (
                          <Button
                            onClick={() => setShowContractForm(true)}
                            variant="secondary"
                            className="w-full"
                          >
                            <FileText className="w-4 h-4" {...iconProps} /> Contract aanmaken
                          </Button>
                        ) : (
                          <div className="border border-gray-200 rounded-lg p-4 space-y-4">
                            <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                              <FileText className="w-4 h-4" {...iconProps} /> Contract aanmaken
                            </h4>

                            {/* Signer info */}
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className={labelClass}>Naam</label>
                                <input type="text" value={signerName} onChange={e => setSignerName(e.target.value)} className={`mt-1 ${inputClass}`} />
                              </div>
                              <div>
                                <label className={labelClass}>E-mail</label>
                                <input type="email" value={signerEmail} onChange={e => setSignerEmail(e.target.value)} className={`mt-1 ${inputClass}`} />
                              </div>
                            </div>
                            <div>
                              <label className={labelClass}>Telefoon (optioneel)</label>
                              <input type="text" value={signerMobile} onChange={e => setSignerMobile(e.target.value)} className={`mt-1 ${inputClass}`} />
                            </div>

                            {/* Pakket */}
                            {packages.length > 0 && (
                              <div>
                                <label className={labelClass}>Pakket</label>
                                <select value={selectedPackageId} onChange={e => handlePackageChange(e.target.value)} className={`mt-1 ${inputClass}`}>
                                  <option value="">— Geen pakket —</option>
                                  {packages.map(p => (
                                    <option key={p.id} value={p.id}>{p.name} — EUR {Number(p.price).toFixed(2)}</option>
                                  ))}
                                </select>
                              </div>
                            )}

                            {/* Deal value for contract */}
                            <div>
                              <label className={labelClass}>Deal value</label>
                              <div className="mt-1 relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">EUR</span>
                                <input
                                  type="number"
                                  value={contractDealValue}
                                  onChange={e => setContractDealValue(e.target.value === '' ? 0 : Number(e.target.value))}
                                  className={`pl-12 tabular-nums ${inputClass}`}
                                />
                              </div>
                            </div>

                            {/* Summary */}
                            <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm space-y-1">
                              <div className="flex justify-between">
                                <span className="text-gray-500">Deal value</span>
                                <span className="font-medium tabular-nums">EUR {contractDealValue.toFixed(2)}</span>
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

                            {/* Termijnen */}
                            <div>
                              <label className={labelClass}>Aantal termijnen</label>
                              <input
                                type="number"
                                min={1}
                                max={24}
                                value={numInstallments}
                                onChange={e => setNumInstallments(Math.max(1, Number(e.target.value)))}
                                className={`mt-1 w-24 tabular-nums ${inputClass}`}
                              />
                            </div>

                            {/* Schedule table */}
                            <div>
                              <label className={`${labelClass} mb-2 block`}>Betalingsschema</label>
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
                                        <span className={totalScheduled !== contractDealValue ? 'text-red-600' : 'text-gray-900'}>
                                          EUR {totalScheduled.toFixed(2)}
                                        </span>
                                        {totalScheduled !== contractDealValue && (
                                          <span className="text-xs text-red-500 ml-2">
                                            (verschil: EUR {(totalScheduled - contractDealValue).toFixed(2)})
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            </div>

                            {contractError && (
                              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                                {contractError}
                              </div>
                            )}

                            <div className="flex gap-3">
                              <Button onClick={handleCreateContract} disabled={contractCreating} className="flex-1">
                                {contractCreating ? 'Aanmaken...' : 'Contract aanmaken + versturen'}
                              </Button>
                              <button
                                onClick={() => setShowContractForm(false)}
                                className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition duration-[120ms]"
                              >
                                Annuleren
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* Existing contract status */}
                    {context?.contract && (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                        <div className="flex items-center gap-2 mb-1">
                          <FileText className="w-4 h-4 text-gray-500" {...iconProps} />
                          <span className="text-sm font-medium text-gray-800">Contract</span>
                          <Badge status={context.contract.contract_signed ? 'DONE' : context.contract.esign_status === 'SENT' ? 'IN PROGRESS' : 'SCHEDULED'} size="sm" />
                        </div>
                        <div className="text-xs text-gray-500 space-y-0.5">
                          {context.contract.payment_plan && <div>Plan: {context.contract.payment_plan}</div>}
                          <div>Status: {context.contract.contract_signed ? 'Getekend' : context.contract.esign_status || 'Pending'}</div>
                          {context.contract.contract_pdf_url && (
                            <a href={context.contract.contract_pdf_url} target="_blank" rel="noopener noreferrer" className="text-accent-700 hover:underline">
                              Download PDF
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Existing payments status */}
                    {context && context.payments.length > 0 && (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                        <div className="text-sm font-medium text-gray-800 mb-2">Betalingen ({paidCount}/{totalPayments})</div>
                        <div className="space-y-1">
                          {context.payments.map(p => (
                            <div key={p.id} className="flex items-center justify-between text-xs">
                              <span className="text-gray-500">#{p.installment_number} · EUR {Number(p.amount).toFixed(2)}</span>
                              <Badge status={p.status} size="sm" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="shrink-0 border-t border-gray-100 px-6 py-4 flex gap-3">
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
    </div>
  )
}

/* ── Helper Components ── */

function StatusChip({ label, value, accent }: { label: string; value: string; accent?: 'emerald' }) {
  const bg = accent === 'emerald' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-50 text-gray-700'
  return (
    <div className={`flex-1 rounded-lg px-3 py-2 ${bg}`}>
      <div className="text-[10px] font-medium text-gray-400 uppercase">{label}</div>
      <div className="text-sm font-semibold tabular-nums truncate">{value}</div>
    </div>
  )
}

function SectionLabel({ icon: Icon, children }: { icon: typeof Calendar; children: string }) {
  return (
    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
      <Icon className="w-3.5 h-3.5" {...iconProps} />
      {children}
    </h3>
  )
}

function QARow({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="bg-gray-50 rounded-md px-3 py-2 border-l-2 border-l-gray-300">
      <div className="text-[11px] text-gray-500 mb-0.5">{question}</div>
      <div className="text-sm text-gray-900">{answer}</div>
    </div>
  )
}

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
            <><Send className="w-3 h-3" {...iconProps} /> Slack</>
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
