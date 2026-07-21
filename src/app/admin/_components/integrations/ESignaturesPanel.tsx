'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { SlideOver } from '@/components/ui/slide-over'
import { Plus, Pencil, Trash2, CheckCircle, XCircle } from 'lucide-react'

const iconProps = { strokeWidth: 1.75 } as const

interface Package {
  id: string
  name: string
  price: number
  description: string | null
  esign_template_id: string | null
  active: boolean
  created_at: string
}

export function ESignaturesPanel() {
  const [packages, setPackages] = useState<Package[]>([])
  const [loading, setLoading] = useState(true)
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [editing, setEditing] = useState<Package | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  const loadData = useCallback(async () => {
    const [pkgRes, statusRes] = await Promise.all([
      fetch('/api/packages').then(r => r.json()).catch(() => []),
      fetch('/api/esignatures/status').then(r => r.json()).catch(() => ({ configured: null })),
    ])
    setPackages(Array.isArray(pkgRes) ? pkgRes : [])
    setConfigured(statusRes.configured ?? null)
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleDelete = async (id: string) => {
    if (!confirm('Weet je zeker dat je dit pakket wilt verwijderen?')) return
    await fetch(`/api/packages?id=${id}`, { method: 'DELETE' })
    loadData()
  }

  if (loading) return <div className="text-sm text-gray-400">Laden...</div>

  return (
    <div className="space-y-6">
      {/* Connectiestatus */}
      <div>
        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Connectiestatus</h3>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            {configured ? (
              <>
                <CheckCircle className="w-5 h-5 text-emerald-500" {...iconProps} />
                <div>
                  <span className="text-sm font-medium text-gray-900">eSignatures.io verbonden</span>
                  <p className="text-xs text-gray-400 mt-0.5">API-token is geconfigureerd via omgevingsvariabelen.</p>
                </div>
              </>
            ) : (
              <>
                <XCircle className="w-5 h-5 text-red-400" {...iconProps} />
                <div>
                  <span className="text-sm font-medium text-gray-900">Niet verbonden</span>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Stel <code className="bg-gray-100 px-1 rounded text-[11px]">ESIGNATURES_SECRET_TOKEN</code> in als omgevingsvariabele.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Pakketten */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pakketten</h3>
          <Button variant="secondary" size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="w-3.5 h-3.5" {...iconProps} /> Toevoegen
          </Button>
        </div>

        {packages.length === 0 ? (
          <div className="bg-white rounded-lg border border-dashed border-gray-200 p-8 text-center">
            <p className="text-sm text-gray-500 mb-3">Geen pakketten geconfigureerd</p>
            <p className="text-xs text-gray-400 mb-4">Voeg pakketten toe met een naam, prijs en optioneel een eSignatures template.</p>
            <Button variant="primary" size="sm" onClick={() => setShowAdd(true)}>
              <Plus className="w-3.5 h-3.5" {...iconProps} /> Toevoegen
            </Button>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-[11px] text-gray-400 uppercase">
                  <th className="px-4 py-2.5 text-left font-semibold">Naam</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Prijs</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Template ID</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Actief</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Acties</th>
                </tr>
              </thead>
              <tbody>
                {packages.map(pkg => (
                  <tr key={pkg.id} className="border-t border-gray-100">
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">{pkg.name}</span>
                      {pkg.description && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[200px]">{pkg.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-gray-700">EUR {Number(pkg.price).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      {pkg.esign_template_id ? (
                        <code className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded truncate max-w-[160px] inline-block">
                          {pkg.esign_template_id}
                        </code>
                      ) : (
                        <span className="text-xs text-gray-400">Fallback (env)</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className={`w-2 h-2 rounded-full ${pkg.active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setEditing(pkg)}
                          className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                          <Pencil className="w-3.5 h-3.5" {...iconProps} />
                        </button>
                        <button onClick={() => handleDelete(pkg.id)}
                          className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
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
      </div>

      {(showAdd || editing) && (
        <PackageFormSlideOver
          pkg={editing}
          onClose={() => { setShowAdd(false); setEditing(null) }}
          onSaved={() => { setShowAdd(false); setEditing(null); loadData() }}
        />
      )}
    </div>
  )
}

function PackageFormSlideOver({ pkg, onClose, onSaved }: {
  pkg: Package | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!pkg
  const [form, setForm] = useState({
    name: pkg?.name || '',
    price: pkg?.price ?? '',
    description: pkg?.description || '',
    esign_template_id: pkg?.esign_template_id || '',
    active: pkg?.active ?? true,
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!form.name || form.price === '') {
      alert('Naam en prijs zijn verplicht')
      return
    }
    setSaving(true)
    if (isEdit) {
      await fetch('/api/packages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: pkg.id,
          name: form.name,
          price: Number(form.price),
          description: form.description || null,
          esign_template_id: form.esign_template_id || null,
          active: form.active,
        }),
      })
    } else {
      await fetch('/api/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          price: Number(form.price),
          description: form.description || null,
          esign_template_id: form.esign_template_id || null,
          active: form.active,
        }),
      })
    }
    setSaving(false)
    onSaved()
  }

  return (
    <SlideOver open onClose={onClose} title={isEdit ? 'Pakket bewerken' : 'Pakket toevoegen'}
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
            placeholder="bijv. Growth Package"
            className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700" />
        </Field>
        <Field label="Prijs *">
          <div className="mt-1.5 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">EUR</span>
            <input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value === '' ? '' : Number(e.target.value) })}
              placeholder="0"
              className="w-full text-sm border border-gray-200 rounded-lg pl-12 pr-3 py-2.5 bg-white tabular-nums focus:outline-none focus:ring-2 focus:ring-accent-700" />
          </div>
        </Field>
        <Field label="Beschrijving">
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="Optionele beschrijving..."
            rows={2}
            className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-accent-700" />
        </Field>
        <Field label="eSignatures Template ID">
          <input type="text" value={form.esign_template_id} onChange={e => setForm({ ...form, esign_template_id: e.target.value })}
            placeholder="Leeg = fallback naar env variabele"
            className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700" />
          <p className="text-[10px] text-gray-400 mt-1">Template ID uit eSignatures.io. Laat leeg om de standaard template te gebruiken.</p>
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
