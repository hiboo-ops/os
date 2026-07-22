'use client'

import { useState, useEffect, useRef, useCallback, use } from 'react'
import Link from 'next/link'
import { SkeletonPage } from '@/components/ui/skeleton'
import { KpiCard } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { eur, formatDate } from '@/lib/format'
import {
  ArrowLeft, FileText, CreditCard, Upload, CheckCircle,
  ExternalLink, Clock, Phone, Send, MessageSquare,
  AlertTriangle, Calendar,
} from 'lucide-react'

const iconProps = { strokeWidth: 1.75 } as const

interface Account {
  id: string
  name: string
  email: string | null
  phone: string | null
  status: string
  ltv: number
  source: string | null
  creator: { id: string; name: string } | null
  setter: { id: string; name: string } | null
  closer: { id: string; name: string } | null
  coach: { id: string; name: string } | null
  lead_id: string | null
  call_id: string | null
  client_id: string | null
  created_at: string
}

interface Contract {
  id: string
  name: string
  deal_value: number | null
  payment_plan: string | null
  type: string | null
  contract_signed: boolean | null
  created_at: string
}

interface IncomingPayment {
  id: string
  installment_number: number
  amount: number
  due_date: string | null
  status: string
  collection_status: string
  promise_to_pay_date: string | null
  last_contact_at: string | null
  stripe_link: string | null
  whop_link: string | null
  is_manual: boolean
  screenshot_url: string | null
  verification_status: string | null
}

interface Payment {
  id: string
  payment_number: number
  amount: number
  paid: boolean
  paid_date: string | null
  status: string
  provider: string | null
}

interface Activity {
  id: string
  incoming_payment_id: string
  type: string
  note: string | null
  outcome: string | null
  promise_date: string | null
  created_at: string
}

function daysBetween(dateStr: string | null): number | null {
  if (!dateStr) return null
  const due = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)
  return Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

const activityTypeLabels: Record<string, { label: string; icon: typeof Phone; color: string }> = {
  REMINDER: { label: 'Reminder gestuurd', icon: Send, color: 'text-sky-600 bg-sky-50' },
  CONTACT: { label: 'Gecontacteerd', icon: Phone, color: 'text-blue-600 bg-blue-50' },
  NOTE: { label: 'Notitie', icon: MessageSquare, color: 'text-gray-600 bg-gray-50' },
  PROMISE: { label: 'Belofte geregistreerd', icon: Calendar, color: 'text-violet-600 bg-violet-50' },
  DISPUTE: { label: 'Geschil gemeld', icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
  PAYMENT_LINK: { label: 'Betaallink gestuurd', icon: ExternalLink, color: 'text-emerald-600 bg-emerald-50' },
  PAID: { label: 'Betaald gemarkeerd', icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50' },
}

export default function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [account, setAccount] = useState<Account | null>(null)
  const [contracts, setContracts] = useState<Contract[]>([])
  const [incoming, setIncoming] = useState<IncomingPayment[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Activity form
  const [activityPaymentId, setActivityPaymentId] = useState<string | null>(null)
  const [activityType, setActivityType] = useState('')
  const [activityNote, setActivityNote] = useState('')
  const [activityPromiseDate, setActivityPromiseDate] = useState('')
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [incomingRes, activitiesRes] = await Promise.all([
        fetch(`/api/incoming-payments?account_id=${id}`).then(r => r.json()),
        fetch(`/api/incoming-payments?account_id=${id}`).then(() => []), // activities fetched server-side below
      ])

      const { getAccountById, getContractsForAccount, getPaymentsForAccount } = await import('@/lib/queries/accounts')
      const { getActivitiesForAccount } = await import('@/lib/queries/collections')

      const [acc, ctrs, pmts, acts] = await Promise.all([
        getAccountById(id),
        getContractsForAccount(id),
        getPaymentsForAccount(id),
        getActivitiesForAccount(id),
      ])

      setAccount(acc)
      setContracts(ctrs)
      setIncoming(Array.isArray(incomingRes) ? incomingRes : [])
      setPayments(pmts as Payment[])
      setActivities(acts as Activity[])
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { loadData() }, [loadData])

  const handleUploadScreenshot = async (incomingPaymentId: string, file: File) => {
    setUploading(incomingPaymentId)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('incoming_payment_id', incomingPaymentId)

    await fetch('/api/incoming-payments/upload-screenshot', {
      method: 'POST',
      body: formData,
    })

    const res = await fetch(`/api/incoming-payments?account_id=${id}`)
    const data = await res.json()
    setIncoming(Array.isArray(data) ? data : [])
    setUploading(null)
  }

  const handleLogActivity = async () => {
    if (!activityPaymentId || !activityType) return
    setSaving(true)
    await fetch('/api/collection-activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        incoming_payment_id: activityPaymentId,
        account_id: id,
        type: activityType,
        note: activityNote || null,
        promise_date: activityType === 'PROMISE' ? activityPromiseDate || null : null,
      }),
    })
    setSaving(false)
    setActivityPaymentId(null)
    setActivityType('')
    setActivityNote('')
    setActivityPromiseDate('')
    // Reload all data
    setLoading(true)
    loadData()
  }

  if (loading) return <SkeletonPage />
  if (!account) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Account niet gevonden</p>
        <Link href="/finance/accounts" className="text-accent-700 text-sm mt-2 inline-block">
          Terug naar accounts
        </Link>
      </div>
    )
  }

  const openPayments = incoming.filter(ip => ip.status !== 'PAID' && ip.status !== 'REFUNDED')
  const openAmount = openPayments.reduce((s, ip) => s + ip.amount, 0)
  const paidAmount = incoming
    .filter(ip => ip.status === 'PAID')
    .reduce((s, ip) => s + ip.amount, 0)
  const totalPlan = incoming.reduce((s, ip) => s + ip.amount, 0)
  const paidPercentage = totalPlan > 0 ? Math.round((paidAmount / totalPlan) * 100) : 0

  const lateCount = incoming.filter(ip => {
    if (ip.status === 'PAID' || ip.status === 'REFUNDED') return false
    const days = daysBetween(ip.due_date)
    return days !== null && days < 0
  }).length

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/finance/collections"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" {...iconProps} />
          Collections
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-gray-900">{account.name}</h1>
          <Badge status={account.status} />
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <p className="text-sm text-gray-500">{account.email || 'Geen e-mail'}</p>
          {account.phone && <p className="text-sm text-gray-500">· {account.phone}</p>}
        </div>
      </div>

      {/* KPI's */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <KpiCard label="Planwaarde" value={eur(totalPlan)} />
        <KpiCard label="Betaald" value={eur(paidAmount)} caption={`${paidPercentage}%`} captionColor="success" />
        <KpiCard label="Openstaand" value={eur(openAmount)} caption={`${openPayments.length} termijnen`} />
        <KpiCard label="Te laat" value={lateCount} captionColor={lateCount > 0 ? 'danger' : 'default'} />
        <KpiCard label="LTV" value={eur(account.ltv)} />
      </div>

      {/* Attributie */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Attributie</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Creator</span>
            <div className="font-medium text-gray-900">{account.creator?.name || '—'}</div>
          </div>
          <div>
            <span className="text-gray-500">Setter</span>
            <div className="font-medium text-gray-900">{account.setter?.name || '—'}</div>
          </div>
          <div>
            <span className="text-gray-500">Closer</span>
            <div className="font-medium text-gray-900">{account.closer?.name || '—'}</div>
          </div>
          <div>
            <span className="text-gray-500">Coach</span>
            <div className="font-medium text-gray-900">{account.coach?.name || '—'}</div>
          </div>
          <div>
            <span className="text-gray-500">Source</span>
            <div>{account.source ? <Badge status={account.source} /> : '—'}</div>
          </div>
          <div>
            <span className="text-gray-500">Aangemaakt</span>
            <div className="font-medium text-gray-900">{formatDate(account.created_at)}</div>
          </div>
        </div>
      </div>

      {/* Contracten */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-400" {...iconProps} />
          <h2 className="text-sm font-semibold text-gray-900">Contracten</h2>
          <span className="text-xs text-gray-400">({contracts.length})</span>
        </div>
        {contracts.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">Geen contracten</div>
        ) : (
          contracts.map((c) => (
            <div key={c.id} className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-900">{c.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {c.type && <Badge status={c.type} />}
                  {c.payment_plan && <span className="ml-2">{c.payment_plan}</span>}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900 tabular-nums">{eur(c.deal_value)}</div>
                <div className="text-xs text-gray-400">{formatDate(c.created_at)}</div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Termijnschema */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-gray-400" {...iconProps} />
          <h2 className="text-sm font-semibold text-gray-900">Termijnschema</h2>
          <span className="text-xs text-gray-400">({incoming.length})</span>
        </div>

        <div className="grid grid-cols-[50px_1fr_100px_100px_80px_auto] gap-3 px-5 py-3 border-b border-gray-100 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
          <div className="text-center">#</div>
          <div>Status</div>
          <div className="text-right">Bedrag</div>
          <div>Verval</div>
          <div className="text-center">Dagen</div>
          <div>Acties</div>
        </div>

        {incoming.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">Geen termijnen</div>
        ) : (
          incoming.map((ip) => {
            const days = daysBetween(ip.due_date)
            const isLate = days !== null && days < 0 && ip.status !== 'PAID' && ip.status !== 'REFUNDED'
            const isPaid = ip.status === 'PAID'
            const isUpcoming = !isPaid && ip.status !== 'REFUNDED' && (!days || days >= 0)
            const promiseExpired = ip.promise_to_pay_date && ip.collection_status === 'PROMISE_TO_PAY' && daysBetween(ip.promise_to_pay_date)! < 0

            return (
              <div
                key={ip.id}
                className={`grid grid-cols-[50px_1fr_100px_100px_80px_auto] gap-3 px-5 py-3 border-b border-gray-50 items-center ${isPaid ? 'opacity-50' : ''}`}
              >
                <div className="text-center text-sm text-gray-900 tabular-nums font-medium">
                  #{ip.installment_number}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {isPaid ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                      <CheckCircle className="w-3.5 h-3.5" {...iconProps} /> Betaald
                    </span>
                  ) : isLate ? (
                    <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5" {...iconProps} /> Te laat
                    </span>
                  ) : isUpcoming ? (
                    <span className="inline-flex items-center gap-1 text-xs text-gray-500 font-medium">
                      <Clock className="w-3.5 h-3.5" {...iconProps} /> Aankomend
                    </span>
                  ) : null}
                  <Badge status={ip.collection_status} />
                  {ip.verification_status === 'PENDING' && <Badge status="PENDING" />}
                  {promiseExpired && (
                    <span className="text-[10px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
                      Belofte verlopen
                    </span>
                  )}
                </div>
                <div className="text-sm text-right tabular-nums font-medium text-gray-900">
                  {eur(ip.amount)}
                </div>
                <div className="text-sm text-gray-700 tabular-nums">
                  {ip.due_date
                    ? new Date(ip.due_date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
                    : '—'}
                </div>
                <div className="text-center">
                  {isLate && days !== null && (
                    <span className="inline-flex items-center text-[11px] font-semibold rounded-md px-2 py-0.5 tabular-nums text-red-600 bg-red-50">
                      {Math.abs(days)}d
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {!isPaid && ip.status !== 'REFUNDED' && (
                    <>
                      {/* Log contact */}
                      <button
                        onClick={() => {
                          setActivityPaymentId(ip.id)
                          setActivityType('')
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                      >
                        <Phone className="w-3 h-3" {...iconProps} /> Log
                      </button>
                      {/* Upload screenshot (markeer betaald) */}
                      {!ip.is_manual && ip.verification_status !== 'PENDING' && (
                        <button
                          onClick={() => {
                            fileRef.current?.setAttribute('data-ip-id', ip.id)
                            fileRef.current?.click()
                          }}
                          disabled={uploading === ip.id}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                        >
                          <Upload className="w-3 h-3" {...iconProps} />
                          {uploading === ip.id ? 'Bezig...' : 'Betaald'}
                        </button>
                      )}
                      {/* Payment links */}
                      {ip.whop_link && (
                        <a href={ip.whop_link} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-accent-700 hover:text-accent-800 font-medium">
                          <ExternalLink className="w-3 h-3" {...iconProps} /> Whop
                        </a>
                      )}
                      {ip.stripe_link && (
                        <a href={ip.stripe_link} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-accent-700 hover:text-accent-800 font-medium">
                          <ExternalLink className="w-3 h-3" {...iconProps} /> Stripe
                        </a>
                      )}
                      {ip.screenshot_url && ip.verification_status === 'PENDING' && (
                        <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
                          <Clock className="w-3 h-3" {...iconProps} /> Wacht verificatie
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Contactlog (activities timeline) */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-gray-400" {...iconProps} />
          <h2 className="text-sm font-semibold text-gray-900">Contactlog</h2>
          <span className="text-xs text-gray-400">({activities.length})</span>
        </div>
        {activities.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">Nog geen activiteiten gelogd</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {activities.map((act) => {
              const meta = activityTypeLabels[act.type] || { label: act.type, icon: MessageSquare, color: 'text-gray-600 bg-gray-50' }
              const Icon = meta.icon
              return (
                <div key={act.id} className="px-5 py-3.5 flex items-start gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${meta.color}`}>
                    <Icon className="w-3.5 h-3.5" {...iconProps} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">{meta.label}</div>
                    {act.note && <p className="text-sm text-gray-600 mt-0.5">{act.note}</p>}
                    {act.promise_date && (
                      <p className="text-xs text-violet-600 mt-0.5">
                        Beloofde datum: {new Date(act.promise_date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 tabular-nums shrink-0">
                    {new Date(act.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                    {' '}
                    {new Date(act.created_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Betalingen */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-emerald-500" {...iconProps} />
          <h2 className="text-sm font-semibold text-gray-900">Betalingen</h2>
          <span className="text-xs text-gray-400">({payments.length})</span>
        </div>
        {payments.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">Geen betalingen</div>
        ) : (
          payments.map((p) => (
            <div key={p.id} className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-900 tabular-nums font-medium">#{p.payment_number}</span>
                <Badge status={p.status} />
                {p.provider && <span className="text-xs text-gray-400">{p.provider}</span>}
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900 tabular-nums">{eur(p.amount)}</div>
                <div className="text-xs text-gray-400">{formatDate(p.paid_date)}</div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Hidden file input for screenshot upload */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          const ipId = fileRef.current?.getAttribute('data-ip-id')
          if (file && ipId) handleUploadScreenshot(ipId, file)
          e.target.value = ''
        }}
      />

      {/* Activity Log Modal */}
      {activityPaymentId && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={() => setActivityPaymentId(null)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 w-full max-w-md p-6 relative">
              <h3 className="text-base font-semibold text-gray-900 mb-1">Actie loggen</h3>
              <p className="text-sm text-gray-500 mb-4">
                {account.name} — Termijn #{incoming.find(ip => ip.id === activityPaymentId)?.installment_number}
              </p>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Type</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(activityTypeLabels).map(([key, { icon: Icon, label }]) => (
                      <button
                        key={key}
                        onClick={() => setActivityType(key)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                          activityType === key
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {activityType === 'PROMISE' && (
                  <div>
                    <label className="text-xs font-medium text-gray-700 mb-1 block">Beloofde betaaldatum</label>
                    <input
                      type="date"
                      value={activityPromiseDate}
                      onChange={(e) => setActivityPromiseDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Notitie</label>
                  <textarea
                    value={activityNote}
                    onChange={(e) => setActivityNote(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none"
                    placeholder="Optioneel..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setActivityPaymentId(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Annuleren
                </button>
                <button
                  onClick={handleLogActivity}
                  disabled={!activityType || saving}
                  className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Opslaan...' : 'Opslaan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
