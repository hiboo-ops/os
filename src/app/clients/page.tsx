'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getClientList } from '@/lib/queries/clients'
import { KpiCard } from '@/components/kpi-card'
import { StatusBadge } from '@/components/status-badge'
import { formatDate } from '@/lib/format'
import { Search, ArrowUpDown } from 'lucide-react'

export default function ClientsPage() {
  const router = useRouter()
  const [clients, setClients] = useState<Awaited<ReturnType<typeof getClientList>>>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    getClientList().then(data => { setClients(data); setLoading(false) })
  }, [])

  const filtered = clients.filter(c => {
    if (statusFilter && c.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q)
    }
    return true
  })

  const statuses = [...new Set(clients.map(c => c.status))].sort()

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-slate-400">Laden...</div></div>

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900 mb-6">Clients</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="TOTAL CLIENTS" value={clients.length} />
        <KpiCard label="ACTIVE" value={clients.filter(c => c.status === 'ACTIVE').length} captionColor="green" />
        <KpiCard label="CHURNED" value={clients.filter(c => c.status === 'CHURNED').length} captionColor="red" />
        <KpiCard label="PAUSED" value={clients.filter(c => c.status === 'PAUSED').length} />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Zoek op naam of email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white"
        >
          <option value="">Alle statussen</option>
          {statuses.map(s => <option key={s} value={s}>{s} ({clients.filter(c => c.status === s).length})</option>)}
        </select>
        <span className="text-xs text-slate-400">{filtered.length} resultaten</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-slate-100">
                <th className="px-6 py-3">Naam</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Programma</th>
                <th className="px-4 py-3">Startdatum</th>
                <th className="px-4 py-3">Upsell</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map(c => (
                <tr
                  key={c.id}
                  onClick={() => router.push(`/clients/${c.id}`)}
                  className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition"
                >
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                        {c.name?.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <span className="font-medium text-slate-900">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{c.email}</td>
                  <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-3 text-slate-600">{c.program || '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(c.start_date)}</td>
                  <td className="px-4 py-3">{c.upsell_status && c.upsell_status !== 'N/A' ? <StatusBadge status={c.upsell_status} /> : <span className="text-slate-300">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 100 && (
          <div className="px-6 py-3 border-t border-slate-100 text-xs text-slate-400 text-center">
            Toont 100 van {filtered.length} resultaten
          </div>
        )}
      </div>
    </div>
  )
}
