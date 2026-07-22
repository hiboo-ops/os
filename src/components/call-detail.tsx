'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/format'
import type { Call, CallResult } from '@/lib/queries/sales'
import {
  X, Save, Check, Copy, Link2, Send, FileText, ExternalLink,
} from 'lucide-react'

const iconProps = { strokeWidth: 1.75 } as const

const RESULT_OPTIONS: CallResult[] = [
  'CALL BOOKED', 'RESCHEDULE', 'FOLLOW UP', 'FOLLOW UP LONG TERM',
  'DEPOSIT', 'CLOSED', 'LOST - BROKE', 'LOST - NO INTEREST',
  'LOST - BAD FIT', 'NO SHOW', 'CANCELLED BY LEAD', 'CANCELLED BY CLOSER',
]

// Payment Plan-opties (zoals Airtable): "total" = totaal aantal betalingen incl. first deposit.
const PAYMENT_PLANS = [
  { label: 'Paid in Full', total: 1 },
  { label: '2 Installments', total: 2 },
  { label: '3 Installments', total: 3 },
  { label: '4 Installments', total: 4 },
  { label: '5 Installments', total: 5 },
  { label: '6 Installments', total: 6 },
]

type PayProvider = 'WHOP' | 'MANUAL'

interface ScheduleRow { amount: number; due_date: string }
interface PackageOption { id: string; name: string; price: number }
interface CloserOption { id: string; name: string }

interface PaymentRow {
  id: string
  installment_number: number
  amount: number
  due_date: string | null
  status: string
  pay_token: string
  whop_link: string | null
  stripe_link: string | null
}

interface ContextData {
  lead: { id: string; quiz_answers: { question: string; answer: string }[] | null; triage_notes: string | null; creator_name: string | null } | null
  account: { id: string; status: string; ltv: number } | null
  payments: PaymentRow[]
  contract: {
    id: string
    esign_status: string | null
    contract_signed: boolean | null
    contract_sent: boolean | null
    contract_url: string | null
    contract_pdf_url: string | null
    deal_value: number | null
    payment_plan: string | null
  } | null
}

interface CallDetailProps {
  call: Call
  onClose: () => void
  onUpdate: () => void
}

const eur = (n: number) => `€${Number(n || 0).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const round2 = (n: number) => Math.round(n * 100) / 100

export function CallDetail({ call, onClose, onUpdate }: CallDetailProps) {
  // ── Editable core fields ──
  const [name, setName] = useState(call.name || '')
  const [email, setEmail] = useState(call.email || '')
  const [closerId, setCloserId] = useState(call.closer_id || '')
  const [result, setResult] = useState<CallResult | ''>(call.result || '')
  const [closingNotes, setClosingNotes] = useState(call.closing_notes || '')
  const [noDealReason, setNoDealReason] = useState(call.no_deal_reason || '')
  // Deal value uit contract (fallback call); niet meer editable hier.
  const dealValue: number | '' = call.deal_value ?? ''

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState('')
  const [slackSent, setSlackSent] = useState(false)
  const [closers, setClosers] = useState<CloserOption[]>([])

  // ── Context ──
  const [context, setContext] = useState<ContextData | null>(null)
  const [contextLoading, setContextLoading] = useState(true)

  // ── Payment link (deposit / generate) ──
  const [payAmount, setPayAmount] = useState<number | ''>(call.first_deposit ?? '')
  const [payGenerating, setPayGenerating] = useState(false)
  const [linkEditId, setLinkEditId] = useState<string | null>(null)
  const [linkEditValue, setLinkEditValue] = useState('')
  const [rowBusy, setRowBusy] = useState<string | null>(null)

  // ── Contract modal ──
  const [showContractModal, setShowContractModal] = useState(false)
  const [signerName, setSignerName] = useState(call.name || '')
  const [signerEmail, setSignerEmail] = useState(call.email || '')
  const [signerMobile, setSignerMobile] = useState(call.phone || '')
  const [address, setAddress] = useState('')
  const [postcode, setPostcode] = useState('')
  const [city, setCity] = useState('')
  const [paymentPlan, setPaymentPlan] = useState('3 Installments')
  const [firstDepositAmount, setFirstDepositAmount] = useState<number>(Number(call.first_deposit) || 0)
  const [firstDepositDate, setFirstDepositDate] = useState(new Date().toISOString().split('T')[0])
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
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (showContractModal) setShowContractModal(false); else onClose() } }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, showContractModal])

  const loadContext = useCallback(() => {
    return fetch(`/api/calls/${call.id}/context`)
      .then(r => r.json())
      .then(setContext)
      .catch(() => setContext(null))
  }, [call.id])

  useEffect(() => {
    loadContext().finally(() => setContextLoading(false))
  }, [loadContext])

  useEffect(() => {
    fetch('/api/closers').then(r => r.json()).then(data => {
      setClosers(Array.isArray(data) ? data : [])
    }).catch(() => setClosers([]))
  }, [])

  const loadPackages = useCallback(async () => {
    const res = await fetch('/api/packages').then(r => r.json()).catch(() => [])
    const active = (Array.isArray(res) ? res : []).filter((p: PackageOption & { active?: boolean }) => p.active !== false)
    setPackages(active)
  }, [])

  useEffect(() => { if (showContractModal) loadPackages() }, [showContractModal, loadPackages])

  useEffect(() => { if (dealValue !== '') setContractDealValue(Number(dealValue)) }, [dealValue])

  // ── Contract schema (payment plan gestuurd) ──
  const plan = PAYMENT_PLANS.find(p => p.label === paymentPlan) ?? PAYMENT_PLANS[2]
  const totalPayments = plan.total
  const numInstallments = Math.max(0, totalPayments - 1)
  const perPayment = totalPayments > 0 ? round2(contractDealValue / totalPayments) : 0

  // First deposit = gelijk verdeeld deel, opnieuw bij plan/deal-wijziging
  useEffect(() => {
    setFirstDepositAmount(perPayment)
  }, [paymentPlan, contractDealValue]) // eslint-disable-line react-hooks/exhaustive-deps

  const remaining = round2(contractDealValue - firstDepositAmount)
  const perInstallment = numInstallments > 0 ? round2(remaining / numInstallments) : 0

  const initialSchedule = useMemo(() => {
    const rows: ScheduleRow[] = []
    const base = new Date(firstDepositDate)
    for (let i = 0; i < numInstallments; i++) {
      const d = new Date(base)
      d.setMonth(d.getMonth() + i + 1)
      rows.push({
        amount: i === numInstallments - 1
          ? round2(remaining - perInstallment * (numInstallments - 1))
          : perInstallment,
        due_date: d.toISOString().split('T')[0],
      })
    }
    return rows
  }, [numInstallments, remaining, perInstallment, firstDepositDate])

  const [schedule, setSchedule] = useState<ScheduleRow[]>(initialSchedule)
  useEffect(() => { setSchedule(initialSchedule) }, [initialSchedule])

  const totalScheduled = round2(schedule.reduce((s, r) => s + Number(r.amount), 0) + firstDepositAmount)
  const balanced = Math.abs(totalScheduled - contractDealValue) < 0.01

  // ── Derived (payments) ──
  const contextFirstPayment = context?.payments.find(p => p.installment_number === 1) ?? context?.payments[0] ?? null
  const collected = (context?.payments ?? []).filter(p => p.status === 'PAID').reduce((s, p) => s + Number(p.amount), 0)
  // First Deposit-veld vullen met het bedrag van de bestaande eerste betaling (indien nog leeg)
  useEffect(() => {
    if (contextFirstPayment && payAmount === '') setPayAmount(Number(contextFirstPayment.amount))
  }, [contextFirstPayment]) // eslint-disable-line react-hooks/exhaustive-deps
  const dealTotal = Number(context?.contract?.deal_value ?? (dealValue === '' ? 0 : dealValue)) || 0
  const collectedPct = dealTotal > 0 ? Math.round((collected / dealTotal) * 100) : 0
  const recentLink = (() => {
    const withLink = (context?.payments ?? []).filter(p => p.whop_link || p.stripe_link).sort((a, b) => b.installment_number - a.installment_number)
    return withLink[0] ? (withLink[0].whop_link || withLink[0].stripe_link) : null
  })()
  const linkedPayments = (context?.payments ?? []).filter(p => p.whop_link || p.stripe_link)
  const installments = (context?.payments ?? []).filter(p => p.installment_number >= 2).sort((a, b) => a.installment_number - b.installment_number)
  const today = new Date().toISOString().split('T')[0]
  const isLate = (p: PaymentRow) => p.status !== 'PAID' && !!p.due_date && p.due_date < today

  const canCreateContract = (result === 'CLOSED' || result === 'DEPOSIT') && !context?.contract

  const hasQuestions = call.questions && (Array.isArray(call.questions) ? call.questions.length > 0 : Object.keys(call.questions).length > 0)
  const quiz = context?.lead?.quiz_answers
  const hasQuiz = quiz && quiz.length > 0
  const triageNotes = [call.triage_notes, context?.lead?.triage_notes].filter(Boolean).join('\n\n')

  // ── Actions ──
  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
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
          name: name || null,
          email: email || null,
          closer_id: closerId || null,
          result: result || null,
          closing_notes: closingNotes || null,
          no_deal_reason: noDealReason || null,
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

  const sendClosingToSlack = async () => {
    if (!closingNotes.trim()) return
    setSlackSent(true)
    try {
      await fetch(`/api/calls/${call.id}/slack-note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note_type: 'closing', text: closingNotes }),
      })
    } catch (err) { console.error('Slack-push mislukt:', err) }
    setTimeout(() => setSlackSent(false), 3000)
  }

  // Whop-link genereren voor een bestaande termijn
  const generateForPayment = async (ipId: string) => {
    setRowBusy(ipId)
    try {
      const res = await fetch('/api/payment-links', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incoming_payment_id: ipId, generate: true }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        alert(d.error || 'Whop-link genereren mislukt')
      } else {
        await loadContext()
        onUpdate()
      }
    } finally { setRowBusy(null) }
  }

  // Top-level "Generate Whop Link": gebruikt het First Deposit-bedrag.
  // Bestaande eerste betaling → bedrag bijwerken + genereren; anders nieuw aanmaken.
  const generateWhopTopLevel = async () => {
    if (!payAmount || payAmount <= 0) { alert('Vul een First Deposit-bedrag in'); return }
    setPayGenerating(true)
    try {
      const res = contextFirstPayment
        ? await fetch('/api/payment-links', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ incoming_payment_id: contextFirstPayment.id, amount: payAmount, generate: true }),
          })
        : await fetch('/api/payment-links', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ call_id: call.id, amount: payAmount, provider: 'WHOP' }),
          })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        alert(d.error || 'Whop-link genereren mislukt')
      } else {
        await loadContext()
        onUpdate()
      }
    } finally { setPayGenerating(false) }
  }

  const saveManualLink = async (ipId: string) => {
    setRowBusy(ipId)
    try {
      await fetch('/api/payment-links', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incoming_payment_id: ipId, url: linkEditValue }),
      })
      setLinkEditId(null); setLinkEditValue('')
      await loadContext(); onUpdate()
    } finally { setRowBusy(null) }
  }

  const handlePackageChange = (pkgId: string) => {
    setSelectedPackageId(pkgId)
    const pkg = packages.find(p => p.id === pkgId)
    if (pkg) setContractDealValue(Number(pkg.price))
  }

  const updateRow = (i: number, field: keyof ScheduleRow, value: string | number) => {
    setSchedule(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r))
  }

  const handleCreateContract = async () => {
    if (!signerName || !signerEmail) { setContractError('Naam en e-mail zijn verplicht'); return }
    if (!contextFirstPayment && (!firstDepositAmount || firstDepositAmount <= 0)) {
      setContractError('Vul een first deposit-bedrag in'); return
    }
    setContractCreating(true); setContractError('')
    try {
      const res = await fetch('/api/finance-contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call_id: call.id,
          deal_value: contractDealValue,
          number_of_installments: numInstallments,
          schedule,
          signer_name: signerName,
          signer_email: signerEmail,
          signer_mobile: signerMobile || undefined,
          package_id: selectedPackageId || undefined,
          address: address || undefined,
          postcode: postcode || undefined,
          city: city || undefined,
          ...(contextFirstPayment
            ? { account_id: context?.account?.id, first_payment_id: contextFirstPayment.id }
            : { first_deposit_amount: firstDepositAmount, first_deposit_date: firstDepositDate }),
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setContractError(d.error || 'Contract aanmaken mislukt'); return
      }
      setShowContractModal(false)
      await loadContext(); onUpdate()
    } catch {
      setContractError('Netwerkfout bij aanmaken contract')
    } finally { setContractCreating(false) }
  }

  const formatDateTime = (s: string | null) => {
    if (!s) return '—'
    try { return new Date(s).toLocaleString('nl-NL', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
    catch { return '—' }
  }

  // ── Render ──
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={onClose} />

      <div className="absolute right-0 top-0 h-full w-full max-w-3xl bg-gray-50 shadow-lg border-l border-gray-200 flex flex-col">
        {/* Header */}
        <div className="shrink-0 bg-white border-b border-gray-100 px-6 py-4 flex items-start justify-between">
          <div className="min-w-0">
            <h2 className="text-2xl font-semibold text-gray-900 truncate">{name || 'Onbekend'}</h2>
            <div className="flex items-center gap-2 mt-1.5">
              {call.source && (
                <span className="inline-flex text-[11px] font-medium bg-amber-50 text-amber-700 rounded px-2 py-0.5 uppercase">{call.source}</span>
              )}
              {result && <span className="inline-flex text-[11px] font-medium bg-gray-100 text-gray-600 rounded px-2 py-0.5">{result}</span>}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition duration-[120ms]">
            <X className="w-5 h-5 text-gray-500" {...iconProps} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-7">
          {/* Contact Information */}
          <Section title="Contact Information">
            <Row label="Name"><input value={name} onChange={e => setName(e.target.value)} className={inputCls} /></Row>
            <Row label="Email"><input value={email} onChange={e => setEmail(e.target.value)} className={inputCls} /></Row>
            <Row label="Phone"><span className="text-sm text-gray-900">{call.phone || '—'}</span></Row>
            <Row label="Closer">
              <select value={closerId} onChange={e => setCloserId(e.target.value)} className={inputCls}>
                <option value="">— Geen —</option>
                {closers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Row>
            <Row label="Setter"><span className="text-sm text-gray-900">{call.setter?.name || '—'}</span></Row>
            <Row label="Creator"><span className="text-sm text-gray-900">{context?.lead?.creator_name || '—'}</span></Row>
            <Row label="Source" last><span className="text-sm text-gray-900">{call.source || '—'}</span></Row>
          </Section>

          {/* Scheduling */}
          <Section title="Scheduling">
            <Row label="Date Start Time"><span className="text-sm text-gray-900">{formatDateTime(call.date_start_time)}</span></Row>
            <Row label="Week"><span className="text-sm text-gray-900">{call.week ? `Week ${call.week}${call.month ? ` - ${new Date(call.date_start_time || '').getFullYear() || ''}` : ''}` : '—'}</span></Row>
            <Row label="Month"><span className="text-sm text-gray-900">{call.month ? `${call.month}` : '—'}</span></Row>
            <Row label="Event Type" last><span className="text-sm text-gray-900">{call.event_type || '—'}</span></Row>
          </Section>

          {/* Sales Information */}
          <Section title="Sales Information">
            <Row label="Result">
              <select value={result} onChange={e => setResult(e.target.value as CallResult)} className={inputCls}>
                <option value="">— Selecteer —</option>
                {RESULT_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </Row>
            <Row label="Closing Notes">
              <textarea value={closingNotes} onChange={e => setClosingNotes(e.target.value)} rows={3} className={`${inputCls} resize-none`} />
            </Row>
            {result?.startsWith('LOST') && (
              <Row label="No Deal Reason"><input value={noDealReason} onChange={e => setNoDealReason(e.target.value)} className={inputCls} /></Row>
            )}
            <Row label="Send to Slack" last>
              <button onClick={sendClosingToSlack} disabled={slackSent || !closingNotes.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-br from-violet-600 to-violet-800 hover:opacity-90 disabled:opacity-40 shadow-sm transition">
                {slackSent ? <><Check className="w-4 h-4" /> Verstuurd</> : <><Send className="w-4 h-4" /> Send to Slack</>}
              </button>
            </Row>
          </Section>

          {/* Setter / Triage notes — alleen als gevuld */}
          {call.setter_notes && (
            <Section title="Setter Notes">
              <div className="py-3.5 text-sm text-gray-700 whitespace-pre-wrap">{call.setter_notes}</div>
            </Section>
          )}
          {triageNotes && (
            <Section title="Triage Notes">
              <div className="py-3.5 text-sm text-gray-700 whitespace-pre-wrap">{triageNotes}</div>
            </Section>
          )}

          {/* Payment Progress */}
          {dealTotal > 0 && (
            <div>
              <SectionTitle>Payment Progress</SectionTitle>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-baseline justify-between mb-3">
                  <span className="text-lg font-semibold text-accent-700">{eur(collected)} collected</span>
                  <span className="text-sm text-gray-400">of {eur(dealTotal)}</span>
                </div>
                <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full bg-accent-600 rounded-full transition-all" style={{ width: `${Math.min(collectedPct, 100)}%` }} />
                </div>
                <div className="text-right text-xs text-gray-400 mt-1.5 tabular-nums">{collectedPct}%</div>
              </div>
            </div>
          )}

          {/* Payment Links — altijd zichtbaar, ongeacht result */}
          <div>
              <SectionTitle>Payment Links</SectionTitle>
              <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                {linkedPayments.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-gray-500 mb-2">Previous Payment Links</div>
                    <div className="space-y-2">
                      {linkedPayments.map(p => {
                        const link = p.whop_link || p.stripe_link || ''
                        return (
                          <div key={p.id} className="flex items-center justify-between gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                            <span className="text-sm text-gray-800 truncate">{name} — {eur(p.amount)}</span>
                            <button onClick={() => copy(link, `prev-${p.id}`)} className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gray-100 text-gray-600 text-xs font-medium hover:bg-gray-200">
                              {copied === `prev-${p.id}` ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} Copy Link
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <Row label="First Deposit">
                  <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">€</span>
                    <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value === '' ? '' : Number(e.target.value))} className={`pl-8 tabular-nums ${inputCls}`} /></div>
                </Row>

                {recentLink && (
                  <Row label="Most Recent Link">
                    <div className="flex items-center gap-2">
                      <a href={recentLink} target="_blank" rel="noopener noreferrer" className="text-sm text-accent-700 underline truncate">{recentLink}</a>
                      <button onClick={() => copy(recentLink, 'recent')} className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-white text-xs font-medium bg-gradient-to-br from-blue-500 to-blue-700 hover:opacity-90">
                        {copied === 'recent' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} Copy
                      </button>
                    </div>
                  </Row>
                )}

                <Row label="Generate Link" last>
                  <button onClick={generateWhopTopLevel} disabled={payGenerating}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-br from-violet-600 to-violet-800 hover:opacity-90 disabled:opacity-40 shadow-sm">
                    <Link2 className="w-4 h-4" /> {payGenerating ? 'Genereren...' : 'Generate Whop Link'}
                  </button>
                </Row>
              </div>
          </div>

          {/* Installments */}
          {installments.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-500 mb-2">Installments ({installments.length})</div>
              <div className="space-y-2">
                {installments.map(p => {
                  const link = p.whop_link || p.stripe_link
                  const late = isLate(p)
                  return (
                    <div key={p.id} className="bg-white rounded-lg border border-gray-200 px-4 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-gray-900">Installment {p.installment_number} — {eur(p.amount)}</div>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                            {p.due_date && <span>Due: {formatDate(p.due_date)}</span>}
                            <span className={`px-2 py-0.5 rounded font-medium ${p.status === 'PAID' ? 'bg-emerald-50 text-emerald-600' : late ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                              {p.status === 'PAID' ? 'PAID' : late ? 'LATE' : p.status}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {link ? (
                            <button onClick={() => copy(link, `inst-${p.id}`)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gray-100 text-gray-600 text-xs font-medium hover:bg-gray-200">
                              {copied === `inst-${p.id}` ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} Copy Link
                            </button>
                          ) : (
                            <button onClick={() => generateForPayment(p.id)} disabled={rowBusy === p.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-violet-50 text-violet-700 text-xs font-medium hover:bg-violet-100 disabled:opacity-40">
                              <Link2 className="w-3.5 h-3.5" /> {rowBusy === p.id ? '...' : 'Whop'}
                            </button>
                          )}
                          <button onClick={() => { setLinkEditId(linkEditId === p.id ? null : p.id); setLinkEditValue(link || '') }} className="text-[11px] text-gray-400 hover:text-gray-700 underline">
                            {link ? 'wijzig' : '+ link'}
                          </button>
                        </div>
                      </div>
                      {linkEditId === p.id && (
                        <div className="flex items-center gap-2 mt-2">
                          <input type="url" value={linkEditValue} onChange={e => setLinkEditValue(e.target.value)} placeholder="Plak betaallink" className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent-700" />
                          <button onClick={() => saveManualLink(p.id)} disabled={rowBusy === p.id} className="px-3 py-1.5 rounded bg-accent-700 text-white text-xs disabled:opacity-50">Opslaan</button>
                          <button onClick={() => { setLinkEditId(null); setLinkEditValue('') }} className="px-2 py-1.5 rounded border border-gray-200 text-gray-500 text-xs">×</button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Qualification Questions — één bron (Calendly-vragen, anders quiz) */}
          {(hasQuestions || hasQuiz) && (
            <div>
              <SectionTitle>Qualification Questions</SectionTitle>
              <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
                {hasQuestions
                  ? (Array.isArray(call.questions)
                      ? (call.questions as { question: string; answer: string }[]).map((qa, i) => <QA key={`c${i}`} q={qa.question} a={qa.answer} />)
                      : Object.entries(call.questions!).map(([q, a]) => <QA key={q} q={q} a={String(a)} />))
                  : quiz!.map((qa, i) => <QA key={`q${i}`} q={qa.question} a={qa.answer} />)}
              </div>
            </div>
          )}

          {/* Contract status */}
          {context?.contract && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4">
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-emerald-600" />
                <span className="text-base font-semibold text-emerald-700">
                  {context.contract.contract_signed ? 'Contract Signed' : context.contract.contract_sent ? 'Contract Sent' : 'Contract'}
                </span>
              </div>
              <div className="mt-2 text-sm text-gray-600 space-y-1">
                {context.contract.payment_plan && <div>Plan: {context.contract.payment_plan}</div>}
                {context.contract.contract_url && (
                  <div>Contract URL: <a href={context.contract.contract_url} target="_blank" rel="noopener noreferrer" className="text-accent-700 underline break-all">{context.contract.contract_url}</a></div>
                )}
                {context.contract.contract_pdf_url && (
                  <a href={context.contract.contract_pdf_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent-700 underline"><ExternalLink className="w-3.5 h-3.5" /> Download PDF</a>
                )}
                {!context.contract.contract_url && context.contract.esign_status === 'PENDING_CONFIG' && (
                  <div className="text-amber-600">esignatures nog niet geconfigureerd — contract aangemaakt, nog niet verstuurd.</div>
                )}
              </div>
            </div>
          )}

          {/* Create Contract button */}
          {canCreateContract && (
            <button onClick={() => setShowContractModal(true)}
              className="w-full flex items-center justify-center py-5 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 shadow-md hover:opacity-95 transition">
              <span className="inline-flex items-center gap-2 px-8 py-3 bg-white rounded-lg text-accent-700 font-semibold shadow-sm">
                <FileText className="w-5 h-5" /> CREATE CONTRACT
              </span>
            </button>
          )}

          {contextLoading && <div className="text-xs text-gray-400">Context laden...</div>}
        </div>

        {/* Footer */}
        <div className="shrink-0 bg-white border-t border-gray-100 px-6 py-4 flex gap-3">
          <button onClick={saveAll} disabled={saving}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 shadow-sm transition">
            {saving ? 'Opslaan...' : saved ? <><Check className="w-4 h-4" /> Opgeslagen</> : <><Save className="w-4 h-4" /> Opslaan</>}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition">Sluiten</button>
        </div>
      </div>

      {/* ── Create Contract Modal ── */}
      {showContractModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => setShowContractModal(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-auto shadow-xl" onClick={e => e.stopPropagation()}>
            {/* Modal header */}
            <div className="px-8 py-6 bg-gradient-to-br from-blue-400 to-blue-600 flex items-start justify-between">
              <div>
                <h3 className="text-2xl font-medium text-white flex items-center gap-2"><FileText className="w-6 h-6" /> Create Contract</h3>
                <p className="text-sm text-white/90 mt-1">For {signerName || name}</p>
              </div>
              <button onClick={() => setShowContractModal(false)} className="p-2 rounded-lg bg-white/20 text-white hover:bg-white/30"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-8 space-y-5">
              <div className="text-[11px] font-semibold text-accent-600 uppercase tracking-wider">Contract Details</div>

              {packages.length > 0 && (
                <Field label="Package">
                  <select value={selectedPackageId} onChange={e => handlePackageChange(e.target.value)} className={inputCls}>
                    <option value="">— Select a Package —</option>
                    {packages.map(p => <option key={p.id} value={p.id}>{p.name} — {eur(p.price)}</option>)}
                  </select>
                </Field>
              )}

              <Field label="Deal Value" req>
                <input type="number" value={contractDealValue} onChange={e => setContractDealValue(e.target.value === '' ? 0 : Number(e.target.value))} className={inputCls} />
              </Field>

              <Field label="Payment Plan" req>
                <select value={paymentPlan} onChange={e => setPaymentPlan(e.target.value)} className={inputCls}>
                  {PAYMENT_PLANS.map(p => <option key={p.label} value={p.label}>{p.label}</option>)}
                </select>
                {totalPayments > 1 && contractDealValue > 0 && (
                  <div className="mt-1.5 text-xs text-accent-700">💡 {totalPayments} payments of {eur(perPayment)} each</div>
                )}
              </Field>

              <div className="grid grid-cols-[1fr_auto_auto] gap-3">
                <Field label="Adres"><input value={address} onChange={e => setAddress(e.target.value)} placeholder="Straatnaam 123" className={inputCls} /></Field>
                <Field label="Postcode"><input value={postcode} onChange={e => setPostcode(e.target.value)} placeholder="1234 AB" className={`${inputCls} w-32`} /></Field>
                <Field label="City"><input value={city} onChange={e => setCity(e.target.value)} placeholder="Amsterdam" className={`${inputCls} w-36`} /></Field>
              </div>

              <div className="text-[11px] font-semibold text-accent-600 uppercase tracking-wider pt-1">First Deposit</div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Amount" req>
                  <input type="number" value={firstDepositAmount || ''} onChange={e => setFirstDepositAmount(e.target.value === '' ? 0 : Number(e.target.value))} className={inputCls} />
                </Field>
                <Field label="Date" req>
                  <input type="date" value={firstDepositDate} onChange={e => setFirstDepositDate(e.target.value)} className={inputCls} />
                </Field>
              </div>

              {numInstallments > 0 && (
                <>
                  <div className="text-[11px] font-semibold text-accent-600 uppercase tracking-wider pt-1">Installments ({numInstallments})</div>
                  <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                    {schedule.map((row, i) => (
                      <div key={i}>
                        <div className="text-[11px] font-semibold text-accent-600 uppercase mb-1.5">{ordinal(i + 2)} Installment</div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] text-gray-400 uppercase">Amount</label>
                            <input type="number" value={row.amount} onChange={e => updateRow(i, 'amount', Number(e.target.value))} className={`mt-1 ${inputCls}`} />
                          </div>
                          <div>
                            <label className="text-[11px] text-gray-400 uppercase">Date</label>
                            <input type="date" value={row.due_date} onChange={e => updateRow(i, 'due_date', e.target.value)} className={`mt-1 ${inputCls}`} />
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between border-t border-gray-200 pt-3">
                      <span className="text-sm text-gray-500">Total of all payments:</span>
                      <span className={`text-lg font-semibold tabular-nums ${balanced ? 'text-accent-700' : 'text-red-600'}`}>
                        {eur(totalScheduled)} {balanced ? '✓' : `(≠ ${eur(contractDealValue)})`}
                      </span>
                    </div>
                  </div>
                </>
              )}

              {contractError && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{contractError}</div>}

              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <button onClick={() => setShowContractModal(false)} className="px-5 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                <Button onClick={handleCreateContract} disabled={contractCreating}>
                  <FileText className="w-4 h-4" /> {contractCreating ? 'Aanmaken...' : 'Create Contract'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── styling + helpers ── */
const inputCls = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-accent-700 transition-shadow duration-[120ms]'

function SectionTitle({ children }: { children: string }) {
  return <h3 className="text-sm font-semibold text-accent-600 uppercase tracking-wider mb-3 pb-2 border-b border-gray-200">{children}</h3>
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <SectionTitle>{title}</SectionTitle>
      <div className="bg-white rounded-xl border border-gray-200 px-5 divide-y divide-gray-100">{children}</div>
    </div>
  )
}

function Row({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={`grid grid-cols-[150px_1fr] gap-4 items-center py-3.5 ${last ? '' : ''}`}>
      <div className="text-sm font-medium text-gray-500">{label}</div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function Field({ label, children, req }: { label: string; children: React.ReactNode; req?: boolean }) {
  return (
    <div>
      <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{label}{req && <span className="text-red-500"> *</span>}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  )
}

function QA({ q, a }: { q: string; a: string }) {
  return (
    <div className="bg-gray-50 rounded-md px-3 py-2 border-l-2 border-l-gray-300">
      <div className="text-[11px] text-gray-500 mb-0.5">{q}</div>
      <div className="text-sm text-gray-900">{a}</div>
    </div>
  )
}

function ordinal(n: number): string {
  const map: Record<number, string> = { 1: '1st', 2: '2nd', 3: '3rd' }
  return map[n] || `${n}th`
}
