'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { SkeletonPage } from '@/components/ui/skeleton'
import { KpiStrip, KpiCell } from '@/components/ui/kpi-strip'
import { ScreenHeader, Panel } from '@/components/ui/industry-ui'
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
      <ScreenHeader
        eyebrow="MY WORKSPACE"
        title="My Dashboard"
        right={
          <Link href="/eod/creator" className="inline-flex items-center gap-2 px-4 h-9 bg-accent text-white font-heading font-semibold uppercase text-[11px] tracking-[0.05em] hover:bg-accent-800 transition">
            <ClipboardList className="w-4 h-4" strokeWidth={1.5} /> Submit EOD
          </Link>
        }
      />

      {noLink && (
        <div className="mb-6 font-body text-[12.5px] text-accent-800 bg-accent-100 border border-divider px-4 py-3">
          Je account is nog niet aan een creator-profiel gekoppeld. Vraag je partnermanager om de koppeling; daarna verschijnen je cijfers hier.
        </div>
      )}

      <div className="mb-6">
        <KpiStrip cols={4}>
          <KpiCell label="Leads" value={d?.leads ?? 0} caption="via jouw attributie" />
          <KpiCell label="Order Value" value={eur(d?.orderValue ?? 0)} caption={`${d?.accounts ?? 0} accounts`} />
          <KpiCell label="Cash Collected" value={eur(d?.cashCollected ?? 0)} />
          <KpiCell label="EOD Reports" value={d?.eod.reports ?? 0} caption="ingevuld" />
        </KpiStrip>
      </div>

      <Panel title="Content · From Your EOD" bodyClass="p-0">
        <div className="grid grid-cols-3 divide-x divide-divider">
          <Stat label="TikTok Posts" value={d?.eod.tiktokPosts ?? 0} />
          <Stat label="Instagram Posts" value={d?.eod.igPosts ?? 0} />
          <Stat label="Days With Story" value={d?.eod.storiesPosted ?? 0} />
        </div>
      </Panel>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="px-4 py-4">
      <div className="font-heading font-semibold uppercase text-[9.5px] tracking-[0.13em] text-ink/50">{label}</div>
      <div className="font-heading font-semibold text-[26px] text-ink tabular-nums mt-1 leading-none">{value}</div>
    </div>
  )
}
