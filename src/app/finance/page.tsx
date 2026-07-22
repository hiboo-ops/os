'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { KpiCard } from '@/components/ui/card'
import { SkeletonPage } from '@/components/ui/skeleton'
import { eur } from '@/lib/format'
import { Users, ClipboardCheck, ArrowRight } from 'lucide-react'

const iconProps = { strokeWidth: 1.75 } as const

interface Overview {
  totalOpen: number
  openCount: number
  lateCount: number
  lateAmount: number
  upcomingAmount: number
  cashCollected: number
  accountsCount: number
}

export default function FinancePage() {
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/finance/overview')
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <SkeletonPage />

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Finance</h1>
        <p className="text-sm text-gray-500 mt-0.5">Overzicht van openstaande termijnen en cash</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Totaal openstaand"
          value={eur(data?.totalOpen ?? 0)}
          caption={`${data?.openCount ?? 0} termijnen`}
        />
        <KpiCard
          label="Te laat"
          value={eur(data?.lateAmount ?? 0)}
          caption={`${data?.lateCount ?? 0} termijnen`}
          captionColor={(data?.lateCount ?? 0) > 0 ? 'danger' : 'default'}
        />
        <KpiCard
          label="Aankomend deze maand"
          value={eur(data?.upcomingAmount ?? 0)}
        />
        <KpiCard
          label="Cash collected"
          value={eur(data?.cashCollected ?? 0)}
          caption="excl. legacy"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/finance/accounts"
          className="group flex items-center justify-between bg-white rounded-lg border border-gray-200 p-5 hover:border-gray-300 transition-colors duration-[120ms]"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center">
              <Users className="w-5 h-5 text-gray-500" {...iconProps} />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900">Accounts</div>
              <div className="text-xs text-gray-500">{data?.accountsCount ?? 0} accounts</div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" {...iconProps} />
        </Link>

        <Link
          href="/finance/verificatie"
          className="group flex items-center justify-between bg-white rounded-lg border border-gray-200 p-5 hover:border-gray-300 transition-colors duration-[120ms]"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-gray-500" {...iconProps} />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900">Verificatie</div>
              <div className="text-xs text-gray-500">Handmatige betalingen goedkeuren</div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" {...iconProps} />
        </Link>
      </div>
    </div>
  )
}
