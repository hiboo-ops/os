'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SlideOver } from '@/components/ui/slide-over'
import { Plus, Pencil } from 'lucide-react'

const iconProps = { strokeWidth: 1.75 } as const
const ROLES = ['ADMIN', 'CLOSER', 'SETTER', 'COACH', 'FINANCE', 'PARTNER_MANAGER', 'CREATOR'] as const

interface TeamMember {
  id: string
  user_id: string
  email: string
  name: string
  role: string
  active: boolean
  created_at: string
  closer_id: string | null
  setter_id: string | null
  coach_id: string | null
  creator_id: string | null
}

export function TeamTab() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<TeamMember | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  const loadData = useCallback(async () => {
    const res = await fetch('/api/team').then(r => r.json()).catch(() => [])
    setMembers(Array.isArray(res) ? res : [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  if (loading) return <div className="text-sm text-gray-400">Laden...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Team Members</h3>
        <Button variant="secondary" size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="w-3.5 h-3.5" {...iconProps} /> Toevoegen
        </Button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100">
              <th className="px-5 py-3">Naam</th>
              <th className="px-4 py-3">E-mail</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 w-20"></th>
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
                    {m.active ? 'Actief' : 'Inactief'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => setEditing(m)}
                    className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                    <Pencil className="w-3.5 h-3.5" {...iconProps} />
                  </button>
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-gray-400">Geen teamleden</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <AddMemberSlideOver
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); loadData() }}
        />
      )}

      {editing && (
        <EditMemberSlideOver
          member={editing}
          members={members}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); loadData() }}
        />
      )}
    </div>
  )
}

/* ── Add Member ── */
function AddMemberSlideOver({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'SETTER' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!form.name || !form.email || !form.password) { setError('Alle velden zijn verplicht'); return }
    if (form.password.length < 8) { setError('Wachtwoord moet minimaal 8 tekens zijn'); return }
    setSaving(true)
    setError('')

    const res = await fetch('/api/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Aanmaken mislukt')
      setSaving(false)
      return
    }

    setSaving(false)
    onSaved()
  }

  return (
    <SlideOver open onClose={onClose} title="Teamlid toevoegen"
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" size="md" onClick={onClose} className="flex-1">Annuleren</Button>
          <Button variant="primary" size="md" onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? 'Aanmaken...' : 'Aanmaken'}
          </Button>
        </div>
      }
    >
      <div className="p-6 space-y-4">
        <Field label="Naam *">
          <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="Volledige naam"
            className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700" />
        </Field>
        <Field label="E-mail *">
          <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
            placeholder="email@hiboo.nl"
            className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700" />
        </Field>
        <Field label="Wachtwoord *">
          <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
            placeholder="Min. 8 tekens"
            className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700" />
        </Field>
        <Field label="Rol *">
          <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
            className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700">
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <p className="text-[10px] text-gray-400 mt-1">
            ADMIN: volledig · CLOSER: sales (eigen) · SETTER: booked calls + EOD · FINANCE: finance · PARTNER_MANAGER: creators + partner · COACH: delivery · CREATOR: eigen dashboard + EOD (koppel via bewerken → Creator koppeling)
          </p>
        </Field>
        {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
      </div>
    </SlideOver>
  )
}

/* ── Edit Member ── */
function EditMemberSlideOver({ member, members, onClose, onSaved }: {
  member: TeamMember
  members: TeamMember[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    name: member.name,
    role: member.role,
    active: member.active,
    closer_id: member.closer_id || '',
    setter_id: member.setter_id || '',
    coach_id: member.coach_id || '',
    creator_id: member.creator_id || '',
  })
  const [saving, setSaving] = useState(false)
  const [creatorsList, setCreatorsList] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    fetch('/api/creators').then(r => r.json()).then(d => setCreatorsList(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  const closers = members.filter(m => m.role === 'CLOSER' || m.role === 'ADMIN')
  const settersList = members.filter(m => m.role === 'SETTER' || m.role === 'ADMIN')
  const coaches = members.filter(m => m.role === 'COACH' || m.role === 'ADMIN')

  const handleSave = async () => {
    setSaving(true)
    await fetch('/api/team', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: member.id,
        ...form,
        closer_id: form.closer_id || null,
        setter_id: form.setter_id || null,
        coach_id: form.coach_id || null,
        creator_id: form.creator_id || null,
      }),
    })
    setSaving(false)
    onSaved()
  }

  return (
    <SlideOver open onClose={onClose} title={`${member.name} bewerken`} subtitle={member.email}
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
        <Field label="Naam">
          <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700" />
        </Field>
        <Field label="Rol">
          <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
            className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700">
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Closer koppeling">
          <select value={form.closer_id} onChange={e => setForm({ ...form, closer_id: e.target.value })}
            className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700">
            <option value="">Geen</option>
            {closers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Setter koppeling">
          <select value={form.setter_id} onChange={e => setForm({ ...form, setter_id: e.target.value })}
            className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700">
            <option value="">Geen</option>
            {settersList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Coach koppeling">
          <select value={form.coach_id} onChange={e => setForm({ ...form, coach_id: e.target.value })}
            className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700">
            <option value="">Geen</option>
            {coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Creator koppeling (voor CREATOR-login)">
          <select value={form.creator_id} onChange={e => setForm({ ...form, creator_id: e.target.value })}
            className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700">
            <option value="">Geen</option>
            {creatorsList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.active}
            onChange={e => setForm({ ...form, active: e.target.checked })}
            className="rounded border-gray-300 text-accent-700 focus:ring-accent-700" />
          <span className="text-sm text-gray-700">Actief</span>
        </label>
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
