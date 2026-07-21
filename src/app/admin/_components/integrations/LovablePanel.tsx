'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SlideOver } from '@/components/ui/slide-over'
import { Plus, Pencil, Trash2, Link2 } from 'lucide-react'

const iconProps = { strokeWidth: 1.75 } as const

interface Creator { id: string; name: string }

interface AttributionLink {
  id: string
  creator_id: string | null
  platform: string
  slug: string
  url: string | null
  source: string | null
  active: boolean
  created_at: string
  creator_name?: string
}

export function LovablePanel() {
  const [links, setLinks] = useState<AttributionLink[]>([])
  const [creators, setCreators] = useState<Creator[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<AttributionLink | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  const loadData = useCallback(async () => {
    const [linksRes, crRes] = await Promise.all([
      fetch('/api/attribution-links').then(r => r.json()).catch(() => []),
      fetch('/api/creators').then(r => r.json()).catch(() => []),
    ])
    const parsed = (Array.isArray(linksRes) ? linksRes : []).map((l: AttributionLink & { creators?: { name: string } | null }) => ({
      ...l,
      creator_name: l.creators?.name || undefined,
    }))
    setLinks(parsed)
    setCreators((Array.isArray(crRes) ? crRes : []).map((c: Creator) => ({ id: c.id, name: c.name })))
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleDelete = async (id: string) => {
    if (!confirm('Weet je zeker dat je deze link wilt verwijderen?')) return
    await fetch(`/api/attribution-links?id=${id}`, { method: 'DELETE' })
    loadData()
  }

  if (loading) return <div className="text-sm text-gray-400">Laden...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Attributie Links</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">Koppel UTM-slugs aan creators voor automatische attributie</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="w-3.5 h-3.5" {...iconProps} /> Toevoegen
        </Button>
      </div>

      {links.length === 0 ? (
        <div className="bg-white rounded-lg border border-dashed border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500 mb-3">Geen attributie-links geconfigureerd</p>
          <p className="text-xs text-gray-400 mb-4">Maak links aan zodat inkomende leads automatisch aan creators gekoppeld worden.</p>
          <Button variant="primary" size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="w-3.5 h-3.5" {...iconProps} /> Toevoegen
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100">
                <th className="px-5 py-3">Slug</th>
                <th className="px-4 py-3">Creator</th>
                <th className="px-4 py-3">Platform</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {links.map(link => (
                <tr key={link.id} className={!link.active ? 'opacity-50' : ''}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <Link2 className="w-3 h-3 text-gray-400" {...iconProps} />
                      <span className="font-mono text-xs text-gray-900">{link.slug}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{link.creator_name || '—'}</td>
                  <td className="px-4 py-3"><Badge status={link.platform.toUpperCase()} size="sm" /></td>
                  <td className="px-4 py-3 text-gray-500">{link.source || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${link.active ? 'text-emerald-600' : 'text-gray-400'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${link.active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                      {link.active ? 'Actief' : 'Inactief'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setEditing(link)}
                        className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                        <Pencil className="w-3.5 h-3.5" {...iconProps} />
                      </button>
                      <button onClick={() => handleDelete(link.id)}
                        className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" {...iconProps} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(showAdd || editing) && (
        <LinkFormSlideOver
          link={editing}
          creators={creators}
          onClose={() => { setShowAdd(false); setEditing(null) }}
          onSaved={() => { setShowAdd(false); setEditing(null); loadData() }}
        />
      )}
    </div>
  )
}

function LinkFormSlideOver({ link, creators, onClose, onSaved }: {
  link: AttributionLink | null
  creators: Creator[]
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!link
  const [form, setForm] = useState({
    creator_id: link?.creator_id || '',
    platform: link?.platform || 'lovable',
    slug: link?.slug || '',
    url: link?.url || '',
    source: link?.source || '',
    active: link?.active ?? true,
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!form.slug) { alert('Slug is verplicht'); return }
    setSaving(true)
    if (isEdit) {
      await fetch('/api/attribution-links', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: link.id,
          ...form,
          creator_id: form.creator_id || null,
          url: form.url || null,
          source: form.source || null,
        }),
      })
    } else {
      await fetch('/api/attribution-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          creator_id: form.creator_id || null,
          url: form.url || null,
          source: form.source || null,
        }),
      })
    }
    setSaving(false)
    onSaved()
  }

  return (
    <SlideOver open onClose={onClose} title={isEdit ? 'Attributie-link bewerken' : 'Attributie-link toevoegen'}
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
        <Field label="Slug *">
          <input type="text" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })}
            placeholder="bijv. creator-jan"
            className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700" />
          <p className="text-[10px] text-gray-400 mt-1">Wordt gematcht op utm_source, utm_campaign of utm_content</p>
        </Field>
        <Field label="Creator">
          <select value={form.creator_id} onChange={e => setForm({ ...form, creator_id: e.target.value })}
            className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700">
            <option value="">Geen</option>
            {creators.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Platform">
          <select value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })}
            className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700">
            <option value="lovable">Lovable</option>
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
            <option value="youtube">YouTube</option>
            <option value="other">Anders</option>
          </select>
        </Field>
        <Field label="URL">
          <input type="url" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })}
            placeholder="https://..."
            className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700" />
        </Field>
        <Field label="Source">
          <input type="text" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}
            placeholder="bijv. CREATOR"
            className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700" />
          <p className="text-[10px] text-gray-400 mt-1">Wordt als lead-source gezet bij match</p>
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
