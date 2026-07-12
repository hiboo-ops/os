'use client'

import { useState } from 'react'
import { KpiCard } from '@/components/kpi-card'
import { StatusBadge } from '@/components/status-badge'
import { ArrowLeft, Pencil, FileText, MessageSquare, Link as LinkIcon, Copy, Check, PlusCircle, ExternalLink } from 'lucide-react'

const creator = {
  naam: 'Lisa van den Berg',
  initialen: 'LV',
  email: 'lisa@lvbmedia.nl',
  telefoon: '+31 6 12 34 56 78',
  geboortedatum: '14 mrt 1995',
  kvk: '82145923',
  bedrijfsnaam: 'LVB Media B.V.',
  status: 'ACTIVE',
  socials: [
    { platform: 'TikTok', handle: '@lisavandenberg', followers: '124K', color: 'bg-slate-900' },
    { platform: 'Instagram', handle: '@lisa.vdberg', followers: '89,2K', color: 'bg-gradient-to-br from-purple-500 to-pink-500' },
  ],
  contract: { status: 'Ondertekend', datum: '15 januari 2025', verloop: '15 januari 2027' },
  quizLink: 'hiboo.nl/quiz/lisa-vandenberg',
  quizStats: { klikken: 2841, leads: 142, conversie: '5,0%' },
  kpis: { omzetAllTime: 48200, omzetMaand: 4800, cashCollected: 42100, openstaand: 6100, leads: 142, ltv: 52000, ltvCac: '5,8x' },
  omzetPerMaand: [2100, 2800, 3200, 3600, 3900, 4100, 4400, 4600, 4200, 4800, 5200, 4800],
  leadsPerMaand: [6, 8, 10, 12, 14, 11, 13, 15, 12, 14, 16, 11],
  months: ['Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec', 'Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun'],
  recenteLeads: [
    { datum: '28 jun 2026', naam: 'Marieke Hofman', leeftijd: 28, interesse: 'Fitness coaching', budget: '€ 2.000–5.000', probleem: 'Wil online coaching starten maar weet niet waar te beginnen' },
    { datum: '25 jun 2026', naam: 'Pieter de Jong', leeftijd: 34, interesse: 'Voedingsadvies', budget: '€ 1.000–2.000', probleem: 'Zoekt een coach voor gewichtsverlies en gezonder eten' },
    { datum: '22 jun 2026', naam: 'Anna Vermeer', leeftijd: 22, interesse: 'Personal training', budget: '€ 3.000–5.000', probleem: 'Wil wedstrijdklaar worden voor haar eerste bikini-competitie' },
    { datum: '19 jun 2026', naam: 'Rick Bos', leeftijd: 41, interesse: 'Lifestyle coaching', budget: '€ 5.000+', probleem: 'Druk met werk, wil structuur in training en voeding' },
    { datum: '15 jun 2026', naam: 'Sarah Klein', leeftijd: 26, interesse: 'Online programma', budget: '€ 500–1.000', probleem: 'Zoekt betaalbaar online programma voor thuis trainen' },
    { datum: '12 jun 2026', naam: 'Tom van Dijk', leeftijd: 30, interesse: 'Fitness coaching', budget: '€ 2.000–5.000', probleem: 'Wil spiermassa opbouwen, heeft 2 jaar ervaring' },
    { datum: '8 jun 2026', naam: 'Eva Martens', leeftijd: 24, interesse: 'Voedingsadvies', budget: '€ 1.000–2.000', probleem: 'Veganistisch dieet optimaliseren voor sport' },
    { datum: '4 jun 2026', naam: 'Jasper Smit', leeftijd: 37, interesse: 'Personal training', budget: '€ 3.000–5.000', probleem: 'Revalidatie na knieblessure, zoekt begeleid traject' },
  ],
}

function eur(n: number) { return '€ ' + n.toLocaleString('nl-NL') }

export default function CreatorsPage() {
  const [copied, setCopied] = useState(false)
  const [expandedLead, setExpandedLead] = useState<number | null>(null)

  const copyLink = () => {
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-6">
        <a href="/" className="text-sm text-brand-600 hover:text-brand-700 inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Terug naar dashboard
        </a>
      </div>

      {/* Profile Header */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-brand-500 flex items-center justify-center text-white text-xl font-bold shrink-0">{creator.initialen}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900">{creator.naam}</h1>
              <StatusBadge status={creator.status} />
            </div>
            <p className="text-sm text-slate-500 mt-0.5">{creator.bedrijfsnaam}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition">
              <Pencil className="w-4 h-4" /> Bewerken
            </button>
            <button className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition">
              <FileText className="w-4 h-4" /> Contract
            </button>
            <button className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition">
              <MessageSquare className="w-4 h-4" /> Bericht
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Totale omzet" value={eur(creator.kpis.omzetAllTime)} caption={`Deze maand: ${eur(creator.kpis.omzetMaand)}`} />
        <KpiCard label="Cash collected" value={eur(creator.kpis.cashCollected)} caption={`Openstaand: ${eur(creator.kpis.openstaand)}`} captionColor="amber" />
        <KpiCard label="Leads gegenereerd" value={creator.kpis.leads} caption="via persoonlijke quiz-link" />
        <KpiCard label="LTV / LTV:CAC" value={eur(creator.kpis.ltv)} caption={`Ratio: ${creator.kpis.ltvCac}`} captionColor="green" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Personal & Business Info */}
        <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Persoonlijke & zakelijke gegevens</h3>
          <dl className="space-y-3 text-sm">
            {[
              ['Voornaam', 'Lisa'],
              ['Achternaam', 'van den Berg'],
              ['Geboortedatum', creator.geboortedatum],
              ['E-mail', creator.email],
              ['Telefoon', creator.telefoon],
              ['KVK-nummer', creator.kvk],
              ['Bedrijfsnaam', creator.bedrijfsnaam],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <dt className="text-slate-500">{label}</dt>
                <dd className={label === 'E-mail' ? 'text-brand-600' : 'text-slate-900 font-medium'}>{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-5 pt-4 border-t border-slate-100">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Social accounts</h4>
            <div className="space-y-2">
              {creator.socials.map(s => (
                <div key={s.platform} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 ${s.color} rounded flex items-center justify-center`}>
                      <span className="text-white text-[10px] font-bold">{s.platform.slice(0, 2).toUpperCase()}</span>
                    </div>
                    <span className="text-sm text-slate-700">{s.handle}</span>
                  </div>
                  <span className="text-xs font-medium text-slate-500">{s.followers}</span>
                </div>
              ))}
            </div>
            <button className="mt-3 text-xs text-brand-600 hover:text-brand-700 font-medium inline-flex items-center gap-1">
              <PlusCircle className="w-3.5 h-3.5" /> Social toevoegen
            </button>
          </div>
        </div>

        {/* Contract & Quiz */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contract Status */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Contractstatus & documenten</h3>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">{creator.contract.status}</span>
                <span className="text-sm text-slate-500">op {creator.contract.datum}</span>
              </div>
              <div className="text-sm text-slate-500">
                Geldig t/m: <span className="text-slate-700 font-medium">{creator.contract.verloop}</span>
              </div>
              <div className="sm:ml-auto">
                <button className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition">
                  <FileText className="w-4 h-4" /> Download contract (PDF)
                </button>
              </div>
            </div>
          </div>

          {/* Quiz Link */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Persoonlijke quiz-link</h3>
            <div className="flex items-center gap-3 bg-slate-50 rounded-lg px-4 py-3 mb-4">
              <LinkIcon className="w-4 h-4 text-slate-400 shrink-0" />
              <code className="text-sm text-brand-600 font-medium flex-1 truncate">{creator.quizLink}</code>
              <button
                onClick={copyLink}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition shrink-0 ${copied ? 'bg-emerald-500 text-white' : 'bg-brand-600 text-white hover:bg-brand-700'}`}
              >
                {copied ? <><Check className="w-3.5 h-3.5" /> Gekopieerd!</> : <><Copy className="w-3.5 h-3.5" /> Kopieer</>}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-slate-900">{creator.quizStats.klikken.toLocaleString()}</div>
                <div className="text-xs text-slate-500">Klikken</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-slate-900">{creator.quizStats.leads}</div>
                <div className="text-xs text-slate-500">Leads</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-emerald-600">{creator.quizStats.conversie}</div>
                <div className="text-xs text-slate-500">Conversie</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Chart placeholder */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 mb-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Omzet per maand</h3>
        <div className="flex items-end gap-2 h-48">
          {creator.omzetPerMaand.map((v, i) => {
            const max = Math.max(...creator.omzetPerMaand)
            const pct = (v / max) * 100
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-brand-600 rounded-t-md transition-all" style={{ height: `${pct}%` }} />
                <span className="text-[10px] text-slate-400">{creator.months[i]}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Recent Leads Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 mb-8">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">Recente leads via deze creator</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-slate-100">
                <th className="px-6 py-3 w-8"></th>
                <th className="px-4 py-3">Datum</th>
                <th className="px-4 py-3">Naam</th>
                <th className="px-4 py-3">Interesse</th>
                <th className="px-4 py-3">Budget</th>
              </tr>
            </thead>
            <tbody>
              {creator.recenteLeads.map((lead, i) => (
                <>
                  <tr
                    key={`row-${i}`}
                    className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition"
                    onClick={() => setExpandedLead(expandedLead === i ? null : i)}
                  >
                    <td className="px-6 py-3">
                      <ExternalLink className={`w-4 h-4 text-slate-300 transition-transform ${expandedLead === i ? 'rotate-90' : ''}`} />
                    </td>
                    <td className="px-4 py-3 text-slate-500">{lead.datum}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{lead.naam}</td>
                    <td className="px-4 py-3 text-slate-600">{lead.interesse}</td>
                    <td className="px-4 py-3 text-slate-600">{lead.budget}</td>
                  </tr>
                  {expandedLead === i && (
                    <tr key={`detail-${i}`}>
                      <td colSpan={5} className="px-6 py-0">
                        <div className="bg-slate-50 rounded-lg p-4 my-2 ml-6">
                          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Quiz-antwoorden</div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                            <div><span className="text-slate-500">Leeftijd:</span> <span className="text-slate-800 font-medium">{lead.leeftijd} jaar</span></div>
                            <div><span className="text-slate-500">Interesse:</span> <span className="text-slate-800 font-medium">{lead.interesse}</span></div>
                            <div><span className="text-slate-500">Budget:</span> <span className="text-slate-800 font-medium">{lead.budget}</span></div>
                          </div>
                          <div className="mt-2 text-sm">
                            <span className="text-slate-500">Probleem/wens:</span>
                            <p className="text-slate-800 mt-0.5">{lead.probleem}</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
