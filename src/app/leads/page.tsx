'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getAllLeads, getLeadStats, Lead } from '@/lib/queries/leads'
import { KpiCard } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { SkeletonPage } from '@/components/ui/skeleton'
import { formatDate, eur } from '@/lib/format'
import { Search, Plus, Phone, Mail, ChevronRight, CalendarPlus, MessageCircle, X, Check, ExternalLink } from 'lucide-react'

const iconProps = { strokeWidth: 1.75 } as const

const STAGES = ['NEW', 'TRIAGE', 'CALL BOOKED', 'QUALIFIED', 'NOT QUALIFIED', 'NO ANSWER'] as const
const SOURCES = ['QUIZ', 'HIBOO ADS', 'CREATOR', 'INSTAGRAM DM', 'REFERRAL', 'OTHER'] as const

const stageColors: Record<string, string> = {
  NEW: 'text-gray-700', TRIAGE: 'text-amber-600', 'CALL BOOKED': 'text-blue-600',
  QUALIFIED: 'text-emerald-600', 'NOT QUALIFIED': 'text-red-600', 'NO ANSWER': 'text-gray-400',
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getLeadStats>> | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [l, s] = await Promise.all([
      getAllLeads({ source: sourceFilter || undefined, stage: stageFilter || undefined, search: search || undefined }),
      getLeadStats(),
    ])
    setLeads(l)
    setStats(s)
    setLoading(false)
  }, [sourceFilter, stageFilter, search])

  useEffect(() => { loadData() }, [loadData])

  if (loading && !stats) return <SkeletonPage />

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Leads</h1>
          <p className="text-sm text-gray-500 mt-1">Triage en follow-up van inkomende leads</p>
        </div>
        <Button variant="primary" size="md" onClick={() => setShowAddModal(true)}>
          <Plus className="w-4 h-4" {...iconProps} /> Lead toevoegen
        </Button>
      </div>

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <KpiCard label="Totaal" value={stats.total} />
          <KpiCard label="Nieuw" value={stats.new} caption="wacht op triage" />
          <KpiCard label="Call geboekt" value={stats.callBooked} captionColor="success" />
          <KpiCard label="Gekwalificeerd" value={stats.qualified} captionColor="success" />
          <KpiCard label="Geen gehoor" value={stats.noAnswer} captionColor="warning" />
        </div>
      )}

      {/* Source breakdown */}
      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
            <div><div className="text-sm font-semibold text-gray-900 tabular-nums">{stats.fromQuiz}</div><div className="text-[11px] text-gray-500">Quiz</div></div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-violet-400" />
            <div><div className="text-sm font-semibold text-gray-900 tabular-nums">{stats.fromAds}</div><div className="text-[11px] text-gray-500">Hiboo Ads</div></div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-pink-400" />
            <div><div className="text-sm font-semibold text-gray-900 tabular-nums">{stats.fromCreator}</div><div className="text-[11px] text-gray-500">Creator</div></div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" {...iconProps} />
          <input type="text" placeholder="Zoek op naam, email of telefoon..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 h-9 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-accent-500 transition-shadow duration-[120ms]" />
        </div>
        <select value={stageFilter} onChange={e => setStageFilter(e.target.value)}
          className="h-9 text-sm border border-gray-200 rounded-lg px-3 bg-white text-gray-700">
          <option value="">Alle stages</option>
          {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}
          className="h-9 text-sm border border-gray-200 rounded-lg px-3 bg-white text-gray-700">
          <option value="">Alle bronnen</option>
          {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="text-xs text-gray-400 tabular-nums">{leads.length} leads</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100">
                <th className="px-5 py-3">Naam</th>
                <th className="px-4 py-3">Telefoon</th>
                <th className="px-4 py-3">Bron</th>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3">Creator</th>
                <th className="px-4 py-3">Datum</th>
                <th className="px-4 py-3">Laatste contact</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {leads.map(lead => (
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
                  <td className="px-4 py-3 text-gray-500">{lead.phone || '—'}</td>
                  <td className="px-4 py-3"><Badge status={lead.source || 'OTHER'} /></td>
                  <td className="px-4 py-3"><Badge status={lead.stage || 'NEW'} /></td>
                  <td className="px-4 py-3 text-gray-500">{lead.creator?.name || lead.creator_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(lead.date_received)}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(lead.last_contact)}</td>
                  <td className="px-4 py-3"><ChevronRight className="w-4 h-4 text-gray-300" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {leads.length === 0 && (
          <div className="py-16 text-center text-sm text-gray-400">Geen leads gevonden</div>
        )}
      </div>

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

function LeadDetail({ lead, onClose, onUpdate }: { lead: Lead; onClose: () => void; onUpdate: () => void }) {
  const [form, setForm] = useState({
    stage: lead.stage || 'NEW',
    triage_notes: lead.triage_notes || '',
    notes: lead.notes || '',
    last_contact: lead.last_contact || '',
    scheduled_call_date: lead.scheduled_call_date || '',
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
        last_contact: form.last_contact || null,
        scheduled_call_date: form.scheduled_call_date || null,
        contact_count: (lead.contact_count || 0) + (form.last_contact && form.last_contact !== lead.last_contact ? 1 : 0),
      }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    onUpdate()
  }

  const planCall = async () => {
    if (!form.scheduled_call_date) {
      alert('Kies eerst een datum/tijd voor de call')
      return
    }
    // Create a call record from this lead
    const res = await fetch('/api/calls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        date_start_time: form.scheduled_call_date,
        source: lead.source || 'QUIZ',
        source_type: lead.creator_name || lead.ad_campaign || '',
        result: 'NEW',
        questions: lead.quiz_answers,
      }),
    })
    if (res.ok) {
      const call = await res.json()
      // Update lead with call reference
      await fetch('/api/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lead.id, stage: 'CALL BOOKED', call_id: call.id }),
      })
      onUpdate()
      alert('Call ingepland! Zichtbaar in /sales/pipeline')
    }
  }

  const markContact = () => {
    setForm({ ...form, last_contact: new Date().toISOString().split('T')[0] })
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white border-l border-gray-200 flex flex-col">
        {/* Header */}
        <div className="shrink-0 border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar name={lead.name} size="md" />
            <div>
              <h2 className="text-base font-semibold text-gray-900">{lead.name}</h2>
              <div className="flex items-center gap-2">
                <Badge status={lead.stage || 'NEW'} />
                <Badge status={lead.source || 'OTHER'} />
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors duration-[120ms]">
            <X className="w-5 h-5" {...iconProps} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Contact */}
          <div className="px-6 py-5 border-b border-gray-100">
            <h3 className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-3">Contact</h3>
            <div className="space-y-2 text-sm">
              {lead.email && (
                <div className="flex items-center gap-2 text-gray-700">
                  <Mail className="w-3.5 h-3.5 text-gray-400" {...iconProps} /> {lead.email}
                </div>
              )}
              {lead.phone && (
                <div className="flex items-center gap-2 text-gray-700">
                  <Phone className="w-3.5 h-3.5 text-gray-400" {...iconProps} /> {lead.phone}
                </div>
              )}
              {lead.creator_name && <div className="text-gray-500">Creator: {lead.creator_name}</div>}
              {lead.ad_campaign && <div className="text-gray-500">Campagne: {lead.ad_campaign}</div>}
              <div className="text-gray-500">Ontvangen: {formatDate(lead.date_received)}</div>
              <div className="text-gray-500">Contacten: <span className="tabular-nums">{lead.contact_count || 0}</span></div>
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

          {/* Triage */}
          <div className="px-6 py-5 border-b border-gray-100">
            <h3 className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-3">Triage</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Stage</label>
                <select value={form.stage} onChange={e => setForm({ ...form, stage: e.target.value })}
                  className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700">
                  {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Triage notities</label>
                <textarea value={form.triage_notes} onChange={e => setForm({ ...form, triage_notes: e.target.value })}
                  rows={3} placeholder="Notities van het triage gesprek..."
                  className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-accent-700" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Laatste contact</label>
                <div className="mt-1.5 flex gap-2">
                  <input type="date" value={form.last_contact} onChange={e => setForm({ ...form, last_contact: e.target.value })}
                    className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700" />
                  <Button variant="primary" size="sm" onClick={markContact}>Vandaag</Button>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Notities</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                  rows={2} placeholder="Algemene notities..."
                  className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-accent-700" />
              </div>
            </div>
          </div>

          {/* Plan call */}
          <div className="px-6 py-5 border-b border-gray-100">
            <h3 className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-3">Closing call plannen</h3>
            {lead.call_id ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" {...iconProps} />
                <span className="text-sm text-emerald-700 font-medium">Call is ingepland</span>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Datum & tijd</label>
                  <input type="datetime-local" value={form.scheduled_call_date}
                    onChange={e => setForm({ ...form, scheduled_call_date: e.target.value })}
                    className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700" />
                </div>
                <Button variant="primary" size="md" onClick={planCall} className="w-full">
                  <CalendarPlus className="w-4 h-4" {...iconProps} /> Call inplannen
                </Button>
                <p className="text-[11px] text-gray-400">Maakt een call record aan in Sales Pipeline met de lead data.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-gray-100 px-6 py-4 flex gap-3">
          <Button variant="primary" size="md" onClick={save} disabled={saving} className="flex-1">
            {saving ? 'Opslaan...' : saved ? <><Check className="w-4 h-4" {...iconProps} /> Opgeslagen</> : 'Opslaan'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function AddLeadModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: '', email: '', phone: '', source: 'QUIZ', creator_name: '', ad_campaign: '',
  })
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
        creator_name: form.creator_name || null,
        ad_campaign: form.ad_campaign || null,
        stage: 'NEW',
        date_received: new Date().toISOString().split('T')[0],
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
              {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {form.source === 'CREATOR' && (
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Creator naam</label>
              <input type="text" value={form.creator_name} onChange={e => setForm({ ...form, creator_name: e.target.value })}
                placeholder="Creator naam" className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700" />
            </div>
          )}
          {form.source === 'HIBOO ADS' && (
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Campagne</label>
              <input type="text" value={form.ad_campaign} onChange={e => setForm({ ...form, ad_campaign: e.target.value })}
                placeholder="Campagne naam" className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700" />
            </div>
          )}
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
