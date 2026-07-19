'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { SkeletonPage } from '@/components/ui/skeleton'
import { Plus, Trash2, Calendar, X, Link2, CheckCircle2, AlertTriangle, Settings, RefreshCw, FileText } from 'lucide-react'
import { formatDate } from '@/lib/format'

const iconProps = { strokeWidth: 1.75 } as const

interface CalendlyEvent {
  id: string
  name: string
  url: string
  description: string | null
  default_closer_id: string | null
  active: boolean
  closer: { id: string; name: string } | null
}

interface Closer {
  id: string
  name: string
}

interface CalendlyStatus {
  connected: boolean
  user?: string
  email?: string
  webhooksActive?: number
  error?: string
}

export default function AdminPage() {
  const [events, setEvents] = useState<CalendlyEvent[]>([])
  const [closers, setClosers] = useState<Closer[]>([])
  const [calendlyStatus, setCalendlyStatus] = useState<CalendlyStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [connecting, setConnecting] = useState(false)

  const loadData = async () => {
    const [evRes, closerRes, statusRes] = await Promise.all([
      fetch('/api/calendly-events').then(r => r.json()),
      supabase.from('closers').select('id, name').order('name'),
      fetch('/api/webhooks/calendly/setup').then(r => r.json()),
    ])
    setEvents(evRes)
    setClosers(closerRes.data || [])
    setCalendlyStatus(statusRes)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const connectCalendly = async () => {
    setConnecting(true)
    const res = await fetch('/api/webhooks/calendly/setup', { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      setCalendlyStatus({ connected: true, user: data.user, webhooksActive: 1 })
    } else {
      setCalendlyStatus({ connected: false, error: data.error })
    }
    setConnecting(false)
  }

  const deleteEvent = async (id: string) => {
    await fetch(`/api/calendly-events?id=${id}`, { method: 'DELETE' })
    loadData()
  }

  if (loading) return <SkeletonPage />

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-gray-900">Admin</h1>
        <p className="text-sm text-gray-500 mt-0.5">Integrations & system settings</p>
      </div>

      {/* ── Calendly Integration ── */}
      <section className="mb-10">
        <h2 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-500" {...iconProps} /> Calendly Integration
        </h2>

        {/* Connection status */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {calendlyStatus?.connected ? (
                <>
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" {...iconProps} />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">Connected</div>
                    <div className="text-xs text-gray-500">
                      {calendlyStatus.user} {calendlyStatus.email && `(${calendlyStatus.email})`}
                      {calendlyStatus.webhooksActive != null && ` — ${calendlyStatus.webhooksActive} webhook(s) active`}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4 text-amber-600" {...iconProps} />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">Not connected</div>
                    <div className="text-xs text-gray-500">
                      {calendlyStatus?.error || 'Webhook not registered yet'}
                    </div>
                  </div>
                </>
              )}
            </div>
            {!calendlyStatus?.connected || (calendlyStatus?.webhooksActive === 0) ? (
              <Button variant="primary" size="md" onClick={connectCalendly} disabled={connecting}>
                {connecting ? 'Connecting...' : 'Connect webhook'}
              </Button>
            ) : null}
          </div>
        </div>

        {/* Events */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Booking Events</h3>
          <Button variant="secondary" size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="w-3.5 h-3.5" {...iconProps} /> Add event
          </Button>
        </div>

        {events.length === 0 ? (
          <div className="bg-white rounded-lg border border-dashed border-gray-200 p-8 text-center">
            <Calendar className="w-6 h-6 text-gray-300 mx-auto mb-2" {...iconProps} />
            <p className="text-sm text-gray-500 mb-3">No events configured</p>
            <Button variant="primary" size="sm" onClick={() => setShowAdd(true)}>
              <Plus className="w-3.5 h-3.5" {...iconProps} /> Add first event
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {events.map(ev => (
              <div key={ev.id} className="bg-white rounded-lg border border-gray-200 px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-4 h-4 text-blue-600" {...iconProps} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900">{ev.name}</div>
                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                      <a href={ev.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 truncate max-w-[350px]">{ev.url}</a>
                      {ev.closer && <span>· Closer: {ev.closer.name}</span>}
                    </div>
                  </div>
                </div>
                <button onClick={() => deleteEvent(ev.id)} className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                  <Trash2 className="w-4 h-4" {...iconProps} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Webhook Logs ── */}
      <WebhookLogs />

      {/* ── System Info ── */}
      <section>
        <h2 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
          <Settings className="w-4 h-4 text-gray-500" {...iconProps} /> System
        </h2>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-500">Version:</span> <span className="text-gray-900 font-medium">0.7</span></div>
            <div><span className="text-gray-500">Database:</span> <span className="text-gray-900 font-medium">Supabase</span></div>
            <div><span className="text-gray-500">Hosting:</span> <span className="text-gray-900 font-medium">Vercel</span></div>
            <div><span className="text-gray-500">Auth:</span> <span className="text-gray-900 font-medium">Supabase Auth</span></div>
          </div>
        </div>
      </section>

      {showAdd && (
        <AddEventModal closers={closers} onClose={() => setShowAdd(false)} onCreated={loadData} />
      )}
    </div>
  )
}

/* ── Webhook Logs ── */
function WebhookLogs() {
  const [logs, setLogs] = useState<{ id: string; source: string; event: string; payload: Record<string, unknown>; created_at: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  const loadLogs = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('webhook_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
    setLogs((data || []) as typeof logs)
    setLoading(false)
  }

  useEffect(() => { loadLogs() }, [])

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-gray-900 flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-500" {...iconProps} /> Webhook Logs
        </h2>
        <button onClick={loadLogs} className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} {...iconProps} />
        </button>
      </div>

      {logs.length === 0 ? (
        <div className="bg-white rounded-lg border border-dashed border-gray-200 p-6 text-center">
          <p className="text-sm text-gray-500">No webhook logs yet</p>
          <p className="text-xs text-gray-400 mt-1">Logs will appear when Calendly sends events</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100">
                <th className="px-5 py-3">Time</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 text-gray-500 text-xs tabular-nums whitespace-nowrap">{formatDate(log.created_at)}</td>
                  <td className="px-4 py-3 text-gray-700 font-medium">{log.source}</td>
                  <td className="px-4 py-3"><span className="text-xs font-medium bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">{log.event}</span></td>
                  <td className="px-4 py-3">
                    <button onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                      {expanded === log.id ? 'Hide' : 'Show'}
                    </button>
                    {expanded === log.id && (
                      <pre className="mt-2 text-[11px] text-gray-600 bg-gray-50 rounded-lg p-3 overflow-x-auto max-h-[300px] overflow-y-auto">
                        {JSON.stringify(log.payload, null, 2)}
                      </pre>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function AddEventModal({ closers, onClose, onCreated }: { closers: Closer[]; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', url: '', description: '', default_closer_id: '' })
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    if (!form.name || !form.url) { alert('Name and URL are required'); return }
    setCreating(true)
    await fetch('/api/calendly-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name, url: form.url,
        description: form.description || null,
        default_closer_id: form.default_closer_id || null,
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
          <h2 className="text-base font-semibold text-gray-900">Add Calendly Event</h2>
          <button onClick={onClose} className="p-1 rounded-md text-gray-400 hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Event name *</label>
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Groei Sessie, Strategiegesprek"
              className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Calendly URL *</label>
            <input type="url" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })}
              placeholder="https://calendly.com/your-team/event-name"
              className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Description</label>
            <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Optional"
              className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Default closer</label>
            <select value={form.default_closer_id} onChange={e => setForm({ ...form, default_closer_id: e.target.value })}
              className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700">
              <option value="">None</option>
              {closers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
          <Button variant="secondary" size="md" onClick={onClose} className="flex-1">Cancel</Button>
          <Button variant="primary" size="md" onClick={handleCreate} disabled={creating} className="flex-1">
            {creating ? 'Adding...' : 'Add event'}
          </Button>
        </div>
      </div>
    </div>
  )
}
