'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { KpiCard, Card, CardHeader, CardContent } from '@/components/ui/card'
import { SkeletonPage } from '@/components/ui/skeleton'
import { eur } from '@/lib/format'
import { ClipboardList } from 'lucide-react'

interface DashData {
  creatorId: string | null
  leads: number
  accounts: number
  orderValue: number
  cashCollected: number
  eod: { reports: number; tiktokPosts: number; igPosts: number; storiesPosted: number }
}

export default function CreatorDashboardPage() {
  const [data, setData] = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/creator-dashboard').then(r => r.json()).then(setData).finally(() => setLoading(false))
  }, [])

  if (loading) return <SkeletonPage />

  const d = data
  const noLink = d && !d.creatorId

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Mijn dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Jouw resultaten als HIBOO-partner</p>
        </div>
        <Link href="/eod/creator" className="inline-flex items-center gap-2 px-4 h-9 bg-accent-700 text-white rounded-lg text-sm font-medium hover:bg-accent-800 transition">
          <ClipboardList className="w-4 h-4" strokeWidth={1.75} /> EOD invullen
        </Link>
      </div>

      {noLink && (
        <div className="mb-6 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          Je account is nog niet aan een creator-profiel gekoppeld. Vraag je partnermanager om de koppeling; daarna verschijnen je cijfers hier.
        </div>
      )}

      {/* Kern-KPI's */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Leads" value={d?.leads ?? 0} caption="via jouw attributie" />
        <KpiCard label="Order value" value={eur(d?.orderValue ?? 0)} caption={`${d?.accounts ?? 0} accounts`} />
        <KpiCard label="Cash collected" value={eur(d?.cashCollected ?? 0)} captionColor="success" />
        <KpiCard label="EOD-rapportages" value={d?.eod.reports ?? 0} caption="ingevuld" />
      </div>

      {/* EOD-metrics */}
      <Card>
        <CardHeader><h2 className="text-sm font-semibold text-gray-900">Content (uit je EOD)</h2></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Stat label="TikTok posts" value={d?.eod.tiktokPosts ?? 0} />
            <Stat label="Instagram posts" value={d?.eod.igPosts ?? 0} />
            <Stat label="Dagen met story" value={d?.eod.storiesPosted ?? 0} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold text-gray-900 tabular-nums mt-1">{value}</div>
    </div>
  )
}
