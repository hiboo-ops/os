'use client'

import { useState, useEffect, useCallback } from 'react'
import { SkeletonPage } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/format'
import { X, Check, GripVertical } from 'lucide-react'

interface Submission {
  id: string
  created_at: string
  status: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  answers: Record<string, unknown>
  notes: string | null
  signature: string | null
}

const STAGES = [
  { key: 'NEW', label: 'Nieuw', color: 'bg-blue-500' },
  { key: 'IN_PROGRESS', label: 'In behandeling', color: 'bg-amber-500' },
  { key: 'INTERVIEW', label: 'Gesprek', color: 'bg-violet-500' },
  { key: 'APPROVED', label: 'Goedgekeurd', color: 'bg-emerald-500' },
  { key: 'REJECTED', label: 'Afgewezen', color: 'bg-red-500' },
]

export default function PartnerCrmPage() {
  const [subs, setSubs] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Submission | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)

  const load = useCallback(() => {
    return fetch('/api/creator-onboarding').then(r => r.json()).then(d => setSubs(Array.isArray(d) ? d : []))
  }, [])
  useEffect(() => { load().finally(() => setLoading(false)) }, [load])

  const move = async (id: string, status: string) => {
    const sub = subs.find(s => s.id === id)
    if (!sub || sub.status === status) return
    setSubs(prev => prev.map(s => s.id === id ? { ...s, status } : s))
    if (selected?.id === id) setSelected(s => s ? { ...s, status } : s)
    await fetch('/api/creator-onboarding', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) })
  }

  if (loading) return <SkeletonPage />

  const byStage = (key: string) => subs.filter(s => (s.status || 'NEW') === key)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Partner CRM</h1>
        <p className="text-sm text-gray-500 mt-1">Onboarding-aanmeldingen — sleep kaarten tussen kolommen, klik voor details en notities</p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map(stage => {
          const cards = byStage(stage.key)
          return (
            <div
              key={stage.key}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); if (dragId) move(dragId, stage.key); setDragId(null) }}
              className="w-72 shrink-0"
            >
              <div className="flex items-center gap-2 mb-3 px-1">
                <span className={`w-2 h-2 rounded-full ${stage.color}`} />
                <span className="text-sm font-semibold text-gray-700">{stage.label}</span>
                <span className="text-xs text-gray-400">{cards.length}</span>
              </div>
              <div className="space-y-2 min-h-[120px] rounded-lg bg-gray-50/60 p-2">
                {cards.map(sub => (
                  <div
                    key={sub.id}
                    draggable
                    onDragStart={() => setDragId(sub.id)}
                    onDragEnd={() => setDragId(null)}
                    onClick={() => setSelected(sub)}
                    className="group bg-white rounded-lg border border-gray-200 p-3 cursor-pointer hover:border-gray-300 hover:shadow-sm transition"
                  >
                    <div className="flex items-start gap-2">
                      <GripVertical className="w-3.5 h-3.5 text-gray-300 mt-0.5 shrink-0 group-hover:text-gray-400" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-900 truncate">{[sub.first_name, sub.last_name].filter(Boolean).join(' ') || 'Onbekend'}</div>
                        <div className="text-xs text-gray-400 truncate">{sub.email}</div>
                        <div className="text-[11px] text-gray-400 mt-1.5">{formatDate(sub.created_at)}</div>
                        {sub.notes && <div className="text-[11px] text-gray-500 mt-1 line-clamp-2 bg-gray-50 rounded px-2 py-1">{sub.notes}</div>}
                      </div>
                    </div>
                  </div>
                ))}
                {cards.length === 0 && <div className="text-xs text-gray-300 text-center py-6">Leeg</div>}
              </div>
            </div>
          )
        })}
      </div>

      {selected && <Detail sub={selected} onClose={() => setSelected(null)} onSaved={(s) => { setSubs(prev => prev.map(x => x.id === s.id ? s : x)); setSelected(s) }} onMove={move} />}
    </div>
  )
}

function Detail({ sub, onClose, onSaved, onMove }: { sub: Submission; onClose: () => void; onSaved: (s: Submission) => void; onMove: (id: string, status: string) => void }) {
  const [notes, setNotes] = useState(sub.notes || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const saveNotes = async () => {
    setSaving(true)
    await fetch('/api/creator-onboarding', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: sub.id, notes }) })
    onSaved({ ...sub, notes })
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-gray-50 shadow-lg border-l border-gray-200 flex flex-col">
        <div className="shrink-0 bg-white border-b border-gray-100 px-6 py-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{[sub.first_name, sub.last_name].filter(Boolean).join(' ') || 'Onbekend'}</h2>
            <div className="text-xs text-gray-400 mt-0.5">{sub.email}{sub.phone ? ` · ${sub.phone}` : ''}</div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200"><X className="w-5 h-5 text-gray-500" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Status */}
          <div className="flex flex-wrap gap-2">
            {STAGES.map(st => (
              <button key={st.key} onClick={() => onMove(sub.id, st.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${sub.status === st.key ? 'border-accent-700 bg-accent-50 text-accent-800' : 'border-gray-200 text-gray-500 hover:bg-white'}`}>
                {st.label}
              </button>
            ))}
          </div>

          {/* Notities */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Notities</div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} placeholder="Voeg notities toe..."
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-accent-700" />
            <div className="flex justify-end mt-2">
              <button onClick={saveNotes} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent-700 text-white text-sm font-medium hover:bg-accent-800 disabled:opacity-50">
                {saved ? <><Check className="w-4 h-4" /> Opgeslagen</> : saving ? 'Opslaan...' : 'Notitie opslaan'}
              </button>
            </div>
          </div>

          {/* Antwoorden */}
          <Answers answers={sub.answers} signature={sub.signature} />
        </div>
      </div>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Answers({ answers, signature }: { answers: any; signature: string | null }) {
  const sections: [string, string][] = [
    ['person', 'Persoonsgegevens'], ['business', 'Bedrijfsgegevens'], ['socials', 'Socialmedia'],
    ['content', 'Content & beschikbaarheid'], ['motivation', 'Motivatie'], ['experience', 'Ervaring'],
    ['about', 'Over jou'], ['additional', 'Aanvullend'], ['declaration', 'Verklaring'],
  ]
  const render = (val: unknown): string => {
    if (val == null || val === '') return '—'
    if (Array.isArray(val)) return val.length ? val.join(', ') : '—'
    if (typeof val === 'object') return ''
    return String(val)
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {sections.map(([key, title]) => {
        const data = answers?.[key]
        if (!data || typeof data !== 'object') return null
        return (
          <div key={key} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-xs font-semibold text-accent-700 uppercase tracking-wide mb-2">{title}</div>
            <dl className="space-y-1.5">
              {Object.entries(data).map(([k, v]) => {
                if (v && typeof v === 'object' && !Array.isArray(v)) {
                  return (
                    <div key={k} className="text-xs">
                      <dt className="text-gray-500 font-medium capitalize">{k}</dt>
                      <dd className="text-gray-800 pl-2">{Object.entries(v as Record<string, unknown>).map(([kk, vv]) => `${kk}: ${render(vv)}`).join(' · ')}</dd>
                    </div>
                  )
                }
                return (
                  <div key={k} className="text-xs">
                    <dt className="text-gray-500 capitalize inline">{k.replace(/_/g, ' ')}: </dt>
                    <dd className="text-gray-800 inline">{render(v)}</dd>
                  </div>
                )
              })}
            </dl>
          </div>
        )
      })}
      {signature && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs font-semibold text-accent-700 uppercase tracking-wide mb-2">Handtekening</div>
          <div className="text-sm text-gray-800 italic">{signature}</div>
        </div>
      )}
    </div>
  )
}
