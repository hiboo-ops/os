'use client'

import { useState, useEffect, useCallback, Fragment } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  getCreatorById, getLeadsForCreator, getRevenueForCreator,
  type Creator, type CreatorLead, type CreatorRevenue, type SocialAccount,
} from '@/lib/queries/creators'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { SkeletonPage } from '@/components/ui/skeleton'
import { SlideOver } from '@/components/ui/slide-over'
import { SteelBars, Sparkline } from '@/components/ui/industry-charts'
import { formatDate, formatDateShort, eur } from '@/lib/format'
import {
  ArrowLeft, Pencil, Mail, Phone, Calendar, FileText, Download,
  Link as LinkIcon, Copy, Check, ChevronRight, Save,
} from 'lucide-react'

const SOCIAL_KEYS = ['tiktok', 'instagram', 'youtube'] as const
const SOCIAL_LABELS: Record<string, string> = { tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube' }

function leadsPerMonth(leads: CreatorLead[], months: string[]): number[] {
  // Bucket op maand-index, uitgelijnd met de laatste 12 maanden van de omzetgrafiek
  const now = new Date()
  const keys: string[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    keys.push(`${d.getFullYear()}-${d.getMonth()}`)
  }
  const buckets = months.map(() => 0)
  for (const lead of leads) {
    if (!lead.created_at) continue
    const d = new Date(lead.created_at)
    const idx = keys.indexOf(`${d.getFullYear()}-${d.getMonth()}`)
    if (idx >= 0) buckets[idx]++
  }
  return buckets
}

export default function CreatorProfilePage() {
  const { id } = useParams<{ id: string }>()
  const [creator, setCreator] = useState<Creator | null>(null)
  const [leads, setLeads] = useState<CreatorLead[]>([])
  const [revenue, setRevenue] = useState<CreatorRevenue | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [expandedLead, setExpandedLead] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const c = await getCreatorById(id)
    setCreator(c)
    if (c) {
      const [l, r] = await Promise.all([
        getLeadsForCreator(c.id, c.name),
        getRevenueForCreator(c.id, c.cac),
      ])
      setLeads(l)
      setRevenue(r)
    }
    setLoading(false)
  }, [id])

  useEffect(() => { loadData() }, [loadData])

  if (loading) return <SkeletonPage />
  if (!creator) return <div className="text-center py-16"><p className="text-sm text-gray-500">Creator niet gevonden</p></div>

  const fullName = [creator.name, creator.last_name].filter(Boolean).join(' ')
  const quizLink = creator.calendly_link || (creator.quiz_utm ? `hiboo.nl/quiz/${creator.quiz_utm}` : null)
  const leadsCount = leads.length
  const conversie = creator.quiz_clicks && creator.quiz_clicks > 0
    ? ((leadsCount / creator.quiz_clicks) * 100).toFixed(1).replace('.', ',') + '%'
    : '—'
  const rev = revenue!
  const sparkData = leadsPerMonth(leads, rev.months)
  const hasLinkedData = rev.clientCount > 0 || leadsCount > 0

  const copyLink = () => {
    if (!quizLink) return
    navigator.clipboard?.writeText(quizLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link href="/creators" className="text-sm text-gray-500 hover:text-gray-700 inline-flex items-center gap-1.5 transition-colors duration-[120ms]">
          <ArrowLeft className="w-4 h-4" strokeWidth={1.75} /> Creators
        </Link>
      </div>

      {/* Header */}
      <Card className="mb-6">
        <div className="px-6 pt-6 pb-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <Avatar name={fullName || creator.name || '?'} size="lg" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-lg font-semibold text-gray-900">{fullName || creator.name}</h1>
                <Badge status={creator.status} />
              </div>
              <div className="flex items-center gap-4 mt-1.5 text-sm text-gray-500 flex-wrap">
                {creator.company_name && <span className="inline-flex items-center gap-1.5">{creator.company_name}</span>}
                {creator.email && <span className="inline-flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" strokeWidth={1.75} /> {creator.email}</span>}
                {creator.phone && <span className="inline-flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" strokeWidth={1.75} /> {creator.phone}</span>}
                {creator.start_date && <span className="inline-flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" strokeWidth={1.75} /> {formatDate(creator.start_date)}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="primary" size="sm" onClick={() => setEditOpen(true)}><Pencil className="w-3.5 h-3.5" /> Bewerken</Button>
              {creator.contract_url && (
                <a href={creator.contract_url} target="_blank" rel="noopener noreferrer">
                  <Button variant="secondary" size="sm"><FileText className="w-3.5 h-3.5" /> Contract</Button>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* KPI strip */}
        <div className="border-t border-gray-100 px-6 py-4 grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'Totale omzet', value: eur(rev.omzetTotaal), caption: `Deze maand: ${eur(rev.omzetDezeMaand)}`, color: 'text-gray-400' },
            { label: 'Cash collected', value: eur(rev.cashCollected), caption: `Openstaand: ${eur(rev.openstaand)}`, color: rev.openstaand > 0 ? 'text-amber-600' : 'text-gray-400' },
            { label: 'Leads gegenereerd', value: leadsCount, caption: 'via persoonlijke quiz-link', color: 'text-gray-400' },
            { label: 'LTV / LTV:CAC', value: rev.ltv > 0 ? eur(Math.round(rev.ltv)) : '—', caption: rev.ltvCac ? `Ratio: ${rev.ltvCac.toFixed(1).replace('.', ',')}x` : 'geen CAC ingevuld', color: rev.ltvCac ? 'text-emerald-600' : 'text-gray-400' },
          ].map(kpi => (
            <div key={kpi.label}>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{kpi.label}</div>
              <div className="text-xl font-bold text-gray-900 tabular-nums">{kpi.value}</div>
              <div className={`text-xs mt-1 ${kpi.color}`}>{kpi.caption}</div>
            </div>
          ))}
        </div>
      </Card>

      {!hasLinkedData && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Er zijn nog geen leads of clients aan deze creator gekoppeld — omzet- en leadcijfers vullen zich zodra dat gebeurt.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Persoonlijke & zakelijke gegevens */}
        <Card className="lg:col-span-1 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Persoonlijke &amp; zakelijke gegevens</h3>
          <dl className="space-y-3 text-sm">
            {[
              ['Voornaam', creator.name],
              ['Achternaam', creator.last_name],
              ['Geboortedatum', creator.birth_date ? formatDate(creator.birth_date) : null],
              ['E-mail', creator.email],
              ['Telefoon', creator.phone],
              ['KVK-nummer', creator.kvk],
              ['Bedrijfsnaam', creator.company_name],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3">
                <dt className="text-gray-500">{label}</dt>
                <dd className="text-gray-900 font-medium text-right">{value || '—'}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-5 pt-4 border-t border-gray-100">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Social accounts</h4>
            <div className="space-y-2">
              {creator.socials && Object.entries(creator.socials).filter(([, s]) => s?.handle).length > 0 ? (
                Object.entries(creator.socials).filter(([, s]) => s?.handle).map(([key, s]) => (
                  <div key={key} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-500 w-16">{SOCIAL_LABELS[key] || key}</span>
                      <span className="text-sm text-gray-700">{s.handle}</span>
                    </div>
                    {s.followers && <span className="text-xs font-medium text-gray-500">{s.followers}</span>}
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-400">Nog geen socials ingevuld.</p>
              )}
            </div>
          </div>
        </Card>

        {/* Contract + Quiz */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Contractstatus &amp; documenten</h3>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-3">
                <Badge status={creator.contract_status || 'ONBEKEND'} />
                {creator.contract_signed_date && <span className="text-sm text-gray-500">op {formatDate(creator.contract_signed_date)}</span>}
              </div>
              <div className="text-sm text-gray-500">
                Geldig t/m: <span className="text-gray-700 font-medium">{creator.contract_end_date ? formatDate(creator.contract_end_date) : '—'}</span>
              </div>
              {creator.contract_url && (
                <div className="sm:ml-auto">
                  <a href={creator.contract_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="secondary" size="sm"><Download className="w-4 h-4" /> Download contract</Button>
                  </a>
                </div>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Persoonlijke quiz-link</h3>
            <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-3 mb-4">
              <LinkIcon className="w-4 h-4 text-gray-400 shrink-0" />
              <code className="text-sm text-accent-700 font-medium flex-1 truncate">{quizLink || 'Geen quiz-link ingesteld'}</code>
              {quizLink && (
                <button onClick={copyLink} className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-medium rounded-lg transition shrink-0 ${copied ? 'bg-emerald-500' : 'bg-accent-700 hover:bg-accent-800'}`}>
                  {copied ? <><Check className="w-3.5 h-3.5" /> Gekopieerd</> : <><Copy className="w-3.5 h-3.5" /> Kopieer</>}
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-gray-900 tabular-nums">{creator.quiz_clicks ?? '—'}</div>
                <div className="text-xs text-gray-500">Klikken</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-gray-900 tabular-nums">{leadsCount}</div>
                <div className="text-xs text-gray-500">Leads</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-emerald-600 tabular-nums">{conversie}</div>
                <div className="text-xs text-gray-500">Conversie</div>
              </div>
            </div>
            <div className="relative h-16"><Sparkline data={sparkData} /></div>
          </Card>
        </div>
      </div>

      {/* Omzet per maand */}
      <Card className="p-6 mb-6">
        <h3 className="font-heading font-semibold uppercase text-[12.5px] tracking-[0.08em] text-ink mb-4">Revenue / Month</h3>
        <div className="relative h-48"><SteelBars labels={rev.months} data={rev.omzetPerMaand} /></div>
      </Card>

      {/* Recente leads */}
      <Card className="mb-8">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Recente leads via deze creator</h3>
        </div>
        {leads.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-gray-400">Nog geen leads gekoppeld aan deze creator.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100">
                  <th className="px-6 py-3 w-8"></th>
                  <th className="px-4 py-3">Datum</th>
                  <th className="px-4 py-3">Naam</th>
                  <th className="px-4 py-3">Bron</th>
                </tr>
              </thead>
              <tbody>
                {leads.map(lead => {
                  const open = expandedLead === lead.id
                  return (
                    <Fragment key={lead.id}>
                      <tr onClick={() => setExpandedLead(open ? null : lead.id)} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors duration-[120ms]">
                        <td className="px-6 py-3"><ChevronRight className={`w-4 h-4 text-gray-300 transition-transform ${open ? 'rotate-90' : ''}`} /></td>
                        <td className="px-4 py-3 text-gray-500 tabular-nums">{formatDateShort(lead.created_at)}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{lead.name || '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{lead.source || '—'}</td>
                      </tr>
                      {open && (
                        <tr>
                          <td colSpan={4} className="px-6 py-0">
                            <div className="bg-gray-50 rounded-lg p-4 my-2 ml-6">
                              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Quiz-antwoorden</div>
                              {lead.quiz_answers && lead.quiz_answers.length > 0 ? (
                                <div className="space-y-2">
                                  {lead.quiz_answers.map((qa, i) => (
                                    <div key={i} className="text-sm">
                                      <span className="text-gray-500">{qa.question}:</span>{' '}
                                      <span className="text-gray-800 font-medium">{qa.answer}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-gray-400">Geen quiz-antwoorden.</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <EditCreatorPanel creator={creator} open={editOpen} onClose={() => setEditOpen(false)} onSaved={() => { setEditOpen(false); loadData() }} />
    </div>
  )
}

// ── Edit panel ────────────────────────────────────────────────────────────
function EditCreatorPanel({ creator, open, onClose, onSaved }: {
  creator: Creator; open: boolean; onClose: () => void; onSaved: () => void
}) {
  const [form, setForm] = useState(creator)
  const [socials, setSocials] = useState<Record<string, SocialAccount>>(creator.socials || {})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { setForm(creator); setSocials(creator.socials || {}) }, [creator])

  const set = (key: keyof Creator, value: unknown) => setForm(prev => ({ ...prev, [key]: value }))
  const setSocial = (platform: string, field: keyof SocialAccount, value: string) =>
    setSocials(prev => ({ ...prev, [platform]: { ...prev[platform], [field]: value } }))

  const save = async () => {
    setSaving(true); setError(null)
    // Lege socials-platforms weglaten
    const cleanSocials: Record<string, SocialAccount> = {}
    for (const [k, v] of Object.entries(socials)) {
      if (v?.handle || v?.followers || v?.url) cleanSocials[k] = v
    }
    const payload = {
      id: creator.id,
      name: form.name, last_name: form.last_name, email: form.email, phone: form.phone,
      status: form.status, company_name: form.company_name, kvk: form.kvk, birth_date: form.birth_date,
      start_date: form.start_date, calendly_link: form.calendly_link, quiz_utm: form.quiz_utm,
      quiz_clicks: form.quiz_clicks === null ? null : Number(form.quiz_clicks),
      cac: form.cac === null ? null : Number(form.cac),
      setup_fee: form.setup_fee === null ? null : Number(form.setup_fee),
      contract_status: form.contract_status, contract_signed_date: form.contract_signed_date,
      contract_end_date: form.contract_end_date, contract_url: form.contract_url,
      socials: Object.keys(cleanSocials).length > 0 ? cleanSocials : null,
    }
    const res = await fetch('/api/creators', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    if (res.ok) onSaved()
    else setError('Opslaan mislukt — controleer je rechten (alleen admin).')
  }

  return (
    <SlideOver open={open} onClose={onClose} title="Creator bewerken" subtitle={creator.name}
      footer={
        <div className="flex items-center justify-between">
          {error ? <span className="text-xs text-red-600">{error}</span> : <span />}
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>Annuleren</Button>
            <Button variant="primary" size="sm" onClick={save}>{saving ? 'Opslaan…' : <><Save className="w-3.5 h-3.5" /> Opslaan</>}</Button>
          </div>
        </div>
      }>
      <div className="px-6 py-5 space-y-5">
        <Section title="Persoonlijk">
          <Field label="Voornaam"><Input value={form.name || ''} onChange={v => set('name', v)} /></Field>
          <Field label="Achternaam"><Input value={form.last_name || ''} onChange={v => set('last_name', v)} /></Field>
          <Field label="Geboortedatum"><Input type="date" value={form.birth_date || ''} onChange={v => set('birth_date', v || null)} /></Field>
          <Field label="E-mail"><Input value={form.email || ''} onChange={v => set('email', v)} /></Field>
          <Field label="Telefoon"><Input value={form.phone || ''} onChange={v => set('phone', v)} /></Field>
        </Section>

        <Section title="Zakelijk">
          <Field label="Bedrijfsnaam"><Input value={form.company_name || ''} onChange={v => set('company_name', v)} /></Field>
          <Field label="KVK-nummer"><Input value={form.kvk || ''} onChange={v => set('kvk', v)} /></Field>
          <Field label="Status"><Input value={form.status || ''} onChange={v => set('status', v)} /></Field>
          <Field label="Startdatum"><Input type="date" value={form.start_date || ''} onChange={v => set('start_date', v || null)} /></Field>
          <Field label="CAC (€)"><Input type="number" value={form.cac ?? ''} onChange={v => set('cac', v)} /></Field>
          <Field label="Setup fee (€)"><Input type="number" value={form.setup_fee ?? ''} onChange={v => set('setup_fee', v)} /></Field>
        </Section>

        <Section title="Contract">
          <Field label="Contractstatus"><Input value={form.contract_status || ''} onChange={v => set('contract_status', v)} placeholder="bijv. ONDERTEKEND" /></Field>
          <Field label="Ondertekend op"><Input type="date" value={form.contract_signed_date || ''} onChange={v => set('contract_signed_date', v || null)} /></Field>
          <Field label="Geldig t/m"><Input type="date" value={form.contract_end_date || ''} onChange={v => set('contract_end_date', v || null)} /></Field>
          <Field label="Contract-URL (PDF)"><Input value={form.contract_url || ''} onChange={v => set('contract_url', v)} /></Field>
        </Section>

        <Section title="Quiz-link">
          <Field label="Calendly-link"><Input value={form.calendly_link || ''} onChange={v => set('calendly_link', v)} /></Field>
          <Field label="Quiz UTM"><Input value={form.quiz_utm || ''} onChange={v => set('quiz_utm', v)} /></Field>
          <Field label="Klikken (handmatig)"><Input type="number" value={form.quiz_clicks ?? ''} onChange={v => set('quiz_clicks', v)} /></Field>
        </Section>

        <Section title="Social accounts">
          {SOCIAL_KEYS.map(platform => (
            <div key={platform} className="rounded-lg border border-gray-100 p-3 space-y-2">
              <div className="text-xs font-semibold text-gray-600">{SOCIAL_LABELS[platform]}</div>
              <Input value={socials[platform]?.handle || ''} onChange={v => setSocial(platform, 'handle', v)} placeholder="@handle" />
              <Input value={socials[platform]?.followers || ''} onChange={v => setSocial(platform, 'followers', v)} placeholder="Volgers (bijv. 124K)" />
              <Input value={socials[platform]?.url || ''} onChange={v => setSocial(platform, 'url', v)} placeholder="URL" />
            </div>
          ))}
        </Section>
      </div>
    </SlideOver>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2.5">{title}</h4>
      <div className="space-y-2.5">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid grid-cols-3 items-center gap-3">
      <span className="text-sm text-gray-500">{label}</span>
      <div className="col-span-2">{children}</div>
    </label>
  )
}

function Input({ value, onChange, type = 'text', placeholder }: {
  value: string | number; onChange: (v: string) => void; type?: string; placeholder?: string
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-accent-700"
    />
  )
}
