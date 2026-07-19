'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SkeletonPage } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/format'
import {
  Plus, Trash2, Calendar, X, CheckCircle2, AlertTriangle,
  Settings, RefreshCw, Users, Shield, Link2,
} from 'lucide-react'

const iconProps = { strokeWidth: 1.75 } as const
const SOURCES = ['ATHENA', 'QUIZ', 'HIBOO ADS', 'CREATOR', 'INSTAGRAM DM', 'CALENDLY'] as const
const ROLES = ['ADMIN', 'CLOSER', 'SETTER', 'COACH', 'FINANCE'] as const

interface CalendlyEvent {
  id: string
  name: string
  url: string
  description: string | null
  default_source: string | null
  search_leads_first: boolean
  active: boolean
}

interface TeamMember {
  id: string
  email: string
  name: string
  role: string
  active: boolean
  created_at: string
}

interface WebhookLog {
  id: string
  source: string
  event: string
  payload: Record<string, unknown>
  created_at: string
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
  const [members, setMembers] = useState<TeamMember[]>([])
  const [logs, setLogs] = useState<WebhookLog[]>([])
  const [calendlyStatus, setCalendlyStatus] = useState<CalendlyStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddEvent, setShowAddEvent] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)
  const [connecting, setConnecting] = useState(false)

  const loadData = async () => {
    const [evRes, memberRes, logRes, statusRes] = await Promise.all([
      fetch('/api/calendly-events').then(r => r.json()).catch(() => []),
      supabase.from('team_members').select('*').order('name'),
      supabase.from('webhook_logs').select('*').order('created_at', { ascending: false }).limit(10),
      fetch('/api/webhooks/calendly/setup').then(r => r.json()).catch(() => ({ connected: false })),
    ])
    setEvents(Array.isArray(evRes) ? evRes : [])
    setMembers((memberRes.data || []) as unknown as TeamMember[])
    setLogs((logRes.data || []) as unknown as WebhookLog[])
    setCalendlyStatus(statusRes)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const connectCalendly = async () => {
    setConnecting(true)
    const res = await fetch('/api/webhooks/calendly/setup', { method: 'POST' })
    const data = await res.json()
    setCalendlyStatus(res.ok ? { connected: true, user: data.user, webhooksActive: 1 } : { connected: false, error: data.error })
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

  const deactivateMember = async (id: string) => {
    await supabase.from('team_members').update({ active: false }).eq('id', id)
    loadData()
  }

  if (loading) return <SkeletonPage />

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-gray-900">Admin</h1>
        <p className="text-sm text-gray-500 mt-0.5">Integrations, team & system settings</p>
      </div>

      {/* ── CALENDLY ── */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-gray-500" {...iconProps} />
          <h2 className="text-sm font-medium text-gray-900">Calendly Integration</h2>
        </div>

        {/* Connection */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${calendlyStatus?.connected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <div>
                <span className="text-sm font-medium text-gray-900">
                  {calendlyStatus?.connected ? 'Connected' : 'Not connected'}
                </span>
                {calendlyStatus?.connected && calendlyStatus.user && (
                  <span className="text-xs text-gray-500 ml-2">{calendlyStatus.user}</span>
                )}
              </div>
            </div>
            {(!calendlyStatus?.connected || calendlyStatus?.webhooksActive === 0) && (
              <Button variant="primary" size="sm" onClick={connectCalendly} disabled={connecting}>
                {connecting ? 'Connecting...' : 'Connect'}
              </Button>
            )}
          </div>
        </div>

        {/* Events */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Booking Events</h3>
          <Button variant="secondary" size="sm" onClick={() => setShowAddEvent(true)}>
            <Plus className="w-3.5 h-3.5" {...iconProps} /> Add event
          </Button>
        </div>

        {events.length === 0 ? (
          <div className="bg-white rounded-lg border border-dashed border-gray-200 p-8 text-center">
            <p className="text-sm text-gray-500 mb-3">No booking events configured</p>
            <p className="text-xs text-gray-400 mb-4">Add your Calendly event URLs so the webhook knows how to route bookings.</p>
            <Button variant="primary" size="sm" onClick={() => setShowAddEvent(true)}>
              <Plus className="w-3.5 h-3.5" {...iconProps} /> Add event
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
                    {ev.description && <div className="text-xs text-gray-500 mt-1">{ev.description}</div>}
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
                    <span className="text-xs text-gray-600">Search leads first</span>
                  </label>
                  <span className="text-[10px] text-gray-400">
                    {ev.search_leads_first
                      ? 'Uses existing lead source & triage data when available'
                      : 'Always uses event default source (direct booking flow)'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 bg-gray-50 rounded-lg p-3">
          <p className="text-[11px] text-gray-500">
            <strong>How it works:</strong> When someone books via Calendly, the webhook checks which event was booked.
            The closer is automatically set to the Calendly host. If &quot;Search leads first&quot; is on, the source and triage data come from the existing lead.
            Otherwise, the event&apos;s default source is used.
          </p>
        </div>
      </section>

      {/* ── TEAM MEMBERS ── */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-500" {...iconProps} />
            <h2 className="text-sm font-medium text-gray-900">Team Members</h2>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setShowAddMember(true)}>
            <Plus className="w-3.5 h-3.5" {...iconProps} /> Add member
          </Button>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100">
                <th className="px-5 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {members.map(m => (
                <tr key={m.id} className={!m.active ? 'opacity-50' : ''}>
                  <td className="px-5 py-3 font-medium text-gray-900">{m.name}</td>
                  <td className="px-4 py-3 text-gray-500">{m.email}</td>
                  <td className="px-4 py-3"><Badge status={m.role} size="sm" /></td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${m.active ? 'text-emerald-600' : 'text-gray-400'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${m.active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                      {m.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {m.active && (
                      <button onClick={() => deactivateMember(m.id)} className="text-xs text-gray-400 hover:text-red-600">
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-gray-400">No team members</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── WEBHOOK ACTIVITY ── */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-gray-500" {...iconProps} />
            <h2 className="text-sm font-medium text-gray-900">Recent Webhook Activity</h2>
          </div>
          <button onClick={loadData} className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <RefreshCw className="w-4 h-4" {...iconProps} />
          </button>
        </div>

        {logs.length === 0 ? (
          <div className="bg-white rounded-lg border border-dashed border-gray-200 p-6 text-center">
            <p className="text-sm text-gray-500">No webhook activity yet</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {logs.map(log => {
              const isError = log.source === 'calendly-error'
              const payload = log.payload as Record<string, unknown>
              const innerPayload = payload?.payload as Record<string, unknown> | undefined
              const leadName = (innerPayload?.name as string) || (payload?.name as string) || '—'
              const leadEmail = (innerPayload?.email as string) || (payload?.email as string) || ''

              return (
                <div key={log.id} className={`bg-white rounded-lg border px-4 py-3 flex items-center gap-3 ${isError ? 'border-red-200 bg-red-50/30' : 'border-gray-200'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isError ? 'bg-red-500' : 'bg-emerald-500'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-900">{log.event}</span>
                      {leadName !== '—' && <span className="text-xs text-gray-500 truncate">{leadName}</span>}
                      {leadEmail && <span className="text-[10px] text-gray-400 truncate">{leadEmail}</span>}
                    </div>
                  </div>
                  <span className="text-[10px] text-gray-400 tabular-nums whitespace-nowrap">{formatDate(log.created_at)}</span>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── SYSTEM ── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-4 h-4 text-gray-500" {...iconProps} />
          <h2 className="text-sm font-medium text-gray-900">System</h2>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-gray-500">Version</span> <span className="text-gray-900 font-medium ml-2">0.8</span></div>
            <div><span className="text-gray-500">Database</span> <span className="text-gray-900 font-medium ml-2">Supabase</span></div>
            <div><span className="text-gray-500">Hosting</span> <span className="text-gray-900 font-medium ml-2">Vercel</span></div>
            <div><span className="text-gray-500">Auth</span> <span className="text-gray-900 font-medium ml-2">RBAC (5 roles)</span></div>
          </div>
        </div>
      </section>

      {/* Modals */}
      {showAddEvent && <AddEventModal onClose={() => setShowAddEvent(false)} onCreated={loadData} />}
      {showAddMember && <AddMemberModal onClose={() => setShowAddMember(false)} onCreated={loadData} />}
    </div>
  )
}

/* ── Add Event Modal ── */
function AddEventModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', url: '', description: '', default_source: 'ATHENA', search_leads_first: true })
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    if (!form.name || !form.url) { alert('Name and URL are required'); return }
    setCreating(true)
    await fetch('/api/calendly-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
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
              placeholder="Must match your Calendly event name"
              className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700" />
            <p className="text-[10px] text-gray-400 mt-1">This name is used to match incoming webhooks to the right event config.</p>
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
              placeholder="Optional — internal note"
              className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Default source</label>
            <select value={form.default_source} onChange={e => setForm({ ...form, default_source: e.target.value })}
              className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700">
              {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <p className="text-[10px] text-gray-400 mt-1">Used when the lead has no existing source in the database.</p>
          </div>
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.search_leads_first}
                onChange={e => setForm({ ...form, search_leads_first: e.target.checked })}
                className="rounded border-gray-300 text-accent-700 focus:ring-accent-700" />
              <span className="text-sm text-gray-700">Search leads first</span>
            </label>
            <p className="text-[10px] text-gray-400 mt-1 ml-6">
              When enabled, the webhook uses the existing lead&apos;s source and triage notes.
              Disable for direct booking flows (e.g. DM funnel) where there&apos;s no prior lead.
            </p>
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

/* ── Add Team Member Modal ── */
function AddMemberModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'SETTER' })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    if (!form.name || !form.email || !form.password) { setError('All fields are required'); return }
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return }
    setCreating(true)
    setError('')

    // Create Supabase Auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: form.email,
      password: form.password,
      email_confirm: true,
    })

    if (authError) {
      // Fallback: try signUp if admin API not available
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
      })
      if (signUpError) {
        setError(signUpError.message)
        setCreating(false)
        return
      }
      if (signUpData.user) {
        await supabase.from('team_members').insert({
          user_id: signUpData.user.id,
          email: form.email,
          name: form.name,
          role: form.role,
        })
      }
    } else if (authData.user) {
      await supabase.from('team_members').insert({
        user_id: authData.user.id,
        email: form.email,
        name: form.name,
        role: form.role,
      })
    }

    setCreating(false)
    onCreated()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" />
      <div className="relative bg-white rounded-lg border border-gray-200 w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-semibold text-gray-900">Add Team Member</h2>
          <button onClick={onClose} className="p-1 rounded-md text-gray-400 hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Name *</label>
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Full name" className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Email *</label>
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
              placeholder="email@hiboo.nl" className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Password *</label>
            <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
              placeholder="Min. 8 characters" className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Role *</label>
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
              className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700">
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <p className="text-[10px] text-gray-400 mt-1">
              ADMIN: full access · SETTER: leads only · CLOSER: sales only · COACH: delivery only · FINANCE: finance only
            </p>
          </div>
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
        </div>
        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
          <Button variant="secondary" size="md" onClick={onClose} className="flex-1">Cancel</Button>
          <Button variant="primary" size="md" onClick={handleCreate} disabled={creating} className="flex-1">
            {creating ? 'Creating...' : 'Add member'}
          </Button>
        </div>
      </div>
    </div>
  )
}
