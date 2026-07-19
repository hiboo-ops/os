'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { SkeletonPage } from '@/components/ui/skeleton'
import { Plus, Trash2, Calendar, X, Link2 } from 'lucide-react'

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

export default function EventsPage() {
  const [events, setEvents] = useState<CalendlyEvent[]>([])
  const [closers, setClosers] = useState<Closer[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  const loadData = async () => {
    const [evRes, closerRes] = await Promise.all([
      fetch('/api/calendly-events').then(r => r.json()),
      supabase.from('closers').select('id, name').order('name'),
    ])
    setEvents(evRes)
    setClosers(closerRes.data || [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const deleteEvent = async (id: string) => {
    await fetch(`/api/calendly-events?id=${id}`, { method: 'DELETE' })
    loadData()
  }

  if (loading) return <SkeletonPage />

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Calendly Events</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage booking links for closing calls</p>
        </div>
        <Button variant="primary" size="md" onClick={() => setShowAdd(true)}>
          <Plus className="w-4 h-4" {...iconProps} /> Add event
        </Button>
      </div>

      {events.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Calendar className="w-8 h-8 text-gray-300 mx-auto mb-3" {...iconProps} />
          <p className="text-sm text-gray-500 mb-4">No events configured yet</p>
          <Button variant="primary" size="md" onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4" {...iconProps} /> Add your first event
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map(ev => (
            <div key={ev.id} className="bg-white rounded-lg border border-gray-200 p-5 flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-5 h-5 text-emerald-600" {...iconProps} />
                </div>
                <div>
                  <div className="font-medium text-gray-900">{ev.name}</div>
                  {ev.description && <div className="text-sm text-gray-500 mt-0.5">{ev.description}</div>}
                  <div className="flex items-center gap-1 mt-1.5 text-xs text-gray-400">
                    <Link2 className="w-3 h-3" {...iconProps} />
                    <a href={ev.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 truncate max-w-[400px]">{ev.url}</a>
                  </div>
                  {ev.closer && (
                    <div className="mt-1.5 text-xs text-gray-500">Default closer: <span className="font-medium text-gray-700">{ev.closer.name}</span></div>
                  )}
                </div>
              </div>
              <button onClick={() => deleteEvent(ev.id)} className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                <Trash2 className="w-4 h-4" {...iconProps} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <AddEventModal closers={closers} onClose={() => setShowAdd(false)} onCreated={loadData} />
      )}
    </div>
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
        name: form.name,
        url: form.url,
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
              placeholder="Optional description"
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
