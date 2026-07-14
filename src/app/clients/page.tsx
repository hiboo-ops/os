'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getClientList } from '@/lib/queries/clients'
import { KpiCard } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { SkeletonPage } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/format'
import { Search } from 'lucide-react'

export default function ClientsPage() {
  const router = useRouter()
  const [clients, setClients] = useState<Awaited<ReturnType<typeof getClientList>>>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    getClientList().then(data => { setClients(data); setLoading(false) })
  }, [])

  if (loading) return <SkeletonPage />

  const filtered = clients.filter(c => {
    if (statusFilter && c.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q)
    }
    return true
  })

  const statuses = [...new Set(clients.map(c => c.status))].sort()

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-gray-900">Clients</h1>
        <p className="text-sm text-gray-500 mt-1">{clients.length} klanten in het systeem</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard label="Totaal" value={clients.length} />
        <KpiCard label="Actief" value={clients.filter(c => c.status === 'ACTIVE').length} captionColor="success" />
        <KpiCard label="Churned" value={clients.filter(c => c.status === 'CHURNED').length} captionColor="danger" />
        <KpiCard label="Paused" value={clients.filter(c => c.status === 'PAUSED').length} />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" strokeWidth={1.75} />
          <input
            type="text"
            placeholder="Zoek op naam of email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 h-9 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent transition-shadow duration-[120ms]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="h-9 text-sm border border-gray-200 rounded-lg px-3 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-accent-500"
        >
          <option value="">Alle statussen</option>
          {statuses.map(s => <option key={s} value={s}>{s} ({clients.filter(c => c.status === s).length})</option>)}
        </select>
        <span className="text-xs text-gray-400 tabular-nums">{filtered.length} resultaten</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100">
                <th className="px-5 py-3">Naam</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Programma</th>
                <th className="px-4 py-3">Startdatum</th>
                <th className="px-4 py-3">Upsell</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.slice(0, 100).map(c => (
                <tr
                  key={c.id}
                  onClick={() => router.push(`/clients/${c.id}`)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors duration-[120ms]"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={c.name || '?'} size="sm" />
                      <span className="font-medium text-gray-900">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{c.email}</td>
                  <td className="px-4 py-3"><Badge status={c.status} /></td>
                  <td className="px-4 py-3 text-gray-600">{c.program || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(c.start_date)}</td>
                  <td className="px-4 py-3">{c.upsell_status && c.upsell_status !== 'N/A' ? <Badge status={c.upsell_status} /> : <span className="text-gray-300">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 100 && (
          <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400 text-center tabular-nums">
            Toont 100 van {filtered.length} resultaten
          </div>
        )}
      </div>
    </div>
  )
}
