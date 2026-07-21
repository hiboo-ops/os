'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SlideOver } from '@/components/ui/slide-over'
import { Plus, Send, Pencil, Trash2 } from 'lucide-react'

const iconProps = { strokeWidth: 1.75 } as const

const PURPOSES = [
  'notifications', 'eod', 'sla', 'new_lead', 'deal_closed',
] as const

interface SlackIntegration {
  id: string
  name: string
  webhook_url: string
  channel: string | null
  purpose: string
  active: boolean
  created_at: string
}

export function SlackPanel() {
  const [integrations, setIntegrations] = useState<SlackIntegration[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<SlackIntegration | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    const res = await fetch('/api/slack-integrations').then(r => r.json()).catch(() => [])
    setIntegrations(Array.isArray(res) ? res : [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleDelete = async (id: string) => {
    if (!confirm('Weet je zeker dat je deze integratie wilt verwijderen?')) return
    await fetch(`/api/slack-integrations?id=${id}`, { method: 'DELETE' })
    loadData()
  }

  const handleTest = async (id: string) => {
    setTesting(id)
    const res = await fetch('/api/slack-integrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true, id }),
    })
    const data = await res.json()
    alert(res.ok ? 'Testbericht verstuurd!' : `Fout: ${data.error || 'Onbekend'}`)
    setTesting(null)
  }

  if (loading) return <div className="text-sm text-gray-400">Laden...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Slack Bots</h3>
        <Button variant="secondary" size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="w-3.5 h-3.5" {...iconProps} /> Toevoegen
        </Button>
      </div>

      {integrations.length === 0 ? (
        <div className="bg-white rounded-lg border border-dashed border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500 mb-3">Geen Slack-integraties geconfigureerd</p>
          <p className="text-xs text-gray-400 mb-4">Voeg webhook-URLs toe om berichten naar Slack-kanalen te sturen.</p>
          <Button variant="primary" size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="w-3.5 h-3.5" {...iconProps} /> Toevoegen
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {integrations.map(si => (
            <div key={si.id} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${si.active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                  <div>
                    <span className="text-sm font-medium text-gray-900">{si.name}</span>
                    {si.channel && <span className="text-xs text-gray-400 ml-2">#{si.channel}</span>}
                  </div>
                  <Badge status={si.purpose.toUpperCase()} size="sm" />
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleTest(si.id)} disabled={testing === si.id}
                    className="p-1.5 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50">
                    <Send className="w-3.5 h-3.5" {...iconProps} />
                  </button>
                  <button onClick={() => setEditing(si)}
                    className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                    <Pencil className="w-3.5 h-3.5" {...iconProps} />
                  </button>
                  <button onClick={() => handleDelete(si.id)}
                    className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" {...iconProps} />
                  </button>
                </div>
              </div>
              <div className="text-[11px] text-gray-400 mt-1 truncate max-w-[400px]">{si.webhook_url}</div>
            </div>
          ))}
        </div>
      )}

      {(showAdd || editing) && (
        <SlackFormSlideOver
          integration={editing}
          onClose={() => { setShowAdd(false); setEditing(null) }}
          onSaved={() => { setShowAdd(false); setEditing(null); loadData() }}
        />
      )}
    </div>
  )
}

function SlackFormSlideOver({ integration, onClose, onSaved }: {
  integration: SlackIntegration | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!integration
  const [form, setForm] = useState({
    name: integration?.name || '',
    webhook_url: integration?.webhook_url || '',
    channel: integration?.channel || '',
    purpose: integration?.purpose || 'notifications',
    active: integration?.active ?? true,
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!form.name || !form.webhook_url || !form.purpose) { alert('Naam, webhook URL en doel zijn verplicht'); return }
    setSaving(true)
    if (isEdit) {
      await fetch('/api/slack-integrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: integration.id, ...form, channel: form.channel || null }),
      })
    } else {
      await fetch('/api/slack-integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, channel: form.channel || null }),
      })
    }
    setSaving(false)
    onSaved()
  }

  return (
    <SlideOver open onClose={onClose} title={isEdit ? 'Slack-integratie bewerken' : 'Slack-integratie toevoegen'}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" size="md" onClick={onClose} className="flex-1">Annuleren</Button>
          <Button variant="primary" size="md" onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? 'Opslaan...' : 'Opslaan'}
          </Button>
        </div>
      }
    >
      <div className="p-6 space-y-4">
        <Field label="Naam *">
          <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="bijv. Leads Bot"
            className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700" />
        </Field>
        <Field label="Webhook URL *">
          <input type="url" value={form.webhook_url} onChange={e => setForm({ ...form, webhook_url: e.target.value })}
            placeholder="https://hooks.slack.com/services/..."
            className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700" />
        </Field>
        <Field label="Kanaal">
          <input type="text" value={form.channel} onChange={e => setForm({ ...form, channel: e.target.value })}
            placeholder="bijv. leads-notificaties"
            className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700" />
        </Field>
        <Field label="Doel *">
          <select value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })}
            className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700">
            {PURPOSES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <p className="text-[10px] text-gray-400 mt-1">Bepaalt welk type berichten naar deze webhook gaan.</p>
        </Field>
        {isEdit && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.active}
              onChange={e => setForm({ ...form, active: e.target.checked })}
              className="rounded border-gray-300 text-accent-700 focus:ring-accent-700" />
            <span className="text-sm text-gray-700">Actief</span>
          </label>
        )}
      </div>
    </SlideOver>
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
