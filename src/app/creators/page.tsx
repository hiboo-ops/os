'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { KpiCard } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SkeletonPage } from '@/components/ui/skeleton'
import { getCreatorList, getLeadCountsByCreator, Creator } from '@/lib/queries/creators'
import { formatDate, eur } from '@/lib/format'
import { Users, TrendingUp, CreditCard, Target } from 'lucide-react'

export default function CreatorsPage() {
  const router = useRouter()
  const [creators, setCreators] = useState<Creator[]>([])
  const [leadCounts, setLeadCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getCreatorList(), getLeadCountsByCreator()])
      .then(([creatorData, leads]) => {
        setCreators(creatorData)
        setLeadCounts(leads)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <SkeletonPage />

  const active = creators.filter(c => c.status === 'ACTIVE')
  const cacValues = creators.map(c => c.cac).filter((v): v is number => v != null)
  const avgCac = cacValues.length > 0 ? Math.round(cacValues.reduce((a, b) => a + b, 0) / cacValues.length) : 0
  const totalSetupFees = creators.reduce((sum, c) => sum + (c.setup_fee || 0), 0)
  const totalLeads = Object.values(leadCounts).reduce((a, b) => a + b, 0)

  const formatSocials = (socials: Creator['socials']) => {
    if (!socials || Object.keys(socials).length === 0) return '—'
    return Object.entries(socials)
      .filter(([, s]) => s?.handle)
      .map(([platform, s]) => `${platform}: ${s.handle}`)
      .join(', ') || '—'
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Creators</h1>
        <p className="text-sm text-gray-500 mt-1">Overzicht van alle creators en hun prestaties</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Actieve creators" value={active.length} caption={`${creators.length} totaal`} />
        <KpiCard label="Gem. CAC" value={eur(avgCac)} caption={`${cacValues.length} met CAC`} />
        <KpiCard label="Totaal setup fees" value={eur(totalSetupFees)} />
        <KpiCard label="Totaal leads" value={totalLeads} caption="via alle creators" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Alle creators ({creators.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100">
                <th className="px-6 py-3">Naam</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Socials</th>
                <th className="px-4 py-3 text-right">CAC</th>
                <th className="px-4 py-3 text-right">Setup fee</th>
                <th className="px-4 py-3 text-right">Leads</th>
                <th className="px-4 py-3">Startdatum</th>
              </tr>
            </thead>
            <tbody>
              {creators.map(creator => (
                <tr key={creator.id} onClick={() => router.push(`/creators/${creator.id}`)} className="border-b border-gray-50 hover:bg-gray-50 transition cursor-pointer">
                  <td className="px-6 py-3">
                    <div>
                      <div className="font-medium text-gray-900">{creator.name}</div>
                      {creator.email && (
                        <div className="text-xs text-gray-400">{creator.email}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge status={creator.status || 'ACTIVE'} />
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs max-w-[200px] truncate">
                    {formatSocials(creator.socials)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 tabular-nums">
                    {eur(creator.cac)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 tabular-nums">
                    {eur(creator.setup_fee)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 tabular-nums">
                    {leadCounts[creator.id] || 0}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {formatDate(creator.start_date)}
                  </td>
                </tr>
              ))}
              {creators.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    Geen creators gevonden
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
