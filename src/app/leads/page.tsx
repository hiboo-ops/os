'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { getAllLeads, getLeadStats, Lead, LEAD_STAGES } from '@/lib/queries/leads'
import { KpiCard } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { SlideOver } from '@/components/ui/slide-over'
import { SkeletonPage } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/format'
import {
  Search, Plus, Phone, Mail, X, Check, Clock, PhoneCall,
  PhoneOff, ArrowRight, User, ChevronRight, LayoutGrid, List,
} from 'lucide-react'

const iconProps = { strokeWidth: 1.75 } as const

const STAGE_CONFIG: { key: string; label: string; color: string; borderColor: string }[] = [
  { key: 'LEAD',      label: 'Lead',      color: 'bg-blue-50 text-blue-700',     borderColor: 'border-l-blue-400' },
  { key: 'ATTEMPT 1', label: 'Attempt 1', color: 'bg-amber-50 text-amber-700',   borderColor: 'border-l-amber-400' },
  { key: 'ATTEMPT 2', label: 'Attempt 2', color: 'bg-orange-50 text-orange-700', borderColor: 'border-l-orange-400' },
  { key: 'ATTEMPT 3', label: 'Attempt 3', color: 'bg-rose-50 text-rose-700',     borderColor: 'border-l-rose-400' },
  { key: 'ATTEMPT 4', label: 'Attempt 4', color: 'bg-red-50 text-red-700',       borderColor: 'border-l-red-400' },
  { key: 'TO SETTER', label: 'To Setter', color: 'bg-emerald-50 text-emerald-700', borderColor: 'border-l-emerald-500' },
]

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'zojuist'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}u`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d`
  const weeks = Math.floor(days / 7)
  return `${weeks}w`
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [allLeads, setAllLeads] = useState<Lead[]>([])
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getLeadStats>> | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [showArchive, setShowArchive] = useState(false)

  const loadData = useCallback(async () => {
    const [active, all, s] = await Promise.all([
      getAllLeads({ activeOnly: true, search: search || undefined }),
      getAllLeads({ search: search || undefined }),
      getLeadStats(),
    ])
    setLeads(active)
    setAllLeads(all)
    setStats(s)
    setLoading(false)
  }, [search])

  useEffect(() => { loadData() }, [loadData])

  const grouped = useMemo(() => {
    const map: Record<string, Lead[]> = {}
    for (const stage of STAGE_CONFIG) map[stage.key] = []
    for (const lead of leads) {
      if (map[lead.stage]) map[lead.stage].push(lead)
      else map['LEAD'].push(lead)
    }
    return map
  }, [leads])

  const archivedLeads = useMemo(() =>
    allLeads.filter(l => !LEAD_STAGES.includes(l.stage as typeof LEAD_STAGES[number])),
    [allLeads]
  )

  if (loading) return <SkeletonPage />

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Leads</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            <span className="tabular-nums">{stats?.active || 0}</span> actieve leads &middot;{' '}
            <span className="tabular-nums">{stats?.total || 0}</span> totaal
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setView('kanban')}
              className={`p-1.5 rounded-md transition-colors duration-[120ms] ${view === 'kanban' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
              <LayoutGrid className="w-4 h-4" {...iconProps} />
            </button>
            <button onClick={() => setView('list')}
              className={`p-1.5 rounded-md transition-colors duration-[120ms] ${view === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
              <List className="w-4 h-4" {...iconProps} />
            </button>
          </div>
          <Button variant="primary" size="md" onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4" {...iconProps} /> Lead toevoegen
          </Button>
        </div>
      </div>

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <KpiCard label="Actieve leads" value={stats.active} />
          <KpiCard label="Nieuw (ongebeld)" value={stats.lead} captionColor="warning" caption={stats.lead > 0 ? 'wacht op bel-actie' : undefined} />
          <KpiCard label="In pogingen" value={stats.attempt1 + stats.attempt2 + stats.attempt3 + stats.attempt4} />
          <KpiCard label="To Setter" value={stats.toSetter} captionColor="success" />
          <KpiCard label="Gem. time-to-call" value={stats.avgTimeToCall != null ? `${stats.avgTimeToCall}m` : '—'} caption="minuten" />
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" {...iconProps} />
          <input type="text" placeholder="Zoek op naam, email of telefoon..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 h-9 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-accent-500 transition-shadow duration-[120ms]" />
        </div>
        <button onClick={() => setShowArchive(!showArchive)}
          className={`h-9 px-3 text-sm rounded-lg border transition-colors duration-[120ms] ${showArchive ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
          Archief ({archivedLeads.length})
        </button>
      </div>

      {/* Kanban view */}
      {view === 'kanban' && !showArchive && (
        <div className="overflow-x-auto -mx-6 px-6 pb-4">
          <div className="flex gap-3" style={{ minWidth: STAGE_CONFIG.length * 280 }}>
            {STAGE_CONFIG.map(stage => {
              const stageLeads = grouped[stage.key] || []
              return (
                <div key={stage.key} className="w-[280px] flex-shrink-0">
                  {/* Column header */}
                  <div className="mb-3 flex items-center justify-between">
                    <span className={`inline-flex items-center text-xs font-medium rounded-md px-2 py-1 ${stage.color}`}>
                      {stage.label}
                    </span>
                    <span className="text-xs text-gray-400 tabular-nums">{stageLeads.length}</span>
                  </div>

                  {/* Cards */}
                  <div className="space-y-2 min-h-[200px]">
                    {stageLeads.map(lead => (
                      <LeadCard key={lead.id} lead={lead} stage={stage}
                        onClick={() => setSelectedLead(lead)} onUpdate={loadData} />
                    ))}
                    {stageLeads.length === 0 && (
                      <div className="rounded-lg border border-dashed border-gray-200 p-4 text-center">
                        <span className="text-xs text-gray-400">Geen leads</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* List view */}
      {(view === 'list' || showArchive) && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100">
                  <th className="px-5 py-3">Naam</th>
                  <th className="px-4 py-3">Telefoon</th>
                  <th className="px-4 py-3">Bron</th>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3">Pogingen</th>
                  <th className="px-4 py-3">Ontvangen</th>
                  <th className="px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(showArchive ? archivedLeads : leads).map(lead => (
                  <tr key={lead.id} onClick={() => setSelectedLead(lead)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors duration-[120ms]">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={lead.name} size="sm" />
                        <div>
                          <div className="font-medium text-gray-900">{lead.name}</div>
                          {lead.email && <div className="text-[11px] text-gray-400">{lead.email}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {lead.phone ? (
                        <a href={`tel:${lead.phone}`} onClick={e => e.stopPropagation()}
                          className="text-gray-700 hover:text-blue-600 flex items-center gap-1">
                          <Phone className="w-3 h-3" {...iconProps} /> {lead.phone}
                        </a>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3"><Badge status={lead.source || 'OTHER'} /></td>
                    <td className="px-4 py-3"><Badge status={lead.stage} /></td>
                    <td className="px-4 py-3 tabular-nums text-gray-500">{lead.attempt_count || 0}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(lead.date_received)}</td>
                    <td className="px-4 py-3"><ChevronRight className="w-4 h-4 text-gray-300" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(showArchive ? archivedLeads : leads).length === 0 && (
            <div className="py-16 text-center text-sm text-gray-400">Geen leads gevonden</div>
          )}
        </div>
      )}

      {/* Lead Detail Slide-out */}
      {selectedLead && (
        <LeadDetail lead={selectedLead} onClose={() => setSelectedLead(null)} onUpdate={loadData} />
      )}

      {/* Add Lead Modal */}
      {showAddModal && (
        <AddLeadModal onClose={() => setShowAddModal(false)} onCreated={loadData} />
      )}
    </div>
  )
}

/* ── Lead Card (Kanban) ── */
function LeadCard({ lead, stage, onClick, onUpdate }: {
  lead: Lead; stage: { borderColor: string }; onClick: () => void; onUpdate: () => void
}) {
  const [calling, setCalling] = useState(false)

  const handleCall = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!lead.phone) return

    // Open phone dialer
    window.open(`tel:${lead.phone}`, '_self')

    // Register attempt
    setCalling(true)
    const now = new Date().toISOString()
    const newAttempt = (lead.attempt_count || 0) + 1
    const nextStage = newAttempt <= 4 ? `ATTEMPT ${newAttempt}` : lead.stage

    const updates: Record<string, unknown> = {
      id: lead.id,
      attempt_count: newAttempt,
      last_attempt_at: now,
      last_contact: now.split('T')[0],
      contact_count: (lead.contact_count || 0) + 1,
    }

    // Set first_called_at and time_to_call on first call
    if (!lead.first_called_at) {
      updates.first_called_at = now
      if (lead.date_received) {
        const diffMs = new Date(now).getTime() - new Date(lead.date_received).getTime()
        updates.time_to_call_minutes = Math.round(diffMs / 60000)
      }
    }

    // Move to next attempt stage if currently LEAD or lower attempt
    if (lead.stage === 'LEAD' || (lead.stage.startsWith('ATTEMPT') && newAttempt <= 4)) {
      updates.stage = nextStage
    }

    await fetch('/api/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    setCalling(false)
    onUpdate()
  }

  const moveToSetter = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await fetch('/api/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: lead.id, stage: 'TO SETTER' }),
    })
    onUpdate()
  }

  return (
    <div onClick={onClick}
      className={`bg-white rounded-lg border border-gray-200 ${stage.borderColor} border-l-[3px] p-3.5 cursor-pointer hover:border-gray-300 transition-colors duration-[120ms]`}>
      {/* Name */}
      <div className="font-medium text-sm text-gray-900 truncate">{lead.name}</div>

      {/* Time since received */}
      <div className="flex items-center gap-1.5 mt-1 text-[11px] text-gray-400">
        <Clock className="w-3 h-3" {...iconProps} />
        <span>{timeAgo(lead.date_received)} geleden</span>
        {lead.attempt_count > 0 && (
          <span className="ml-auto tabular-nums">{lead.attempt_count}x gebeld</span>
        )}
      </div>

      {/* Phone + call button */}
      <div className="flex items-center gap-2 mt-2.5">
        {lead.phone ? (
          <>
            <span className="text-xs text-gray-500 truncate flex-1">{lead.phone}</span>
            <button onClick={handleCall} disabled={calling}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors duration-[120ms]">
              <PhoneCall className="w-3 h-3" {...iconProps} />
              Bel
            </button>
          </>
        ) : (
          <span className="text-xs text-gray-400">Geen telefoon</span>
        )}
      </div>

      {/* Source badge */}
      {lead.source && (
        <div className="mt-2">
          <span className="inline-flex text-[10px] font-medium bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">
            {lead.source}
          </span>
        </div>
      )}

      {/* Quick action: to setter */}
      {lead.stage !== 'TO SETTER' && (
        <button onClick={moveToSetter}
          className="mt-2 flex items-center gap-1 text-[11px] text-emerald-600 hover:text-emerald-700 font-medium transition-colors duration-[120ms]">
          <ArrowRight className="w-3 h-3" {...iconProps} /> To Setter
        </button>
      )}
    </div>
  )
}

/* ── Lead Detail Slide-out ── */
function LeadDetail({ lead, onClose, onUpdate }: { lead: Lead; onClose: () => void; onUpdate: () => void }) {
  const [form, setForm] = useState({
    stage: lead.stage || 'LEAD',
    triage_notes: lead.triage_notes || '',
    notes: lead.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const save = async () => {
    setSaving(true)
    await fetch('/api/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: lead.id,
        stage: form.stage,
        triage_notes: form.triage_notes || null,
        notes: form.notes || null,
      }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    onUpdate()
  }

  const registerAttempt = async () => {
    if (!lead.phone) { alert('Geen telefoonnummer beschikbaar'); return }
    window.open(`tel:${lead.phone}`, '_self')

    const now = new Date().toISOString()
    const newAttempt = (lead.attempt_count || 0) + 1
    const updates: Record<string, unknown> = {
      id: lead.id,
      attempt_count: newAttempt,
      last_attempt_at: now,
      last_contact: now.split('T')[0],
      contact_count: (lead.contact_count || 0) + 1,
    }
    if (!lead.first_called_at) {
      updates.first_called_at = now
      if (lead.date_received) {
        updates.time_to_call_minutes = Math.round((new Date(now).getTime() - new Date(lead.date_received).getTime()) / 60000)
      }
    }
    if (lead.stage === 'LEAD' || lead.stage.startsWith('ATTEMPT')) {
      updates.stage = newAttempt <= 4 ? `ATTEMPT ${newAttempt}` : lead.stage
    }
    await fetch('/api/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    onUpdate()
  }

  return (
    <SlideOver open onClose={onClose} title={lead.name}>
      <div className="flex-1 overflow-y-auto">
        {/* Header badges */}
        <div className="px-6 pt-2 pb-4 flex items-center gap-2">
          <Badge status={lead.stage} />
          <Badge status={lead.source || 'OTHER'} />
          {lead.attempt_count > 0 && (
            <span className="text-[11px] text-gray-400 tabular-nums">{lead.attempt_count}x gebeld</span>
          )}
        </div>

        {/* Call action */}
        <div className="px-6 py-4 bg-blue-50 border-y border-blue-100">
          <div className="flex items-center gap-3">
            {lead.phone ? (
              <>
                <a href={`tel:${lead.phone}`} className="flex-1 flex items-center gap-2 text-blue-700 font-medium text-sm hover:text-blue-800">
                  <PhoneCall className="w-4 h-4" {...iconProps} />
                  {lead.phone}
                </a>
                <Button variant="primary" size="sm" onClick={registerAttempt}>
                  <PhoneCall className="w-3.5 h-3.5" {...iconProps} /> Bel & registreer
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <PhoneOff className="w-4 h-4" {...iconProps} /> Geen telefoonnummer
              </div>
            )}
          </div>
          {lead.time_to_call_minutes != null && (
            <div className="mt-2 text-[11px] text-blue-600">
              Time-to-call: <span className="tabular-nums font-medium">{lead.time_to_call_minutes}m</span>
            </div>
          )}
        </div>

        {/* Contact info */}
        <div className="px-6 py-5 border-b border-gray-100">
          <h3 className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-3">Contact</h3>
          <div className="space-y-2 text-sm">
            {lead.email && (
              <div className="flex items-center gap-2 text-gray-700">
                <Mail className="w-3.5 h-3.5 text-gray-400" {...iconProps} /> {lead.email}
              </div>
            )}
            {lead.ad_campaign && <div className="text-gray-500">Campagne: {lead.ad_campaign}</div>}
            {lead.creator_name && <div className="text-gray-500">Creator: {lead.creator_name}</div>}
            <div className="text-gray-500">Ontvangen: {formatDate(lead.date_received)}</div>
            {lead.first_called_at && <div className="text-gray-500">Eerste bel: {formatDate(lead.first_called_at)}</div>}
            {lead.last_attempt_at && <div className="text-gray-500">Laatste poging: {formatDate(lead.last_attempt_at)}</div>}
          </div>
        </div>

        {/* Quiz answers */}
        {lead.quiz_answers && lead.quiz_answers.length > 0 && (
          <div className="px-6 py-5 border-b border-gray-100">
            <h3 className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-3">Quiz antwoorden</h3>
            <div className="space-y-2">
              {lead.quiz_answers.map((qa, i) => (
                <div key={i} className="bg-gray-50 rounded-md px-3 py-2.5">
                  <div className="text-[11px] text-gray-500 mb-0.5">{qa.question}</div>
                  <div className="text-sm text-gray-900">{qa.answer}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stage & notes */}
        <div className="px-6 py-5 border-b border-gray-100">
          <h3 className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-3">Triage</h3>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Stage</label>
              <select value={form.stage} onChange={e => setForm({ ...form, stage: e.target.value })}
                className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700">
                {[...LEAD_STAGES, 'NOT QUALIFIED'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Triage notities</label>
              <textarea value={form.triage_notes} onChange={e => setForm({ ...form, triage_notes: e.target.value })}
                rows={3} placeholder="Notities van het gesprek..."
                className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-accent-700" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Notities</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                rows={2} placeholder="Algemene notities..."
                className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-accent-700" />
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-gray-100 px-6 py-4 flex gap-3">
        <Button variant="primary" size="md" onClick={save} disabled={saving} className="flex-1">
          {saving ? 'Opslaan...' : saved ? <><Check className="w-4 h-4" {...iconProps} /> Opgeslagen</> : 'Opslaan'}
        </Button>
      </div>
    </SlideOver>
  )
}

/* ── Add Lead Modal ── */
function AddLeadModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', source: 'ATHENA' })
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    if (!form.name) { alert('Naam is verplicht'); return }
    setCreating(true)
    await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        email: form.email || null,
        phone: form.phone || null,
        source: form.source,
        stage: 'LEAD',
        date_received: new Date().toISOString(),
      }),
    })
    setCreating(false)
    onCreated()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" />
      <div className="relative bg-white rounded-lg border border-gray-200 w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-semibold text-gray-900">Lead toevoegen</h2>
          <button onClick={onClose} className="p-1 rounded-md text-gray-400 hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Naam *</label>
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Naam" className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Email</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="email@..." className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Telefoon</label>
              <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="+31 6..." className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Bron</label>
            <select value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}
              className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700">
              <option value="ATHENA">Athena</option>
              <option value="QUIZ">Quiz</option>
              <option value="HIBOO ADS">Hiboo Ads</option>
              <option value="CREATOR">Creator</option>
              <option value="INSTAGRAM DM">Instagram DM</option>
              <option value="REFERRAL">Referral</option>
            </select>
          </div>
        </div>
        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
          <Button variant="secondary" size="md" onClick={onClose} className="flex-1">Annuleren</Button>
          <Button variant="primary" size="md" onClick={handleCreate} disabled={creating} className="flex-1">
            {creating ? 'Toevoegen...' : 'Lead toevoegen'}
          </Button>
        </div>
      </div>
    </div>
  )
}
