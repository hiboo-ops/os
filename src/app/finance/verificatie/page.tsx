'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { SkeletonPage } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { eur, formatDate } from '@/lib/format'
import {
  ShieldCheck, CheckCircle, XCircle, Image as ImageIcon, ExternalLink,
} from 'lucide-react'

const iconProps = { strokeWidth: 1.75 } as const

interface PendingItem {
  id: string
  account_id: string
  installment_number: number
  amount: number
  due_date: string | null
  screenshot_url: string | null
  verification_status: string | null
  created_at: string
  account: { id: string; name: string; email: string | null }
}

export default function VerificatiePage() {
  const [items, setItems] = useState<PendingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const fetchPending = useCallback(async () => {
    const res = await fetch('/api/incoming-payments?status=SCHEDULED')
    const allData = await res.json()
    // Filter for PENDING verification
    const pending = (Array.isArray(allData) ? allData : []).filter(
      (ip: PendingItem) => ip.verification_status === 'PENDING'
    )
    setItems(pending)
    setLoading(false)
  }, [])

  useEffect(() => { fetchPending() }, [fetchPending])

  const handleVerify = async (id: string, action: 'VERIFIED' | 'REJECTED') => {
    setProcessing(id)
    await fetch('/api/incoming-payments/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ incoming_payment_id: id, action }),
    })
    await fetchPending()
    setProcessing(null)
    setPreviewUrl(null)
  }

  if (loading) return <SkeletonPage />

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Verificatie-queue</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {items.length} handmatige overschrijving{items.length !== 1 ? 'en' : ''} wacht{items.length !== 1 ? 'en' : ''} op verificatie
        </p>
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <ShieldCheck className="w-10 h-10 text-gray-200 mx-auto mb-3" {...iconProps} />
          <p className="text-sm text-gray-400">Geen openstaande verificaties</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Link
                      href={`/finance/accounts/${item.account_id}`}
                      className="text-sm font-medium text-gray-900 hover:text-accent-700 transition-colors"
                    >
                      {item.account?.name || 'Onbekend'}
                    </Link>
                    <Badge status="PENDING" />
                  </div>
                  <p className="text-xs text-gray-500">
                    {item.account?.email || '—'} &middot; Termijn #{item.installment_number} &middot; {formatDate(item.due_date)}
                  </p>
                  <div className="text-lg font-semibold text-gray-900 tabular-nums mt-2">
                    {eur(item.amount)}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {item.screenshot_url && (
                    <button
                      onClick={() => setPreviewUrl(previewUrl === item.screenshot_url ? null : item.screenshot_url)}
                      className="inline-flex items-center gap-1.5 px-3 h-8 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <ImageIcon className="w-3.5 h-3.5" {...iconProps} />
                      Screenshot
                    </button>
                  )}
                  <button
                    onClick={() => handleVerify(item.id, 'VERIFIED')}
                    disabled={processing === item.id}
                    className="inline-flex items-center gap-1.5 px-3 h-8 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                  >
                    <CheckCircle className="w-3.5 h-3.5" {...iconProps} />
                    Goedkeuren
                  </button>
                  <button
                    onClick={() => handleVerify(item.id, 'REJECTED')}
                    disabled={processing === item.id}
                    className="inline-flex items-center gap-1.5 px-3 h-8 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
                  >
                    <XCircle className="w-3.5 h-3.5" {...iconProps} />
                    Afwijzen
                  </button>
                </div>
              </div>

              {/* Screenshot preview */}
              {previewUrl === item.screenshot_url && item.screenshot_url && (
                <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                  <img
                    src={item.screenshot_url}
                    alt="Betalingsbewijs"
                    className="max-w-full max-h-96 object-contain mx-auto"
                  />
                  <div className="px-4 py-2 border-t border-gray-200 flex justify-end">
                    <a
                      href={item.screenshot_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-accent-700 hover:text-accent-800 font-medium"
                    >
                      <ExternalLink className="w-3 h-3" {...iconProps} />
                      Openen in nieuw tabblad
                    </a>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
