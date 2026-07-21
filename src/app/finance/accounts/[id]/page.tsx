'use client'

import { useState, useEffect, useRef, use } from 'react'
import Link from 'next/link'
import { SkeletonPage } from '@/components/ui/skeleton'
import { KpiCard } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { eur, formatDate } from '@/lib/format'
import {
  ArrowLeft, FileText, CreditCard, Upload, CheckCircle, XCircle,
  ExternalLink, Clock,
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

function daysBetween(dateStr: string | null): number | null {
  if (!dateStr) return null
  const due = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)
  return Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export default function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [account, setAccount] = useState<Account | null>(null)
  const [contracts, setContracts] = useState<Contract[]>([])
  const [incoming, setIncoming] = useState<IncomingPayment[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.all([
      fetch(`/api/accounts?search=`).then(r => r.json()),
      fetch(`/api/incoming-payments?account_id=${id}`).then(r => r.json()),
    ]).then(async ([, incomingData]) => {
      // Fetch account detail via dedicated query
      const accRes = await fetch(`/api/accounts?search=&page=1&pageSize=1`)
      // We need a dedicated endpoint or use the list with ID filter
      // For now, fetch all data via separate calls
      const { getAccountById, getContractsForAccount, getPaymentsForAccount } = await import('@/lib/queries/accounts')
      const acc = await getAccountById(id)
      const ctrs = await getContractsForAccount(id)
      const pmts = await getPaymentsForAccount(id)

      setAccount(acc)
      setContracts(ctrs)
      setIncoming(Array.isArray(incomingData) ? incomingData : [])
      setPayments(pmts as Payment[])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [id])

  const handleUploadScreenshot = async (incomingPaymentId: string, file: File) => {
    setUploading(incomingPaymentId)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('incoming_payment_id', incomingPaymentId)

    await fetch('/api/incoming-payments/upload-screenshot', {
      method: 'POST',
      body: formData,
    })

    // Refresh incoming payments
    const res = await fetch(`/api/incoming-payments?account_id=${id}`)
    const data = await res.json()
    setIncoming(Array.isArray(data) ? data : [])
    setUploading(null)
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

  const openAmount = incoming
    .filter(ip => ip.status !== 'PAID' && ip.status !== 'REFUNDED')
    .reduce((s, ip) => s + ip.amount, 0)

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
          href="/finance/accounts"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" {...iconProps} />
          Accounts
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-gray-900">{account.name}</h1>
          <Badge status={account.status} />
        </div>
        <p className="text-sm text-gray-500 mt-0.5">{account.email || 'Geen e-mail'}</p>
      </div>

      {/* KPI's */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="LTV" value={eur(account.ltv)} captionColor="success" />
        <KpiCard label="Openstaand" value={eur(openAmount)} caption={`${incoming.filter(ip => ip.status !== 'PAID').length} termijnen`} />
        <KpiCard label="Te laat" value={lateCount} captionColor={lateCount > 0 ? 'danger' : 'default'} />
        <KpiCard label="Betalingen" value={payments.length} caption={`${payments.filter(p => p.paid).length} betaald`} />
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

      {/* Contracts */}
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

      {/* Termijnen (incoming_payments) */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-gray-400" {...iconProps} />
          <h2 className="text-sm font-semibold text-gray-900">Termijnen</h2>
          <span className="text-xs text-gray-400">({incoming.length})</span>
        </div>

        <div className="grid grid-cols-[60px_1fr_100px_100px_80px_120px] gap-4 px-5 py-3 border-b border-gray-100 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
          <div className="text-center">#</div>
          <div>Status</div>
          <div className="text-right">Bedrag</div>
          <div>Vervaldatum</div>
          <div className="text-center">Dagen</div>
          <div>Actie</div>
        </div>

        {incoming.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">Geen termijnen</div>
        ) : (
          incoming.map((ip) => {
            const days = daysBetween(ip.due_date)
            const isLate = days !== null && days < 0 && ip.status !== 'PAID' && ip.status !== 'REFUNDED'
            const isPaid = ip.status === 'PAID'

            return (
              <div
                key={ip.id}
                className={`grid grid-cols-[60px_1fr_100px_100px_80px_120px] gap-4 px-5 py-3.5 border-b border-gray-50 items-center ${isPaid ? 'opacity-60' : ''}`}
              >
                <div className="text-center text-sm text-gray-900 tabular-nums font-medium">
                  #{ip.installment_number}
                </div>
                <div className="flex items-center gap-2">
                  <Badge status={ip.status} />
                  {ip.verification_status === 'PENDING' && (
                    <Badge status="PENDING" />
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
                <div className="flex items-center gap-2">
                  {!isPaid && ip.status !== 'REFUNDED' && (
                    <>
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
                      {!ip.is_manual && ip.verification_status !== 'PENDING' && (
                        <button
                          onClick={() => {
                            fileRef.current?.setAttribute('data-ip-id', ip.id)
                            fileRef.current?.click()
                          }}
                          disabled={uploading === ip.id}
                          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 font-medium"
                        >
                          <Upload className="w-3 h-3" {...iconProps} />
                          {uploading === ip.id ? 'Bezig...' : 'Manueel'}
                        </button>
                      )}
                      {ip.screenshot_url && ip.verification_status === 'PENDING' && (
                        <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
                          <Clock className="w-3 h-3" {...iconProps} />
                          Wacht verificatie
                        </span>
                      )}
                    </>
                  )}
                  {isPaid && (
                    <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" {...iconProps} />
                      Betaald
                    </span>
                  )}
                </div>
              </div>
            )
          })
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
    </div>
  )
}
