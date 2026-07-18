'use client'

import { useState, useEffect, useMemo } from 'react'
import { SkeletonPage } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { eur, formatDate } from '@/lib/format'
import { getDealsWithContracts } from '@/lib/queries/sales'
import type { DealWithContract } from '@/lib/queries/sales'
import {
  FileText, AlertTriangle, Check, X as XIcon,
} from 'lucide-react'

const iconProps = { strokeWidth: 1.75 } as const

export default function DealsPage() {
  const [deals, setDeals] = useState<DealWithContract[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDealsWithContracts().then(data => {
      setDeals(data)
      setLoading(false)
    })
  }, [])

  // Sort: unsigned first, then by date (newest first)
  const sorted = useMemo(() => {
    return [...deals].sort((a, b) => {
      const aHasContract = a.contracts && a.contracts.length > 0
      const bHasContract = b.contracts && b.contracts.length > 0
      const aSigned = aHasContract
      const bSigned = bHasContract

      // Unsigned first
      if (!aSigned && bSigned) return -1
      if (aSigned && !bSigned) return 1

      // Then newest first
      return (b.date_start_time || '').localeCompare(a.date_start_time || '')
    })
  }, [deals])

  const unsignedCount = useMemo(
    () => deals.filter(d => !d.contracts || d.contracts.length === 0).length,
    [deals]
  )

  if (loading) return <SkeletonPage />

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Deals</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            <span className="tabular-nums">{deals.length}</span> deals totaal
          </p>
        </div>

        {unsignedCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-red-500" {...iconProps} />
            <span className="text-sm text-red-700 font-medium">
              <span className="tabular-nums">{unsignedCount}</span> deal{unsignedCount !== 1 ? 's' : ''} zonder contract
            </span>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_120px_1fr_120px_120px_130px_130px] gap-4 px-5 py-3 border-b border-gray-100 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
          <div>Naam</div>
          <div>Datum</div>
          <div>Closer</div>
          <div>Source</div>
          <div className="text-right">Deal Value</div>
          <div className="text-center">Contract Sent</div>
          <div className="text-center">Contract Signed</div>
        </div>

        {/* Table body */}
        {sorted.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <FileText className="w-8 h-8 text-gray-200 mx-auto mb-3" {...iconProps} />
            <p className="text-sm text-gray-400">Geen deals gevonden</p>
          </div>
        ) : (
          sorted.map(deal => {
            const hasSentContract = deal.first_deposits && deal.first_deposits.length > 0
            const hasSignedContract = deal.contracts && deal.contracts.length > 0
            const isUnsigned = !hasSignedContract

            return (
              <div
                key={deal.id}
                className={`grid grid-cols-[1fr_120px_1fr_120px_120px_130px_130px] gap-4 px-5 py-3.5 border-b border-gray-50 items-center hover:bg-gray-50 transition-colors duration-[120ms] ${
                  isUnsigned ? 'border-l-[3px] border-l-red-400' : ''
                }`}
              >
                {/* Name */}
                <div>
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {deal.name || 'Onbekend'}
                  </div>
                  {deal.email && (
                    <div className="text-xs text-gray-400 truncate">{deal.email}</div>
                  )}
                </div>

                {/* Date */}
                <div className="text-sm text-gray-700 tabular-nums">
                  {formatDate(deal.date_start_time)}
                </div>

                {/* Closer */}
                <div className="text-sm text-gray-700 truncate">
                  {deal.closer?.name || '—'}
                </div>

                {/* Source — using payment_plan as proxy or show dash */}
                <div>
                  {deal.payment_plan ? (
                    <span className="inline-flex text-[10px] font-medium bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">
                      {deal.payment_plan}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-300">—</span>
                  )}
                </div>

                {/* Deal Value */}
                <div className="text-sm text-right tabular-nums font-semibold text-gray-900">
                  {deal.deal_value != null ? eur(deal.deal_value) : '—'}
                </div>

                {/* Contract Sent */}
                <div className="text-center">
                  {hasSentContract ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 rounded-md px-2 py-0.5 border border-emerald-200">
                      <Check className="w-3 h-3" {...iconProps} />
                      Verstuurd
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 bg-red-50 rounded-md px-2 py-0.5 border border-red-200">
                      <XIcon className="w-3 h-3" {...iconProps} />
                      Niet verstuurd
                    </span>
                  )}
                </div>

                {/* Contract Signed */}
                <div className="text-center">
                  {hasSignedContract ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 rounded-md px-2 py-0.5 border border-emerald-200">
                      <Check className="w-3 h-3" {...iconProps} />
                      Getekend
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 bg-red-50 rounded-md px-2 py-0.5 border border-red-200">
                      <XIcon className="w-3 h-3" {...iconProps} />
                      Niet getekend
                    </span>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
