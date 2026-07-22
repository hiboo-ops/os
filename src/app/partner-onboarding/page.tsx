'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'

const PLATFORMS = [
  { key: 'instagram', label: 'Instagram' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'x', label: 'X (Twitter)' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'other', label: 'Anders' },
]
const FREQUENCIES = ['Twee keer per dag', 'Eén keer per dag', 'Om de dag']
const CONTENT_TYPES = [
  'Korte video’s', 'Lange video’s', 'Praatvideo’s', 'Stories', 'Livestreams',
  'Foto’s en carrousels', 'Tekstuele berichten', 'Podcasts', 'Anders',
]

type Social = { username: string; url: string; followers: string; avg_views: string; avg_reach: string }
const emptySocial = (): Social => ({ username: '', url: '', followers: '', avg_views: '', avg_reach: '' })

export default function PartnerOnboardingPage() {
  const today = new Date().toISOString().split('T')[0]

  const [person, setPerson] = useState({ first_name: '', last_name: '', birth_date: '', address: '', postcode: '', city: '', country: '', phone: '', email: '' })
  const [business, setBusiness] = useState({ company_name: '', trade_name: '', legal_form: '', kvk: '', vat: '', business_email: '', business_phone: '', business_address: '', iban: '', account_holder: '' })
  const [socialsOn, setSocialsOn] = useState<Record<string, boolean>>({})
  const [otherPlatform, setOtherPlatform] = useState('')
  const [socials, setSocials] = useState<Record<string, Social>>({})
  const [content, setContent] = useState<{ frequency: string; types: string[]; types_other: string; face: string; guidelines: string }>({ frequency: '', types: [], types_other: '', face: '', guidelines: '' })
  const [motivation, setMotivation] = useState({ why_partner: '', what_appeals: '', expectation: '', results_goal: '' })
  const [experience, setExperience] = useState({ has: '', models: '', promoted: '', affiliate: '', results: '' })
  const [about, setAbout] = useState({ describe: '', unique: '', strengths: '', interests: '', audience: '', why_fit: '', develop: '' })
  const [additional, setAdditional] = useState({ how_found: '', other_brands: '', considerations: '', questions: '' })
  const [declaration, setDeclaration] = useState({ full_name: '', date: today, signature: '', agreed: false })

  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const toggleType = (t: string) => setContent(c => ({ ...c, types: c.types.includes(t) ? c.types.filter(x => x !== t) : [...c.types, t] }))
  const toggleSocial = (k: string) => {
    setSocialsOn(s => ({ ...s, [k]: !s[k] }))
    setSocials(s => s[k] ? s : { ...s, [k]: emptySocial() })
  }
  const setSocialField = (k: string, f: keyof Social, v: string) => setSocials(s => ({ ...s, [k]: { ...(s[k] || emptySocial()), [f]: v } }))

  const submit = async () => {
    if (!person.first_name.trim() || !person.email.trim()) { setError('Voornaam en e-mailadres zijn verplicht.'); scrollTo({ top: 0, behavior: 'smooth' }); return }
    if (!declaration.agreed || !declaration.full_name.trim()) { setError('Vul de verklaring in (volledige naam + akkoord).'); return }
    setSubmitting(true); setError('')

    const chosenSocials: Record<string, Social & { platform: string }> = {}
    for (const p of PLATFORMS) {
      if (socialsOn[p.key]) {
        chosenSocials[p.key] = { platform: p.key === 'other' ? (otherPlatform || 'Anders') : p.label, ...(socials[p.key] || emptySocial()) }
      }
    }

    const answers = {
      person, business,
      socials: chosenSocials,
      content: { ...content, types: content.types },
      motivation, experience, about, additional,
      declaration: { full_name: declaration.full_name, date: declaration.date, signature: declaration.signature },
    }

    try {
      const res = await fetch('/api/creator-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: person.first_name, last_name: person.last_name, email: person.email, phone: person.phone,
          signature: declaration.signature, signed_date: declaration.date, answers,
        }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || 'Er ging iets mis. Probeer het opnieuw.'); return }
      setDone(true); scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      setError('Netwerkfout. Probeer het opnieuw.')
    } finally { setSubmitting(false) }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm max-w-lg w-full p-10 text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-5"><Check className="w-7 h-7 text-emerald-600" /></div>
          <h1 className="text-2xl font-semibold text-gray-900">Bedankt voor je aanmelding</h1>
          <p className="text-gray-500 mt-3">We hebben je gegevens ontvangen. Ons team beoordeelt je aanmelding en neemt contact met je op. Let op: het invullen betekent niet automatisch dat je wordt toegelaten tot het partnerprogramma.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-9 h-9 rounded-lg bg-accent-700 flex items-center justify-center"><span className="text-white font-bold">H</span></div>
            <span className="font-semibold text-gray-900">HIBOO</span>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">Onboardingformulier Partner</h1>
          <p className="text-gray-500 mt-2">Welkom bij het partnerprogramma van HIBOO. Met dit formulier leren we jou, jouw onderneming en jouw online kanalen beter kennen.</p>
        </div>

        {error && <div className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</div>}

        <div className="space-y-6">
          <Section n={1} title="Persoonsgegevens">
            <Grid>
              <T label="Voornaam *" value={person.first_name} onChange={v => setPerson({ ...person, first_name: v })} />
              <T label="Achternaam" value={person.last_name} onChange={v => setPerson({ ...person, last_name: v })} />
              <T label="Geboortedatum" type="date" value={person.birth_date} onChange={v => setPerson({ ...person, birth_date: v })} />
              <T label="Telefoonnummer" value={person.phone} onChange={v => setPerson({ ...person, phone: v })} />
              <T label="E-mailadres *" type="email" value={person.email} onChange={v => setPerson({ ...person, email: v })} />
              <T label="Land" value={person.country} onChange={v => setPerson({ ...person, country: v })} />
            </Grid>
            <T label="Adres" value={person.address} onChange={v => setPerson({ ...person, address: v })} />
            <Grid>
              <T label="Postcode" value={person.postcode} onChange={v => setPerson({ ...person, postcode: v })} />
              <T label="Woonplaats" value={person.city} onChange={v => setPerson({ ...person, city: v })} />
            </Grid>
          </Section>

          <Section n={2} title="Bedrijfsgegevens">
            <Grid>
              <T label="Bedrijfsnaam" value={business.company_name} onChange={v => setBusiness({ ...business, company_name: v })} />
              <T label="Handelsnaam" value={business.trade_name} onChange={v => setBusiness({ ...business, trade_name: v })} />
              <T label="Rechtsvorm" value={business.legal_form} onChange={v => setBusiness({ ...business, legal_form: v })} />
              <T label="KvK / registratienummer" value={business.kvk} onChange={v => setBusiness({ ...business, kvk: v })} />
              <T label="Btw-nummer" value={business.vat} onChange={v => setBusiness({ ...business, vat: v })} />
              <T label="Zakelijk e-mailadres" value={business.business_email} onChange={v => setBusiness({ ...business, business_email: v })} />
              <T label="Zakelijk telefoonnummer" value={business.business_phone} onChange={v => setBusiness({ ...business, business_phone: v })} />
              <T label="Vestigingsadres" value={business.business_address} onChange={v => setBusiness({ ...business, business_address: v })} />
              <T label="IBAN (uitbetalingen)" value={business.iban} onChange={v => setBusiness({ ...business, iban: v })} />
              <T label="Naam rekeninghouder" value={business.account_holder} onChange={v => setBusiness({ ...business, account_holder: v })} />
            </Grid>
          </Section>

          <Section n={3} title="Socialmediakanalen">
            <p className="text-sm text-gray-500 -mt-2 mb-3">Welke platformen wil je gebruiken om HIBOO te promoten? Vink aan en vul de gegevens in.</p>
            <div className="space-y-3">
              {PLATFORMS.map(p => (
                <div key={p.key} className={`rounded-lg border ${socialsOn[p.key] ? 'border-accent-300 bg-accent-50/30' : 'border-gray-200'} p-3`}>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={!!socialsOn[p.key]} onChange={() => toggleSocial(p.key)} className="w-4 h-4 rounded border-gray-300 text-accent-700 focus:ring-accent-700" />
                    <span className="text-sm font-medium text-gray-800">{p.label}</span>
                    {p.key === 'other' && socialsOn.other && (
                      <input value={otherPlatform} onChange={e => setOtherPlatform(e.target.value)} placeholder="namelijk..." className="ml-2 text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent-700" />
                    )}
                  </label>
                  {socialsOn[p.key] && (
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <T small label="Gebruikersnaam" value={socials[p.key]?.username || ''} onChange={v => setSocialField(p.key, 'username', v)} />
                      <T small label="Link naar profiel" value={socials[p.key]?.url || ''} onChange={v => setSocialField(p.key, 'url', v)} />
                      <T small label="Aantal volgers" value={socials[p.key]?.followers || ''} onChange={v => setSocialField(p.key, 'followers', v)} />
                      <T small label="Gem. weergaven per post" value={socials[p.key]?.avg_views || ''} onChange={v => setSocialField(p.key, 'avg_views', v)} />
                      <T small label="Gem. bereik per maand" value={socials[p.key]?.avg_reach || ''} onChange={v => setSocialField(p.key, 'avg_reach', v)} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Section>

          <Section n={4} title="Content en beschikbaarheid">
            <Radio label="Hoe vaak ben je bereid content over HIBOO te plaatsen?" options={FREQUENCIES} value={content.frequency} onChange={v => setContent({ ...content, frequency: v })} />
            <div>
              <Label>Welke soorten content maak je voornamelijk?</Label>
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                {CONTENT_TYPES.map(t => (
                  <label key={t} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={content.types.includes(t)} onChange={() => toggleType(t)} className="w-4 h-4 rounded border-gray-300 text-accent-700 focus:ring-accent-700" />
                    {t}
                  </label>
                ))}
              </div>
              {content.types.includes('Anders') && (
                <input value={content.types_other} onChange={e => setContent({ ...content, types_other: e.target.value })} placeholder="Anders, namelijk..." className="mt-2 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent-700" />
              )}
            </div>
            <Radio label="Ben je bereid om je gezicht te laten zien in de content?" options={['Ja', 'Nee']} value={content.face} onChange={v => setContent({ ...content, face: v })} />
            <Radio label="Ben je bereid vooraf afgesproken contentrichtlijnen en deadlines te volgen?" options={['Ja', 'Nee']} value={content.guidelines} onChange={v => setContent({ ...content, guidelines: v })} />
          </Section>

          <Section n={5} title="Motivatie">
            <A label="Waarom wil je partner worden van HIBOO?" value={motivation.why_partner} onChange={v => setMotivation({ ...motivation, why_partner: v })} />
            <A label="Wat spreekt je aan in HIBOO en onze missie?" value={motivation.what_appeals} onChange={v => setMotivation({ ...motivation, what_appeals: v })} />
            <A label="Wat verwacht je van de samenwerking?" value={motivation.expectation} onChange={v => setMotivation({ ...motivation, expectation: v })} />
            <A label="Welke resultaten wil je als partner behalen?" value={motivation.results_goal} onChange={v => setMotivation({ ...motivation, results_goal: v })} />
          </Section>

          <Section n={6} title="Ervaring">
            <Radio label="Heb je ervaring met online ondernemen?" options={['Ja', 'Nee']} value={experience.has} onChange={v => setExperience({ ...experience, has: v })} />
            {experience.has === 'Ja' && (
              <>
                <A label="Met welke verdienmodellen heb je ervaring?" value={experience.models} onChange={v => setExperience({ ...experience, models: v })} />
                <A label="Heb je eerder producten, diensten of opleidingen gepromoot?" value={experience.promoted} onChange={v => setExperience({ ...experience, promoted: v })} />
                <A label="Heb je eerder als affiliate, creator of ambassadeur gewerkt?" value={experience.affiliate} onChange={v => setExperience({ ...experience, affiliate: v })} />
                <A label="Welke resultaten heb je hiermee behaald?" value={experience.results} onChange={v => setExperience({ ...experience, results: v })} />
              </>
            )}
          </Section>

          <Section n={7} title="Over jou">
            <A label="Beschrijf jezelf als persoon." value={about.describe} onChange={v => setAbout({ ...about, describe: v })} />
            <A label="Wat maakt jou uniek?" value={about.unique} onChange={v => setAbout({ ...about, unique: v })} />
            <A label="Wat zijn jouw sterkste eigenschappen?" value={about.strengths} onChange={v => setAbout({ ...about, strengths: v })} />
            <A label="Wat zijn jouw interesses en passies?" value={about.interests} onChange={v => setAbout({ ...about, interests: v })} />
            <A label="Welke doelgroep bereik je momenteel?" value={about.audience} onChange={v => setAbout({ ...about, audience: v })} />
            <A label="Waarom denk je dat jouw doelgroep bij HIBOO past?" value={about.why_fit} onChange={v => setAbout({ ...about, why_fit: v })} />
            <A label="Waar wil je jezelf de komende twaalf maanden in ontwikkelen?" value={about.develop} onChange={v => setAbout({ ...about, develop: v })} />
          </Section>

          <Section n={8} title="Aanvullende informatie">
            <A label="Hoe heb je HIBOO leren kennen?" value={additional.how_found} onChange={v => setAdditional({ ...additional, how_found: v })} />
            <A label="Werk je momenteel samen met andere bedrijven of merken?" value={additional.other_brands} onChange={v => setAdditional({ ...additional, other_brands: v })} />
            <A label="Zijn er zaken waar wij vooraf rekening mee moeten houden?" value={additional.considerations} onChange={v => setAdditional({ ...additional, considerations: v })} />
            <A label="Heb je nog vragen of opmerkingen?" value={additional.questions} onChange={v => setAdditional({ ...additional, questions: v })} />
          </Section>

          <Section n={9} title="Verklaring">
            <p className="text-sm text-gray-600 -mt-1">Door dit formulier in te vullen, verklaar ik dat de aangeleverde informatie volledig en naar waarheid is ingevuld. Ik begrijp dat het invullen van dit formulier niet automatisch betekent dat ik word toegelaten tot het partnerprogramma van HIBOO.</p>
            <Grid>
              <T label="Volledige naam" value={declaration.full_name} onChange={v => setDeclaration({ ...declaration, full_name: v })} />
              <T label="Datum" type="date" value={declaration.date} onChange={v => setDeclaration({ ...declaration, date: v })} />
            </Grid>
            <T label="Digitale handtekening (typ je naam)" value={declaration.signature} onChange={v => setDeclaration({ ...declaration, signature: v })} />
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input type="checkbox" checked={declaration.agreed} onChange={e => setDeclaration({ ...declaration, agreed: e.target.checked })} className="mt-0.5 w-4 h-4 rounded border-gray-300 text-accent-700 focus:ring-accent-700" />
              <span className="text-sm text-gray-700">Ik verklaar dat bovenstaande informatie volledig en naar waarheid is ingevuld.</span>
            </label>
          </Section>

          <button onClick={submit} disabled={submitting}
            className="w-full py-4 rounded-xl bg-accent-700 text-white font-semibold hover:bg-accent-800 disabled:opacity-50 shadow-sm transition">
            {submitting ? 'Versturen...' : 'Aanmelding versturen'}
          </button>
          <p className="text-center text-xs text-gray-400 pb-8">HIBOO Partnerprogramma</p>
        </div>
      </div>
    </div>
  )
}

/* ── helpers ── */
function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
        <span className="w-6 h-6 rounded-full bg-accent-700 text-white text-xs flex items-center justify-center shrink-0">{n}</span>
        {title}
      </h2>
      {children}
    </div>
  )
}
function Grid({ children }: { children: React.ReactNode }) { return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div> }
function Label({ children }: { children: React.ReactNode }) { return <label className="text-sm font-medium text-gray-700">{children}</label> }

function T({ label, value, onChange, type = 'text', small }: { label: string; value: string; onChange: (v: string) => void; type?: string; small?: boolean }) {
  return (
    <div>
      <label className={`${small ? 'text-[11px]' : 'text-xs'} font-medium text-gray-500 uppercase tracking-wide`}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700" />
    </div>
  )
}
function A({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={3}
        className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-accent-700" />
    </div>
  )
}
function Radio({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2 mt-1.5">
        {options.map(o => (
          <button key={o} type="button" onClick={() => onChange(o)}
            className={`px-3.5 py-2 rounded-lg text-sm border transition ${value === o ? 'border-accent-700 bg-accent-50 text-accent-800 font-medium' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {o}
          </button>
        ))}
      </div>
    </div>
  )
}
