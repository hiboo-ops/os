'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { getAllLeads, getLeadStats, Lead, LEAD_STAGES } from '@/lib/queries/leads'
import { getSLAStatus } from '@/lib/queries/lead-analytics'
import { KpiCard } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { SlideOver } from '@/components/ui/slide-over'
import { SkeletonPage } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/format'
import {
  Search, Plus, Phone, Mail, X, Check, Clock, PhoneCall,
  PhoneOff, ChevronRight, LayoutGrid, List, ClipboardList,
  AlertTriangle, CheckCircle2, PhoneMissed, Calendar, Link2, Copy,
  Play, FileText,
} from 'lucide-react'
import { DialerProvider, CallButton, DialerSettings, DialableLead } from '@/components/dialer'
import { getTriageCallsForLead, TriageCall } from '@/lib/queries/triage-calls'

const iconProps = { strokeWidth: 1.75 } as const
const SLA_MINUTES = 5
const KANBAN_MAX_PER_COL = 50

interface CalendlyEvent {
  id: string
  name: string
  url: string
  description: string | null
  default_closer_id: string | null
  closer: { id: string; name: string } | null
}

// Mono steel — tone steps down per stage (Industry design language)
const STAGE_CONFIG: { key: string; label: string; color: string; borderColor: string }[] = [
  { key: 'LEAD',                label: 'LEAD',                color: 'bg-accent-100 text-accent-800',  borderColor: 'border-l-accent-800' },
  { key: 'FOLLOW UP',           label: 'FOLLOW UP',           color: 'bg-accent-100 text-accent-700',  borderColor: 'border-l-accent-700' },
  { key: 'ATTEMPT 1',           label: 'ATTEMPT 1',           color: 'bg-accent-100 text-accent-600',  borderColor: 'border-l-accent-600' },
  { key: 'ATTEMPT 2',           label: 'ATTEMPT 2',           color: 'bg-accent-100 text-accent-600',  borderColor: 'border-l-accent-500' },
  { key: 'ATTEMPT 3',           label: 'ATTEMPT 3',           color: 'bg-accent-100 text-accent-500',  borderColor: 'border-l-accent-400' },
  { key: 'ATTEMPT 4',           label: 'ATTEMPT 4',           color: 'bg-accent-100 text-accent-500',  borderColor: 'border-l-accent-300' },
  { key: 'CLOSING CALL BOOKED', label: 'CLOSING CALL BOOKED', color: 'bg-accent-100 text-accent-800',  borderColor: 'border-l-accent-800' },
  { key: 'CLOSED',              label: 'CLOSED',              color: 'bg-accent-100 text-accent-900',  borderColor: 'border-l-accent-900' },
  { key: 'LOST - NO INTEREST',  label: 'LOST - NO INTEREST',  color: 'bg-neutral-100 text-ink/40',     borderColor: 'border-l-neutral-300' },
  { key: 'LOST - BROKE',        label: 'LOST - BROKE',        color: 'bg-neutral-100 text-ink/40',     borderColor: 'border-l-neutral-300' },
]

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d`
  const weeks = Math.floor(days / 7)
  return `${weeks}w`
}

function getSLAMinutes(dateReceived: string | null): number | null {
  if (!dateReceived) return null
  return Math.floor((Date.now() - new Date(dateReceived).getTime()) / 60000)
}

function isRecentLead(dateReceived: string | null): boolean {
  if (!dateReceived) return false
  return (Date.now() - new Date(dateReceived).getTime()) < ONE_WEEK_MS
}

function getFirstQuizAnswer(lead: Lead): string | null {
  if (!lead.quiz_answers || lead.quiz_answers.length === 0) return null
  return lead.quiz_answers[0].answer
}

function buildCalendlyUrl(baseUrl: string, lead: Lead): string {
  const params = new URLSearchParams()
  if (lead.name) params.set('name', lead.name)
  if (lead.email) params.set('email', lead.email)
  if (lead.source) params.set('utm_source', lead.source)
  if (lead.creator_name) params.set('utm_campaign', lead.creator_name)
  if (lead.ad_campaign) params.set('utm_content', lead.ad_campaign)
  const sep = baseUrl.includes('?') ? '&' : '?'
  return `${baseUrl}${sep}${params.toString()}`
}

type ViewMode = 'queue' | 'kanban' | 'list'

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [allLeads, setAllLeads] = useState<Lead[]>([])
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getLeadStats>> | null>(null)
  const [slaStatus, setSlaStatus] = useState<Awaited<ReturnType<typeof getSLAStatus>> | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [view, setView] = useState<ViewMode>('kanban')
  const [showArchive, setShowArchive] = useState(false)
  const [callAction, setCallAction] = useState<Lead | null>(null)
  const [stageFilter, setStageFilter] = useState('')
  const [dragLeadId, setDragLeadId] = useState<string | null>(null)
  const [dragOverStage, setDragOverStage] = useState<string | null>(null)
  const refreshRef = useRef<NodeJS.Timeout | null>(null)

  const loadData = useCallback(async () => {
    const [active, all, s, sla] = await Promise.all([
      getAllLeads({ activeOnly: true, search: search || undefined }),
      getAllLeads({ search: search || undefined }),
      getLeadStats(),
      getSLAStatus(),
    ])
    setLeads(active)
    setAllLeads(all)
    setStats(s)
    setSlaStatus(sla)
    setLoading(false)
  }, [search])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') loadData() }
    document.addEventListener('visibilitychange', refresh)
    refreshRef.current = setInterval(refresh, 30000)
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      if (refreshRef.current) clearInterval(refreshRef.current)
    }
  }, [loadData])

  // Queue: leads sorted by priority (LEAD first sorted by date, then FOLLOW UP by follow_up_at, then ATTEMPTs)
  const queueLeads = useMemo(() => {
    let filtered = leads
    if (stageFilter) filtered = filtered.filter(l => l.stage === stageFilter)

    return [...filtered].sort((a, b) => {
      // Follow-ups with callback date: sort by follow_up_at
      if (a.stage === 'FOLLOW UP' && b.stage === 'FOLLOW UP') {
        if (a.follow_up_at && b.follow_up_at) return new Date(a.follow_up_at).getTime() - new Date(b.follow_up_at).getTime()
        if (a.follow_up_at) return -1
        if (b.follow_up_at) return 1
      }
      // LEAD and ATTEMPTs first (callable), then others
      const callableStages = ['LEAD', 'FOLLOW UP', 'ATTEMPT 1', 'ATTEMPT 2', 'ATTEMPT 3', 'ATTEMPT 4']
      const aCallable = callableStages.includes(a.stage) ? 0 : 1
      const bCallable = callableStages.includes(b.stage) ? 0 : 1
      if (aCallable !== bCallable) return aCallable - bCallable
      // Within callable: oldest first
      const aDate = a.date_received ? new Date(a.date_received).getTime() : 0
      const bDate = b.date_received ? new Date(b.date_received).getTime() : 0
      return aDate - bDate
    })
  }, [leads, stageFilter])

  const grouped = useMemo(() => {
    const map: Record<string, Lead[]> = {}
    for (const stage of STAGE_CONFIG) map[stage.key] = []
    for (const lead of leads) {
      if (map[lead.stage]) map[lead.stage].push(lead)
      else map['LEAD'].push(lead)
    }
    map['LEAD'].sort((a, b) => {
      const aDate = a.date_received ? new Date(a.date_received).getTime() : 0
      const bDate = b.date_received ? new Date(b.date_received).getTime() : 0
      return aDate - bDate
    })
    // Sort FOLLOW UP by follow_up_at
    map['FOLLOW UP'].sort((a, b) => {
      if (a.follow_up_at && b.follow_up_at) return new Date(a.follow_up_at).getTime() - new Date(b.follow_up_at).getTime()
      if (a.follow_up_at) return -1
      return 1
    })
    return map
  }, [leads])

  const archivedLeads = useMemo(() =>
    allLeads.filter(l => !LEAD_STAGES.includes(l.stage as typeof LEAD_STAGES[number])),
    [allLeads]
  )

  // KPIs: all leads (including legacy) for volume metrics
  const recentStats = useMemo(() => ({
    lead: leads.filter(l => l.stage === 'LEAD').length,
    attempts: leads.filter(l => l.stage.startsWith('ATTEMPT')).length,
    callBooked: leads.filter(l => l.stage === 'CLOSING CALL BOOKED').length,
    total: leads.length,
  }), [leads])

  // Stage counts for filter
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const l of leads) counts[l.stage] = (counts[l.stage] || 0) + 1
    return counts
  }, [leads])

  const handleDrop = (leadId: string, newStage: string) => {
    setDragLeadId(null)
    setDragOverStage(null)
    // Optimistic: update local state instantly
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage: newStage } : l))
    setAllLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage: newStage } : l))
    // Fire-and-forget API call
    fetch('/api/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: leadId, stage: newStage }),
    })
  }

  // Na ophangen via de dialer: verse leaddata ophalen (de voice-webhook heeft
  // first_called_at/sla_met al server-side gezet) en het log-modal openen.
  const handleCallEnded = useCallback(async (dialLead: DialableLead) => {
    const { data } = await supabase.from('leads').select('*').eq('id', dialLead.id).single()
    if (data) setCallAction(data as unknown as Lead)
    loadData()
  }, [loadData])

  if (loading) return <SkeletonPage />

  return (
    <DialerProvider onCallEnded={handleCallEnded}>
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Leads</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            <span className="tabular-nums">{leads.length}</span> active &middot;{' '}
            <span className="tabular-nums">{allLeads.length}</span> total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DialerSettings />
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setView('queue')} title="Call Queue"
              className={`p-1.5 rounded-md transition-colors duration-[120ms] ${view === 'queue' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
              <ClipboardList className="w-4 h-4" {...iconProps} />
            </button>
            <button onClick={() => setView('kanban')} title="Kanban"
              className={`p-1.5 rounded-md transition-colors duration-[120ms] ${view === 'kanban' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
              <LayoutGrid className="w-4 h-4" {...iconProps} />
            </button>
            <button onClick={() => setView('list')} title="List"
              className={`p-1.5 rounded-md transition-colors duration-[120ms] ${view === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
              <List className="w-4 h-4" {...iconProps} />
            </button>
          </div>
          <Button variant="primary" size="md" onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4" {...iconProps} /> Add lead
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
        <KpiCard label="Uncalled" value={recentStats.lead} captionColor={recentStats.lead > 0 ? 'danger' : undefined} caption={recentStats.lead > 0 ? 'waiting to be called' : undefined} />
        <KpiCard label="In attempts" value={recentStats.attempts} />
        <KpiCard label="Call Booked" value={recentStats.callBooked} captionColor="success" />
        <KpiCard label="SLA today" value={slaStatus ? `${slaStatus.today.slaPercent}%` : '—'} captionColor={slaStatus && slaStatus.today.slaPercent < 80 ? 'danger' : 'success'} caption={`< ${SLA_MINUTES} min target`} />
        <KpiCard label="Avg. TTC" value={stats?.avgTimeToCall != null ? `${stats.avgTimeToCall}m` : '—'} />
        <KpiCard label="Total in board" value={leads.length} />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" {...iconProps} />
          <input type="text" placeholder="Search by name, email or phone..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 h-9 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-accent-500 transition-shadow duration-[120ms]" />
        </div>
        {view === 'queue' && (
          <select value={stageFilter} onChange={e => setStageFilter(e.target.value)}
            className="h-9 text-sm border border-gray-200 rounded-lg px-3 bg-white text-gray-700">
            <option value="">All stages ({leads.length})</option>
            {STAGE_CONFIG.map(s => (
              <option key={s.key} value={s.key}>{s.label} ({stageCounts[s.key] || 0})</option>
            ))}
          </select>
        )}
        <button onClick={() => setShowArchive(!showArchive)}
          className={`h-9 px-3 text-sm rounded-lg border transition-colors duration-[120ms] ${showArchive ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
          Archive ({archivedLeads.length})
        </button>
      </div>

      {/* ── CALL QUEUE VIEW ── */}
      {view === 'queue' && !showArchive && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100">
                  <th className="px-5 py-3 w-8">#</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Quiz / Context</th>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3">Attempts</th>
                  <th className="px-4 py-3">Follow-up</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {queueLeads.map((lead, i) => {
                  const quizPreview = getFirstQuizAnswer(lead)
                  const isFollowUp = lead.stage === 'FOLLOW UP' && lead.follow_up_at
                  const followUpPast = isFollowUp && new Date(lead.follow_up_at!).getTime() < Date.now()
                  return (
                    <tr key={lead.id} className={`hover:bg-gray-50 transition-colors duration-[120ms] ${followUpPast ? 'bg-amber-50/40' : ''}`}>
                      <td className="px-5 py-3 text-gray-400 tabular-nums text-xs">{i + 1}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => setSelectedLead(lead)} className="text-left">
                          <div className="font-medium text-gray-900">{lead.name}</div>
                          {lead.email && <div className="text-[11px] text-gray-400">{lead.email}</div>}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        {lead.phone ? (
                          <a href={`tel:${lead.phone}`} className="text-gray-700 hover:text-blue-600 flex items-center gap-1 font-medium">
                            <Phone className="w-3 h-3" {...iconProps} /> {lead.phone}
                          </a>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 max-w-[250px]">
                        {quizPreview ? (
                          <div className="text-xs text-gray-600 truncate" title={quizPreview}>{quizPreview}</div>
                        ) : <span className="text-gray-400 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3"><Badge status={lead.stage} /></td>
                      <td className="px-4 py-3 tabular-nums text-gray-500">{lead.attempt_count || 0}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {lead.follow_up_at ? (
                          <span className={followUpPast ? 'text-amber-600 font-medium' : ''}>
                            {formatDate(lead.follow_up_at)}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <CallButton lead={lead} />
                          <button onClick={() => setCallAction(lead)}
                            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors duration-[120ms]">
                            <ClipboardList className="w-3 h-3" {...iconProps} /> Log
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {queueLeads.length === 0 && (
            <div className="py-16 text-center text-sm text-gray-400">No leads found</div>
          )}
        </div>
      )}

      {/* ── KANBAN VIEW ── */}
      {view === 'kanban' && !showArchive && (
        <div className="overflow-x-auto -mx-6 px-6 pb-4">
          <div className="flex gap-3" style={{ minWidth: STAGE_CONFIG.length * 260 }}>
            {STAGE_CONFIG.map(stage => {
              const stageLeads = grouped[stage.key] || []
              const shown = stageLeads.slice(0, KANBAN_MAX_PER_COL)
              const remaining = stageLeads.length - shown.length
              return (
                <div key={stage.key} className="w-[260px] flex-shrink-0"
                  onDragOver={e => { e.preventDefault(); setDragOverStage(stage.key) }}
                  onDragLeave={() => setDragOverStage(null)}
                  onDrop={e => { e.preventDefault(); if (dragLeadId) handleDrop(dragLeadId, stage.key) }}>
                  <div className="mb-3 flex items-center justify-between">
                    <span className={`inline-flex items-center text-xs font-medium rounded-md px-2 py-1 ${stage.color}`}>
                      {stage.label}
                    </span>
                    <span className="text-xs text-gray-400 tabular-nums">{stageLeads.length}</span>
                  </div>
                  <div className={`space-y-2 min-h-[200px] rounded-lg transition-colors duration-150 ${dragOverStage === stage.key ? 'bg-blue-50/50 ring-2 ring-blue-200 ring-inset' : ''}`}>
                    {shown.map(lead => {
                      const quizPreview = getFirstQuizAnswer(lead)
                      const recent = isRecentLead(lead.date_received)
                      const slaMins = getSLAMinutes(lead.date_received)
                      const slaExpired = recent && lead.stage === 'LEAD' && !lead.first_called_at && slaMins != null && slaMins > SLA_MINUTES
                      return (
                        <div key={lead.id}
                          draggable
                          onDragStart={() => setDragLeadId(lead.id)}
                          onDragEnd={() => { setDragLeadId(null); setDragOverStage(null) }}
                          onClick={() => setSelectedLead(lead)}
                          className={`bg-white rounded-lg border ${slaExpired ? 'border-red-200 bg-red-50/30' : 'border-gray-200'} ${stage.borderColor} border-l-[3px] p-3 cursor-grab active:cursor-grabbing hover:border-gray-300 transition-colors duration-[120ms] ${dragLeadId === lead.id ? 'opacity-50' : ''}`}>
                          {recent && lead.stage === 'LEAD' && !lead.first_called_at && slaMins != null && (
                            <div className={`flex items-center gap-1 text-[10px] font-medium mb-1 ${slaExpired ? 'text-red-600' : 'text-emerald-600'}`}>
                              {slaExpired ? <AlertTriangle className="w-3 h-3" {...iconProps} /> : <Clock className="w-3 h-3" {...iconProps} />}
                              <span className="tabular-nums">{slaMins}m</span>
                              {slaExpired && <span>— SLA exceeded</span>}
                            </div>
                          )}
                          <div className="font-medium text-sm text-gray-900 truncate">{lead.name}</div>
                          {quizPreview && (
                            <div className="text-[11px] text-gray-400 truncate mt-0.5" title={quizPreview}>{quizPreview}</div>
                          )}
                          <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-gray-400">
                            <Clock className="w-3 h-3" {...iconProps} />
                            <span>{timeAgo(lead.date_received)} ago</span>
                            {lead.attempt_count > 0 && <span className="ml-auto tabular-nums">{lead.attempt_count}x called</span>}
                          </div>
                          {lead.phone && (
                            <div className="flex items-center gap-1.5 mt-2" onClick={e => e.stopPropagation()}>
                              <span className="text-xs text-gray-500 truncate flex-1">{lead.phone}</span>
                              <CallButton lead={lead} />
                              <button onClick={e => { e.stopPropagation(); setCallAction(lead) }}
                                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors duration-[120ms]">
                                <ClipboardList className="w-3 h-3" {...iconProps} /> Log
                              </button>
                            </div>
                          )}
                          {lead.follow_up_at && (
                            <div className="flex items-center gap-1 mt-1.5 text-[10px] text-sky-600">
                              <Calendar className="w-3 h-3" {...iconProps} /> {formatDate(lead.follow_up_at)}
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {remaining > 0 && (
                      <div className="text-center py-2 text-[11px] text-gray-400">
                        +{remaining} more
                      </div>
                    )}
                    {stageLeads.length === 0 && (
                      <div className="rounded-lg border border-dashed border-gray-200 p-4 text-center">
                        <span className="text-xs text-gray-400">No leads</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {(view === 'list' || showArchive) && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100">
                  <th className="px-5 py-3">Name</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3">Attempts</th>
                  <th className="px-4 py-3">Received</th>
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
            <div className="py-16 text-center text-sm text-gray-400">No leads found</div>
          )}
        </div>
      )}

      {/* Call Action Modal */}
      {callAction && (
        <CallActionModal lead={callAction} onClose={() => setCallAction(null)} onDone={() => { setCallAction(null); loadData() }} />
      )}

      {/* Lead Detail */}
      {selectedLead && (
        <LeadDetail lead={selectedLead} onClose={() => setSelectedLead(null)} onUpdate={loadData} />
      )}

      {/* Add Lead Modal */}
      {showAddModal && (
        <AddLeadModal onClose={() => setShowAddModal(false)} onCreated={loadData} />
      )}
    </div>
    </DialerProvider>
  )
}

/* ── Call Action Modal ── */
function CallActionModal({ lead, onClose, onDone }: { lead: Lead; onClose: () => void; onDone: () => void }) {
  const [view, setView] = useState<'choose' | 'answered'>('choose')
  const [notes, setNotes] = useState('')
  const [nextStage, setNextStage] = useState<string>('FOLLOW UP')
  const [followUpAt, setFollowUpAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [events, setEvents] = useState<CalendlyEvent[]>([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/calendly-events').then(r => r.json()).then(setEvents)
  }, [])

  const handleNotAnswered = async () => {
    setSaving(true)
    const now = new Date().toISOString()
    const newAttempt = (lead.attempt_count || 0) + 1
    const newStage = newAttempt <= 4 ? `ATTEMPT ${newAttempt}` : lead.stage
    const updates: Record<string, unknown> = {
      id: lead.id, attempt_count: newAttempt, last_attempt_at: now,
      last_contact: now.split('T')[0], contact_count: (lead.contact_count || 0) + 1, stage: newStage,
    }
    if (!lead.first_called_at) {
      updates.first_called_at = now
      if (lead.date_received) {
        const ttc = Math.round((new Date(now).getTime() - new Date(lead.date_received).getTime()) / 60000)
        updates.time_to_call_minutes = ttc
        updates.sla_met = ttc <= SLA_MINUTES
      }
    }
    await fetch('/api/leads', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) })
    setSaving(false)
    onDone()
  }

  const handleAnswered = async () => {
    if (!nextStage) return
    setSaving(true)
    const now = new Date().toISOString()
    const updates: Record<string, unknown> = {
      id: lead.id, attempt_count: (lead.attempt_count || 0) + 1, last_attempt_at: now,
      last_contact: now.split('T')[0], contact_count: (lead.contact_count || 0) + 1,
      stage: nextStage, triage_notes: notes || lead.triage_notes || null,
    }
    if (nextStage === 'FOLLOW UP' && followUpAt) {
      updates.follow_up_at = new Date(followUpAt).toISOString()
    }
    if (nextStage === 'CLOSING CALL BOOKED' && selectedEventId) {
      const ev = events.find(e => e.id === selectedEventId)
      updates.calendly_event_id = selectedEventId
      updates.calendly_booking_url = ev ? buildCalendlyUrl(ev.url, lead) : null
      if (ev?.default_closer_id) updates.closer_id = ev.default_closer_id
    }
    if (!lead.first_called_at) {
      updates.first_called_at = now
      if (lead.date_received) {
        const ttc = Math.round((new Date(now).getTime() - new Date(lead.date_received).getTime()) / 60000)
        updates.time_to_call_minutes = ttc
        updates.sla_met = ttc <= SLA_MINUTES
      }
    }
    await fetch('/api/leads', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) })
    setSaving(false)
    onDone()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" />
      <div className="relative bg-white rounded-lg border border-gray-200 w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{lead.name}</h2>
            {lead.phone && <div className="text-sm text-gray-500">{lead.phone}</div>}
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-gray-400 hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>

        {view === 'choose' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">What was the result?</p>
            <Button variant="secondary" size="md" onClick={handleNotAnswered} disabled={saving} className="w-full justify-center">
              <PhoneMissed className="w-4 h-4 text-amber-600" {...iconProps} /> Not answered
            </Button>
            <Button variant="primary" size="md" onClick={() => setView('answered')} className="w-full justify-center">
              <CheckCircle2 className="w-4 h-4" {...iconProps} /> Answered
            </Button>
          </div>
        )}

        {view === 'answered' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Result</label>
              <select value={nextStage} onChange={e => setNextStage(e.target.value)}
                className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700">
                <option value="FOLLOW UP">FOLLOW UP</option>
                <option value="CLOSING CALL BOOKED">CLOSING CALL BOOKED</option>
                <option value="LOST - NO INTEREST">LOST - NO INTEREST</option>
                <option value="LOST - BROKE">LOST - BROKE</option>
              </select>
            </div>
            {nextStage === 'FOLLOW UP' && (
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Call back at</label>
                <input type="datetime-local" value={followUpAt} onChange={e => setFollowUpAt(e.target.value)}
                  className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700" />
              </div>
            )}
            {nextStage === 'CLOSING CALL BOOKED' && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-3">
                <div className="flex items-center gap-2 text-sm text-emerald-700 font-medium">
                  <Calendar className="w-4 h-4" {...iconProps} /> Book via Calendly
                </div>
                {events.length > 0 ? (
                  <>
                    <select value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)}
                      className="w-full text-sm border border-emerald-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                      <option value="">Select event...</option>
                      {events.map(ev => (
                        <option key={ev.id} value={ev.id}>{ev.name}{ev.closer ? ` (${ev.closer.name})` : ''}</option>
                      ))}
                    </select>
                    {selectedEventId && (() => {
                      const ev = events.find(e => e.id === selectedEventId)
                      if (!ev) return null
                      const bookingUrl = buildCalendlyUrl(ev.url, lead)
                      return (
                        <div className="flex gap-2">
                          <a href={bookingUrl} target="_blank" rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-md text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
                            <Link2 className="w-3 h-3" {...iconProps} /> Open Calendly
                          </a>
                          <button onClick={() => { navigator.clipboard.writeText(bookingUrl); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                            className="flex items-center gap-1 px-3 py-2 rounded-md text-xs font-medium bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-colors">
                            <Copy className="w-3 h-3" {...iconProps} /> {copied ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                      )
                    })()}
                  </>
                ) : (
                  <p className="text-xs text-emerald-600">No events configured. Add events in settings.</p>
                )}
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                rows={3} placeholder="Brief summary of the conversation..."
                className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-accent-700" />
            </div>
            <Button variant="primary" size="md" onClick={handleAnswered} disabled={saving} className="w-full justify-center">
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Lead Detail Slide-out ── */
function LeadDetail({ lead, onClose, onUpdate }: { lead: Lead; onClose: () => void; onUpdate: () => void }) {
  const [form, setForm] = useState({
    stage: lead.stage || 'LEAD',
    triage_notes: lead.triage_notes || '',
    notes: lead.notes || '',
    follow_up_at: lead.follow_up_at ? lead.follow_up_at.slice(0, 16) : '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const save = async () => {
    setSaving(true)
    await fetch('/api/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: lead.id, stage: form.stage,
        triage_notes: form.triage_notes || null,
        notes: form.notes || null,
        follow_up_at: form.follow_up_at ? new Date(form.follow_up_at).toISOString() : null,
      }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    onUpdate()
  }

  const slaMins = getSLAMinutes(lead.date_received)

  return (
    <SlideOver open onClose={onClose} title={lead.name}>
      <div className="flex-1 overflow-y-auto">
        {/* Badges */}
        <div className="px-6 pt-2 pb-4 flex items-center gap-2 flex-wrap">
          <Badge status={lead.stage} />
          <Badge status={lead.source || 'OTHER'} />
          {lead.attempt_count > 0 && <span className="text-[11px] text-gray-400 tabular-nums">{lead.attempt_count}x called</span>}
          {lead.sla_met === true && <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium"><CheckCircle2 className="w-3 h-3" /> SLA met</span>}
          {lead.sla_met === false && <span className="inline-flex items-center gap-1 text-[11px] text-red-600 font-medium"><AlertTriangle className="w-3 h-3" /> SLA missed</span>}
        </div>

        {/* Call action */}
        <div className="px-6 py-4 bg-blue-50 border-y border-blue-100">
          {lead.phone ? (
            <div className="flex items-center gap-3">
              <CallButton lead={lead} size="md" />
              <a href={`tel:${lead.phone}`} className="flex items-center gap-2 text-blue-700 font-medium text-sm hover:text-blue-800">
                <PhoneCall className="w-4 h-4" {...iconProps} /> {lead.phone}
              </a>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <PhoneOff className="w-4 h-4" {...iconProps} /> No phone number
            </div>
          )}
          {lead.time_to_call_minutes != null && (
            <div className="mt-2 text-[11px] text-blue-600">Time-to-call: <span className="tabular-nums font-medium">{lead.time_to_call_minutes}m</span></div>
          )}
        </div>

        {/* Contact */}
        <div className="px-6 py-5 border-b border-gray-100">
          <h3 className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-3">Contact</h3>
          <div className="space-y-2 text-sm">
            {lead.email && <div className="flex items-center gap-2 text-gray-700"><Mail className="w-3.5 h-3.5 text-gray-400" {...iconProps} /> {lead.email}</div>}
            {lead.ad_campaign && <div className="text-gray-500">Campaign: {lead.ad_campaign}</div>}
            {lead.creator_name && <div className="text-gray-500">Creator: {lead.creator_name}</div>}
            <div className="text-gray-500">Received: {formatDate(lead.date_received)}</div>
            {lead.first_called_at && <div className="text-gray-500">First call: {formatDate(lead.first_called_at)}</div>}
            {lead.last_attempt_at && <div className="text-gray-500">Last attempt: {formatDate(lead.last_attempt_at)}</div>}
          </div>
        </div>

        {/* Quiz answers */}
        {lead.quiz_answers && lead.quiz_answers.length > 0 && (
          <div className="px-6 py-5 border-b border-gray-100">
            <h3 className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-3">Quiz answers</h3>
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
                {LEAD_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {form.stage === 'FOLLOW UP' && (
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Call back at</label>
                <input type="datetime-local" value={form.follow_up_at} onChange={e => setForm({ ...form, follow_up_at: e.target.value })}
                  className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700" />
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Triage notes</label>
              <textarea value={form.triage_notes} onChange={e => setForm({ ...form, triage_notes: e.target.value })}
                rows={3} placeholder="Notes from the conversation..."
                className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-accent-700" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Notes</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                rows={2} placeholder="General notes..."
                className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-accent-700" />
            </div>
          </div>
        </div>

        {/* Triage-gesprekken (Twilio) */}
        <TriageCallsSection leadId={lead.id} />

        {/* Call link + status */}
        {lead.call_id && (
          <div className="px-6 py-5 border-b border-gray-100">
            <h3 className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-3">Linked Call</h3>
            <CallStatusBadge callId={lead.call_id} />
          </div>
        )}

        {/* Calendly for CLOSING CALL BOOKED */}
        {lead.stage === 'CLOSING CALL BOOKED' && lead.calendly_booking_url && (
          <div className="px-6 py-5 border-b border-gray-100">
            <h3 className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-3">Calendly</h3>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <a href={lead.calendly_booking_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-emerald-700 font-medium hover:text-emerald-800">
                <Calendar className="w-4 h-4" {...iconProps} /> Open Calendly booking page
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-gray-100 px-6 py-4 flex gap-3">
        <Button variant="primary" size="md" onClick={save} disabled={saving} className="flex-1">
          {saving ? 'Saving...' : saved ? <><Check className="w-4 h-4" {...iconProps} /> Saved</> : 'Save'}
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
    if (!form.name) { alert('Name is required'); return }
    setCreating(true)
    const now = new Date().toISOString()
    await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name, email: form.email || null, phone: form.phone || null,
        source: form.source, stage: 'LEAD', date_received: now,
        sla_deadline: new Date(Date.now() + SLA_MINUTES * 60000).toISOString(),
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
          <h2 className="text-base font-semibold text-gray-900">Add lead</h2>
          <button onClick={onClose} className="p-1 rounded-md text-gray-400 hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Name *</label>
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Name" className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Email</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="email@..." className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Phone</label>
              <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="+31 6..." className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Source</label>
            <select value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}
              className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700">
              <option value="ATHENA">ATHENA</option>
              <option value="QUIZ">QUIZ</option>
              <option value="HIBOO ADS">HIBOO ADS</option>
              <option value="CREATOR">CREATOR</option>
              <option value="INSTAGRAM DM">INSTAGRAM DM</option>
              <option value="REFERRAL">REFERRAL</option>
            </select>
          </div>
        </div>
        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
          <Button variant="secondary" size="md" onClick={onClose} className="flex-1">Cancel</Button>
          <Button variant="primary" size="md" onClick={handleCreate} disabled={creating} className="flex-1">
            {creating ? 'Adding...' : 'Add lead'}
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ── Triage-gesprekken (Twilio-opnames + samenvattingen) ── */
const CALL_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  'completed':   { label: 'Afgerond',     className: 'bg-emerald-50 text-emerald-700' },
  'in-progress': { label: 'Bezig',        className: 'bg-blue-50 text-blue-700' },
  'no-answer':   { label: 'Geen gehoor',  className: 'bg-amber-50 text-amber-700' },
  'busy':        { label: 'In gesprek',   className: 'bg-amber-50 text-amber-700' },
  'failed':      { label: 'Mislukt',      className: 'bg-red-50 text-red-700' },
  'canceled':    { label: 'Geannuleerd',  className: 'bg-gray-100 text-gray-600' },
  'initiated':   { label: 'Gestart',      className: 'bg-gray-100 text-gray-600' },
  'ringing':     { label: 'Gaat over',    className: 'bg-gray-100 text-gray-600' },
}

function formatCallDuration(seconds: number | null): string {
  if (seconds == null) return '—'
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function TriageCallsSection({ leadId }: { leadId: string }) {
  const [calls, setCalls] = useState<TriageCall[]>([])

  useEffect(() => {
    let active = true
    const load = () => getTriageCallsForLead(leadId).then(data => { if (active) setCalls(data) })
    load()
    // Poll zolang de slide-over open is; vangt ook binnenkomende samenvattingen op
    const interval = setInterval(load, 15000)
    return () => { active = false; clearInterval(interval) }
  }, [leadId])

  if (calls.length === 0) return null

  return (
    <div className="px-6 py-5 border-b border-gray-100">
      <h3 className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-3">Gesprekken</h3>
      <div className="space-y-3">
        {calls.map(call => {
          const status = CALL_STATUS_LABELS[call.status] || { label: call.status, className: 'bg-gray-100 text-gray-600' }
          return (
            <div key={call.id} className="bg-gray-50 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <span className={`inline-flex items-center rounded-md px-2 py-0.5 font-medium ${status.className}`}>{status.label}</span>
                <span className="text-gray-500">{formatDate(call.created_at)}</span>
                {call.duration_seconds != null && (
                  <span className="text-gray-400 tabular-nums ml-auto">{formatCallDuration(call.duration_seconds)}</span>
                )}
              </div>
              {call.recording_sid && (
                <div>
                  <div className="flex items-center gap-1 text-[11px] text-gray-500 mb-1">
                    <Play className="w-3 h-3" {...iconProps} /> Opname
                  </div>
                  <audio controls preload="none" className="w-full h-8"
                    src={`/api/twilio/recordings/${call.recording_sid}`} />
                </div>
              )}
              {(call.transcription_status === 'pending' || call.transcription_status === 'processing') && call.recording_sid && (
                <div className="text-[11px] text-gray-400 italic">Samenvatting wordt gemaakt…</div>
              )}
              {call.summary && (
                <div className="bg-white border border-gray-200 rounded-md px-3 py-2.5">
                  <div className="text-[11px] text-gray-500 mb-1 font-medium">Samenvatting</div>
                  <div className="text-sm text-gray-900 whitespace-pre-line">{call.summary}</div>
                </div>
              )}
              {call.transcript && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-gray-500 hover:text-gray-700 flex items-center gap-1">
                    <FileText className="w-3 h-3" {...iconProps} /> Transcript
                  </summary>
                  <div className="mt-2 text-gray-600 whitespace-pre-line bg-white border border-gray-200 rounded-md px-3 py-2 max-h-48 overflow-y-auto">
                    {call.transcript}
                  </div>
                </details>
              )}
              {call.transcription_status === 'failed' && (
                <div className="text-[11px] text-red-500">Transcriptie mislukt</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Call Status Badge (for lead detail backlink) ── */
function CallStatusBadge({ callId }: { callId: string }) {
  const [call, setCall] = useState<{ result: string; date_start_time: string | null } | null>(null)

  useEffect(() => {
    supabase.from('calls').select('result, date_start_time').eq('id', callId).single()
      .then(({ data }) => { if (data) setCall(data as typeof call) })
  }, [callId])

  if (!call) return <span className="text-xs text-gray-400">Loading...</span>

  return (
    <div className="bg-gray-50 rounded-lg px-4 py-3 flex items-center justify-between">
      <div>
        <Badge status={call.result || 'CALL BOOKED'} />
        {call.date_start_time && (
          <div className="text-[11px] text-gray-500 mt-1">{formatDate(call.date_start_time)}</div>
        )}
      </div>
      <a href="/sales/pipeline" className="text-xs text-blue-600 hover:text-blue-700 font-medium">
        View in pipeline →
      </a>
    </div>
  )
}
