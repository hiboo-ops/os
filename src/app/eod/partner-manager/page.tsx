'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { CheckCircle2 } from 'lucide-react'

export default function PartnerManagerEodPage() {
  const [userName, setUserName] = useState('')
  const [teamMemberId, setTeamMemberId] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))

  // Outbound & Activiteit
  const [aantalOutbounds, setAantalOutbounds] = useState('')
  const [aantalFollowUps, setAantalFollowUps] = useState('')

  // Deals / Gesprekken
  const [aantalDeals, setAantalDeals] = useState('')
  const [samenvattingDeals, setSamenvattingDeals] = useState('')

  // Nieuwe Partners
  const [nieuwePartnersOnboard, setNieuwePartnersOnboard] = useState('')
  const [mondeling, setMondeling] = useState('')
  const [totaalActief, setTotaalActief] = useState('')

  // CRM & Taken
  const [crmBijgewerkt, setCrmBijgewerkt] = useState<'ja' | 'nee' | ''>('')
  const [takenAfgevinkt, setTakenAfgevinkt] = useState<'ja' | 'nee' | ''>('')
  const [openPunten, setOpenPunten] = useState('')

  // Reflectie
  const [watWerkteGoed, setWatWerkteGoed] = useState('')
  const [hulpNodig, setHulpNodig] = useState('')
  const [idee, setIdee] = useState('')

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/me')
      .then(r => r.json())
      .then(data => {
        if (data.name) setUserName(data.name)
        if (data.teamMemberId) setTeamMemberId(data.teamMemberId)
      })
      .catch(() => {})
  }, [])

  const handleSubmit = async () => {
    if (!teamMemberId) {
      setError('Gebruiker niet gevonden. Herlaad de pagina.')
      return
    }

    setSaving(true)
    setError('')
    setSaved(false)

    const answers = {
      outbound_activiteit: {
        aantal_outbounds: Number(aantalOutbounds) || 0,
        aantal_follow_ups: Number(aantalFollowUps) || 0,
      },
      deals_gesprekken: {
        aantal_deals_besproken: Number(aantalDeals) || 0,
        samenvatting: samenvattingDeals,
      },
      nieuwe_partners: {
        volledig_onboard: Number(nieuwePartnersOnboard) || 0,
        mondeling_akkoord: Number(mondeling) || 0,
        totaal_actief: Number(totaalActief) || 0,
      },
      crm_taken: {
        crm_bijgewerkt: crmBijgewerkt,
        taken_afgevinkt: takenAfgevinkt,
        open_punten: openPunten,
      },
      reflectie: {
        wat_werkte_goed: watWerkteGoed,
        hulp_nodig: hulpNodig,
        idee_meer_partners: idee,
      },
    }

    const { error: dbError } = await supabase
      .from('eod_reports')
      .upsert(
        {
          report_date: date,
          role_type: 'PARTNER_MANAGER',
          team_member_id: teamMemberId,
          submitted_name: userName,
          answers,
        },
        { onConflict: 'team_member_id,role_type,report_date' }
      )

    setSaving(false)
    if (dbError) {
      setError('Opslaan mislukt: ' + dbError.message)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
  }

  const inputClass = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent'
  const numberInputClass = 'w-32 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent'

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">EOD Partner Manager</h1>
        <p className="text-sm text-gray-500 mt-1">Dagelijkse rapportage partnermanagement</p>
      </div>

      <div className="space-y-6 max-w-3xl">
        {/* Header */}
        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Datum</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Naam</label>
              <input
                type="text"
                value={userName}
                readOnly
                className={`${inputClass} bg-gray-50`}
              />
            </div>
          </div>
        </section>

        {/* Outbound & Activiteit */}
        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Outbound & Activiteit</h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Aantal outbounds naar potentiele partners (emails/DM&apos;s/calls samen)</label>
              <input
                type="number"
                min="0"
                value={aantalOutbounds}
                onChange={e => setAantalOutbounds(e.target.value)}
                className={numberInputClass}
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Aantal follow-ups naar bestaande leads/partners</label>
              <input
                type="number"
                min="0"
                value={aantalFollowUps}
                onChange={e => setAantalFollowUps(e.target.value)}
                className={numberInputClass}
                placeholder="0"
              />
            </div>
          </div>
        </section>

        {/* Deals / Gesprekken */}
        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Deals / Gesprekken</h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Aantal partnerdeals inhoudelijk besproken</label>
              <input
                type="number"
                min="0"
                value={aantalDeals}
                onChange={e => setAantalDeals(e.target.value)}
                className={numberInputClass}
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Samenvatting belangrijkste deals (partnernaam + dealtype + volgende stap)</label>
              <textarea
                value={samenvattingDeals}
                onChange={e => setSamenvattingDeals(e.target.value)}
                className={`${inputClass} resize-none`}
                rows={4}
                placeholder="Bijv: Nike — sponsordeal — contractvoorstel sturen vrijdag..."
              />
            </div>
          </div>
        </section>

        {/* Nieuwe Partners */}
        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Nieuwe Partners</h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Nieuwe partners volledig onboard (aantal)</label>
              <input
                type="number"
                min="0"
                value={nieuwePartnersOnboard}
                onChange={e => setNieuwePartnersOnboard(e.target.value)}
                className={numberInputClass}
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Mondeling akkoord, onboarding bezig (aantal)</label>
              <input
                type="number"
                min="0"
                value={mondeling}
                onChange={e => setMondeling(e.target.value)}
                className={numberInputClass}
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Totaal actieve partners in portfolio (aantal)</label>
              <input
                type="number"
                min="0"
                value={totaalActief}
                onChange={e => setTotaalActief(e.target.value)}
                className={numberInputClass}
                placeholder="0"
              />
            </div>
          </div>
        </section>

        {/* CRM & Taken */}
        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">CRM & Taken</h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-500 mb-2 block">Alle partners/deals bijgewerkt in CRM?</label>
              <div className="flex gap-4">
                {(['ja', 'nee'] as const).map(opt => (
                  <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="crm-bijgewerkt"
                      checked={crmBijgewerkt === opt}
                      onChange={() => setCrmBijgewerkt(opt)}
                      className="accent-accent-600"
                    />
                    <span className="text-sm text-gray-700 capitalize">{opt}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-2 block">Alle taken afgevinkt?</label>
              <div className="flex gap-4">
                {(['ja', 'nee'] as const).map(opt => (
                  <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="taken-afgevinkt"
                      checked={takenAfgevinkt === opt}
                      onChange={() => setTakenAfgevinkt(opt)}
                      className="accent-accent-600"
                    />
                    <span className="text-sm text-gray-700 capitalize">{opt}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Open punten voor morgen</label>
              <textarea
                value={openPunten}
                onChange={e => setOpenPunten(e.target.value)}
                className={`${inputClass} resize-none`}
                rows={3}
                placeholder="Wat moet er morgen als eerste opgepakt worden..."
              />
            </div>
          </div>
        </section>

        {/* Reflectie */}
        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Reflectie</h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Wat werkte goed in outreach?</label>
              <textarea
                value={watWerkteGoed}
                onChange={e => setWatWerkteGoed(e.target.value)}
                className={`${inputClass} resize-none`}
                rows={3}
                placeholder="Welke aanpak leverde het meeste op..."
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Waar hulp/besluit management nodig?</label>
              <textarea
                value={hulpNodig}
                onChange={e => setHulpNodig(e.target.value)}
                className={`${inputClass} resize-none`}
                rows={3}
                placeholder="Waar loop je tegenaan..."
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">1 idee voor meer/betere partners deze week?</label>
              <textarea
                value={idee}
                onChange={e => setIdee(e.target.value)}
                className={`${inputClass} resize-none`}
                rows={2}
                placeholder="Jouw beste idee..."
              />
            </div>
          </div>
        </section>

        {/* Submit */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-accent-600 text-white rounded-lg text-sm font-medium hover:bg-accent-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Opslaan...' : 'Opslaan'}
          </button>
          {saved && (
            <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
              <CheckCircle2 className="w-4 h-4" /> Opgeslagen
            </span>
          )}
          {error && (
            <span className="text-sm text-red-600">{error}</span>
          )}
        </div>
      </div>
    </div>
  )
}
