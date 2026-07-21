'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Plus, Trash2, Link2, X, Calendar, CheckCircle2, RefreshCw,
} from 'lucide-react'

const iconProps = { strokeWidth: 1.75 } as const

interface Source { id: string; name: string; active: boolean }
interface Creator { id: string; name: string }
interface Setter { id: string; name: string }

interface CalendlyEvent {
  id: string
  name: string
  url: string
  description: string | null
  default_source: string | null
  default_setter_id: string | null
  default_creator_id: string | null
  search_leads_first: boolean
  active: boolean
  setter?: { id: string; name: string } | null
  creator?: { id: string; name: string } | null
}

interface CalendlyStatus {
  connected: boolean
  user?: string
  email?: string
  webhooksActive?: number
  error?: string
}

export function CalendlyPanel() {
  const [events, setEvents] = useState<CalendlyEvent[]>([])
  const [sources, setSources] = useState<Source[]>([])
  const [creators, setCreators] = useState<Creator[]>([])
  const [setters, setSetters] = useState<Setter[]>([])
  const [status, setStatus] = useState<CalendlyStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddEvent, setShowAddEvent] = useState(false)
  const [connecting, setConnecting] = useState(false)

  const loadData = useCallback(async () => {
    const [evRes, srcRes, crRes, setRes, stRes] = await Promise.all([
      fetch('/api/calendly-events').then(r => r.json()).catch(() => []),
      fetch('/api/sources').then(r => r.json()).catch(() => []),
      fetch('/api/creators').then(r => r.json()).catch(() => []),
      fetch('/api/team').then(r => r.json()).catch(() => []),
      fetch('/api/webhooks/calendly/setup').then(r => r.json()).catch(() => ({ connected: false })),
    ])

    const setterList: Setter[] = (Array.isArray(setRes) ? setRes : [])
      .filter((m: { role: string }) => m.role === 'SETTER' || m.role === 'ADMIN')
      .map((m: { id: string; name: string }) => ({ id: m.id, name: m.name }))
    const creatorList: Creator[] = (Array.isArray(crRes) ? crRes : [])
      .map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }))
    const setterMap = new Map(setterList.map(s => [s.id, s]))
    const creatorMap = new Map(creatorList.map(c => [c.id, c]))

    const enriched = (Array.isArray(evRes) ? evRes : []).map((ev: CalendlyEvent) => ({
      ...ev,
      setter: ev.default_setter_id ? setterMap.get(ev.default_setter_id) || null : null,
      creator: ev.default_creator_id ? creatorMap.get(ev.default_creator_id) || null : null,
    }))

    setEvents(enriched)
    setSources((Array.isArray(srcRes) ? srcRes : []).filter((s: Source) => s.active))
    setCreators(creatorList)
    setSetters(setterList)
    setStatus(stRes)
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const connectCalendly = async () => {
    setConnecting(true)
    const res = await fetch('/api/webhooks/calendly/setup', { method: 'POST' })
    const data = await res.json()
    setStatus(res.ok ? { connected: true, user: data.user, webhooksActive: 1 } : { connected: false, error: data.error })
    setConnecting(false)
  }

  const deleteEvent = async (id: string) => {
    await fetch(`/api/calendly-events?id=${id}`, { method: 'DELETE' })
    loadData()
  }

  const toggleSearchLeads = async (id: string, current: boolean) => {
    await fetch('/api/calendly-events', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, search_leads_first: !current }),
    })
    loadData()
  }

  const updateCreator = async (eventId: string, creatorId: string | null) => {
    await fetch('/api/calendly-events', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: eventId, default_creator_id: creatorId || null }),
    })
    loadData()
  }

  if (loading) return <div className="text-sm text-gray-400">Laden...</div>

  return (
    <div>
      {/* Connection status */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${status?.connected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <div>
              <span className="text-sm font-medium text-gray-900">
                {status?.connected ? 'Verbonden' : 'Niet verbonden'}
              </span>
              {status?.connected && status.user && (
                <span className="text-xs text-gray-500 ml-2">{status.user}</span>
              )}
            </div>
          </div>
          {(!status?.connected || status?.webhooksActive === 0) && (
            <Button variant="primary" size="sm" onClick={connectCalendly} disabled={connecting}>
              {connecting ? 'Verbinden...' : 'Verbinden'}
            </Button>
          )}
        </div>
      </div>

      {/* Events */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Booking Events</h3>
        <Button variant="secondary" size="sm" onClick={() => setShowAddEvent(true)}>
          <Plus className="w-3.5 h-3.5" {...iconProps} /> Toevoegen
        </Button>
      </div>

      {events.length === 0 ? (
        <div className="bg-white rounded-lg border border-dashed border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500 mb-3">Geen booking events geconfigureerd</p>
          <Button variant="primary" size="sm" onClick={() => setShowAddEvent(true)}>
            <Plus className="w-3.5 h-3.5" {...iconProps} /> Toevoegen
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map(ev => (
            <div key={ev.id} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{ev.name}</span>
                    {ev.default_source && <Badge status={ev.default_source} size="sm" />}
                  </div>
                  <a href={ev.url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-gray-400 hover:text-blue-600 flex items-center gap-1 mt-1 truncate max-w-[400px]">
                    <Link2 className="w-3 h-3 flex-shrink-0" {...iconProps} /> {ev.url}
                  </a>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                    {ev.setter && <span>Setter: <strong className="text-gray-700">{ev.setter.name}</strong></span>}
                    {ev.creator && <span>Creator: <strong className="text-gray-700">{ev.creator.name}</strong></span>}
                    {ev.default_source && <span>Source: <strong className="text-gray-700">{ev.default_source}</strong></span>}
                    <span className="text-gray-400">Closer: auto (Calendly host)</span>
                  </div>
                </div>
                <button onClick={() => deleteEvent(ev.id)} className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors ml-3">
                  <Trash2 className="w-4 h-4" {...iconProps} />
                </button>
              </div>

              {/* Settings row */}
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={ev.search_leads_first}
                    onChange={() => toggleSearchLeads(ev.id, ev.search_leads_first)}
                    className="rounded border-gray-300 text-accent-700 focus:ring-accent-700" />
                  <span className="text-xs text-gray-600">Zoek leads eerst</span>
                </label>

                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-500">Creator:</span>
                  <select
                    value={ev.default_creator_id || ''}
                    onChange={e => updateCreator(ev.id, e.target.value || null)}
                    className="text-xs border border-gray-200 rounded px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-accent-700"
                  >
                    <option value="">Geen</option>
                    {creators.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 bg-gray-50 rounded-lg p-3">
        <p className="text-[11px] text-gray-500">
          <strong>Hoe het werkt:</strong> Als iemand boekt via Calendly, koppelt de webhook het event aan de juiste config.
          De closer wordt automatisch de Calendly-host. Bij &quot;Zoek leads eerst&quot; wordt de bestaande source/triage-data gebruikt.
        </p>
      </div>

      {showAddEvent && (
        <AddEventModal
          sources={sources}
          setters={setters}
          creators={creators}
          onClose={() => setShowAddEvent(false)}
          onCreated={loadData}
        />
      )}
    </div>
  )
}

/* ── Add Event Modal ── */
function AddEventModal({ sources, setters, creators, onClose, onCreated }: {
  sources: Source[]
  setters: Setter[]
  creators: Creator[]
  onClose: () => void
  onCreated: () => void
}) {
  const [form, setForm] = useState({
    name: '', url: '', description: '',
    default_source: sources[0]?.name || 'ATHENA',
    default_setter_id: '',
    default_creator_id: '',
    search_leads_first: true,
  })
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    if (!form.name || !form.url) { alert('Naam en URL zijn verplicht'); return }
    setCreating(true)
    await fetch('/api/calendly-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        default_setter_id: form.default_setter_id || null,
        default_creator_id: form.default_creator_id || null,
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
          <h2 className="text-base font-semibold text-gray-900">Calendly Event Toevoegen</h2>
          <button onClick={onClose} className="p-1 rounded-md text-gray-400 hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <Field label="Event naam *">
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Moet overeenkomen met je Calendly event naam"
              className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700" />
          </Field>
          <Field label="Calendly URL *">
            <input type="url" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })}
              placeholder="https://calendly.com/your-team/event"
              className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700" />
          </Field>
          <Field label="Beschrijving">
            <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Optioneel — interne notitie"
              className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700" />
          </Field>
          <Field label="Default source">
            <select value={form.default_source} onChange={e => setForm({ ...form, default_source: e.target.value })}
              className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700">
              {sources.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Default setter">
            <select value={form.default_setter_id} onChange={e => setForm({ ...form, default_setter_id: e.target.value })}
              className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700">
              <option value="">Geen</option>
              {setters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Default creator">
            <select value={form.default_creator_id} onChange={e => setForm({ ...form, default_creator_id: e.target.value })}
              className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700">
              <option value="">Geen</option>
              {creators.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.search_leads_first}
              onChange={e => setForm({ ...form, search_leads_first: e.target.checked })}
              className="rounded border-gray-300 text-accent-700 focus:ring-accent-700" />
            <span className="text-sm text-gray-700">Zoek leads eerst</span>
          </label>
        </div>
        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
          <Button variant="secondary" size="md" onClick={onClose} className="flex-1">Annuleren</Button>
          <Button variant="primary" size="md" onClick={handleCreate} disabled={creating} className="flex-1">
            {creating ? 'Toevoegen...' : 'Toevoegen'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  )
}
