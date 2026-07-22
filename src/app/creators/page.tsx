'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { KpiCard } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SkeletonPage } from '@/components/ui/skeleton'
import { getCreatorList, getLeadCountsByCreator, Creator } from '@/lib/queries/creators'
import { formatDate, eur } from '@/lib/format'
import { Plus, Trash2, X } from 'lucide-react'

export default function CreatorsPage() {
  const router = useRouter()
  const [creators, setCreators] = useState<Creator[]>([])
  const [leadCounts, setLeadCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  // Nieuwe partner
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', company_name: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadData = useCallback(() => {
    return Promise.all([getCreatorList(), getLeadCountsByCreator()])
      .then(([creatorData, leads]) => {
        setCreators(creatorData)
        setLeadCounts(leads)
      })
  }, [])

  useEffect(() => { loadData().finally(() => setLoading(false)) }, [loadData])

  const handleCreate = async () => {
    if (!form.name.trim()) { setError('Naam is verplicht'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/creators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || 'Aanmaken mislukt'); return }
      setShowCreate(false)
      setForm({ name: '', email: '', company_name: '' })
      await loadData()
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Partner "${name}" verwijderen? Dit ontkoppelt ook eventuele attributie.`)) return
    const res = await fetch(`/api/creators?id=${id}`, { method: 'DELETE' })
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || 'Verwijderen mislukt'); return }
    await loadData()
  }

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
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Creators</h1>
          <p className="text-sm text-gray-500 mt-1">Overzicht van alle creators en hun prestaties</p>
        </div>
        <Button onClick={() => { setShowCreate(true); setError('') }}>
          <Plus className="w-4 h-4" strokeWidth={1.75} /> Nieuwe partner
        </Button>
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
                <th className="px-4 py-3"></th>
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
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(creator.id, creator.name) }}
                      title="Partner verwijderen"
                      className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                    >
                      <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                    </button>
                  </td>
                </tr>
              ))}
              {creators.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                    Geen creators gevonden
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Nieuwe partner modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">Nieuwe partner</h3>
              <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-md hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Naam *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Naam van de partner"
                  className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent-700" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">E-mail</label>
                <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="optioneel"
                  className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent-700" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Bedrijfsnaam</label>
                <input value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} placeholder="optioneel"
                  className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent-700" />
              </div>
              {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</div>}
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowCreate(false)} className="px-4 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Annuleren</button>
                <Button onClick={handleCreate} disabled={saving}>{saving ? 'Aanmaken...' : 'Partner aanmaken'}</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
