'use client'

import { useState, useEffect, useCallback } from 'react'
import { SkeletonPage } from '@/components/ui/skeleton'
import { CheckCircle2, Loader2 } from 'lucide-react'
import {
  type FinanceEodAnswers,
  emptyAnswers,
  upsertFinanceEod,
  getFinanceEod,
} from '@/lib/queries/eod-finance'

// ── Helpers ──

interface MeData {
  name: string
  teamMemberId: string
}

const REDEN_OPTIONS = [
  'Onvoldoende saldo',
  'Kaart verlopen / fout',
  'Technische PSP-error',
  'Klant geannuleerd / gestorneerd',
]

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

// ── Subcomponents ──

function SectionHeader({ number, title }: { number: number; title: string }) {
  return (
    <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-900 text-white text-xs font-bold">
        {number}
      </span>
      {title}
    </h2>
  )
}

function NumberField({
  label,
  value,
  onChange,
  prefix,
}: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
  prefix?: string
}) {
  return (
    <label className="block">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="mt-1 relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
            {prefix}
          </span>
        )}
        <input
          type="number"
          step="any"
          className={`w-full h-10 border border-gray-200 rounded-lg bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent ${prefix ? 'pl-8 pr-3' : 'px-3'}`}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        />
      </div>
    </label>
  )
}

function RadioField({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean | null
  onChange: (v: boolean) => void
}) {
  return (
    <div>
      <span className="text-sm text-gray-600">{label}</span>
      <div className="flex gap-4 mt-1.5">
        {[
          { val: true, text: 'Ja' },
          { val: false, text: 'Nee' },
        ].map(({ val, text }) => (
          <button
            key={text}
            type="button"
            onClick={() => onChange(val)}
            className={`px-4 h-9 rounded-lg text-sm font-medium border transition-colors duration-[120ms] ${
              value === val
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}

function TextareaField({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  rows?: number
}) {
  return (
    <label className="block">
      <span className="text-sm text-gray-600">{label}</span>
      <textarea
        className="mt-1 w-full border border-gray-200 rounded-lg bg-white text-sm text-gray-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent resize-y"
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}

function CheckboxGroup({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: string[]
  selected: string[]
  onChange: (v: string[]) => void
}) {
  const toggle = (opt: string) => {
    onChange(
      selected.includes(opt)
        ? selected.filter((s) => s !== opt)
        : [...selected, opt],
    )
  }

  return (
    <div>
      <span className="text-sm text-gray-600">{label}</span>
      <div className="mt-1.5 space-y-1.5">
        {options.map((opt) => (
          <label key={opt} className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={selected.includes(opt)}
              onChange={() => toggle(opt)}
              className="w-4 h-4 rounded border-gray-300 text-accent-700 focus:ring-accent-500"
            />
            <span className="text-sm text-gray-700 group-hover:text-gray-900">{opt}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

// ── Main Form ──

export default function FinanceEodPage() {
  const [me, setMe] = useState<MeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [answers, setAnswers] = useState<FinanceEodAnswers>(emptyAnswers())

  const date = todayStr()

  // Fetch user + existing report
  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then(async (data) => {
        const meData: MeData = { name: data.name, teamMemberId: data.teamMemberId }
        setMe(meData)

        const existing = await getFinanceEod(meData.teamMemberId, date)
        if (existing?.answers) {
          setAnswers(existing.answers)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [date])

  // Section updaters
  const updateCash = useCallback(
    (field: keyof FinanceEodAnswers['cash'], value: number | null) =>
      setAnswers((prev) => ({ ...prev, cash: { ...prev.cash, [field]: value } })),
    [],
  )
  const updateMislukt = useCallback(
    (field: keyof FinanceEodAnswers['mislukt'], value: unknown) =>
      setAnswers((prev) => ({ ...prev, mislukt: { ...prev.mislukt, [field]: value } })),
    [],
  )
  const updateRefunds = useCallback(
    (field: keyof FinanceEodAnswers['refunds'], value: unknown) =>
      setAnswers((prev) => ({ ...prev, refunds: { ...prev.refunds, [field]: value } })),
    [],
  )
  const updateAdmin = useCallback(
    (field: keyof FinanceEodAnswers['administratie'], value: unknown) =>
      setAnswers((prev) => ({
        ...prev,
        administratie: { ...prev.administratie, [field]: value },
      })),
    [],
  )
  const updateSupport = useCallback(
    (field: keyof FinanceEodAnswers['support'], value: unknown) =>
      setAnswers((prev) => ({ ...prev, support: { ...prev.support, [field]: value } })),
    [],
  )
  const updateReflectie = useCallback(
    (field: keyof FinanceEodAnswers['reflectie'], value: string) =>
      setAnswers((prev) => ({ ...prev, reflectie: { ...prev.reflectie, [field]: value } })),
    [],
  )

  const handleSubmit = async () => {
    if (!me) return
    setSaving(true)
    setSaved(false)
    try {
      await upsertFinanceEod(me.teamMemberId, me.name, answers, date)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error('EOD save failed:', err)
      alert('Opslaan mislukt. Probeer opnieuw.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <SkeletonPage />

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-gray-900">Finance EOD</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {new Date(date).toLocaleDateString('nl-NL', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}{' '}
          &middot; {me?.name || '—'}
        </p>
      </div>

      <div className="space-y-8">
        {/* ── 1. Cash vandaag ── */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <SectionHeader number={1} title="Cash vandaag" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <NumberField
              label="Totaal geïncasseerd"
              value={answers.cash.totaal_geincasseerd}
              onChange={(v) => updateCash('totaal_geincasseerd', v)}
              prefix="€"
            />
            <NumberField
              label="Stripe / Mollie / PSP"
              value={answers.cash.stripe_mollie_psp}
              onChange={(v) => updateCash('stripe_mollie_psp', v)}
              prefix="€"
            />
            <NumberField
              label="Bankoverschrijvingen"
              value={answers.cash.bankoverschrijvingen}
              onChange={(v) => updateCash('bankoverschrijvingen', v)}
              prefix="€"
            />
            <NumberField
              label="Contant / overige"
              value={answers.cash.contant_overige}
              onChange={(v) => updateCash('contant_overige', v)}
              prefix="€"
            />
            <NumberField
              label="Nieuwe betaalplannen gestart"
              value={answers.cash.nieuwe_betaalplannen}
              onChange={(v) => updateCash('nieuwe_betaalplannen', v)}
            />
            <NumberField
              label="Toekomstige termijnen gecontracteerd"
              value={answers.cash.toekomstige_termijnen}
              onChange={(v) => updateCash('toekomstige_termijnen', v)}
              prefix="€"
            />
          </div>
        </section>

        {/* ── 2. Mislukte & achterstallige betalingen ── */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <SectionHeader number={2} title="Mislukte & achterstallige betalingen" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <NumberField
              label="Aantal failed payments"
              value={answers.mislukt.aantal_failed}
              onChange={(v) => updateMislukt('aantal_failed', v)}
            />
            <NumberField
              label="Totaal bedrag failed"
              value={answers.mislukt.bedrag_failed}
              onChange={(v) => updateMislukt('bedrag_failed', v)}
              prefix="€"
            />
          </div>
          <div className="mt-4">
            <CheckboxGroup
              label="Reden"
              options={REDEN_OPTIONS}
              selected={answers.mislukt.reden}
              onChange={(v) => updateMislukt('reden', v)}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <NumberField
              label="Automatische herpogingen gepland"
              value={answers.mislukt.herpogingen_gepland}
              onChange={(v) => updateMislukt('herpogingen_gepland', v)}
            />
            <NumberField
              label="Klanten handmatig gecontact"
              value={answers.mislukt.klanten_gecontact}
              onChange={(v) => updateMislukt('klanten_gecontact', v)}
            />
            <NumberField
              label="Bedrag hersteld vandaag"
              value={answers.mislukt.bedrag_hersteld}
              onChange={(v) => updateMislukt('bedrag_hersteld', v)}
              prefix="€"
            />
            <NumberField
              label="Klanten 1 termijn achter"
              value={answers.mislukt.klanten_1_termijn}
              onChange={(v) => updateMislukt('klanten_1_termijn', v)}
            />
            <NumberField
              label="Klanten 2+ termijnen achter"
              value={answers.mislukt.klanten_2plus_termijn}
              onChange={(v) => updateMislukt('klanten_2plus_termijn', v)}
            />
            <NumberField
              label="Totaal openstaand risico"
              value={answers.mislukt.openstaand_risico}
              onChange={(v) => updateMislukt('openstaand_risico', v)}
              prefix="€"
            />
          </div>
        </section>

        {/* ── 3. Refunds, chargebacks & opzeggingen ── */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <SectionHeader number={3} title="Refunds, chargebacks & opzeggingen" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <NumberField
              label="Aantal refunds"
              value={answers.refunds.aantal_refunds}
              onChange={(v) => updateRefunds('aantal_refunds', v)}
            />
            <NumberField
              label="Totaal refund-bedrag"
              value={answers.refunds.bedrag_refunds}
              onChange={(v) => updateRefunds('bedrag_refunds', v)}
              prefix="€"
            />
          </div>
          <div className="mt-4">
            <TextareaField
              label="Reden per refund"
              value={answers.refunds.reden_refunds}
              onChange={(v) => updateRefunds('reden_refunds', v)}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <NumberField
              label="Aantal chargebacks / storneringen"
              value={answers.refunds.aantal_chargebacks}
              onChange={(v) => updateRefunds('aantal_chargebacks', v)}
            />
            <NumberField
              label="Totaal chargeback-bedrag"
              value={answers.refunds.bedrag_chargebacks}
              onChange={(v) => updateRefunds('bedrag_chargebacks', v)}
              prefix="€"
            />
          </div>
          <div className="mt-4">
            <TextareaField
              label="Opmerkingen"
              value={answers.refunds.opmerkingen}
              onChange={(v) => updateRefunds('opmerkingen', v)}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <NumberField
              label="Klanten stopgezet door niet-betalen"
              value={answers.refunds.klanten_stopgezet}
              onChange={(v) => updateRefunds('klanten_stopgezet', v)}
            />
            <NumberField
              label="Gemiste resterende contractwaarde"
              value={answers.refunds.gemiste_contractwaarde}
              onChange={(v) => updateRefunds('gemiste_contractwaarde', v)}
              prefix="€"
            />
          </div>
        </section>

        {/* ── 4. Administratie & systemen ── */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <SectionHeader number={4} title="Administratie & systemen" />
          <div className="space-y-4">
            <RadioField
              label="Alle betalingen verwerkt / gematcht?"
              value={answers.administratie.betalingen_verwerkt}
              onChange={(v) => updateAdmin('betalingen_verwerkt', v)}
            />
            <RadioField
              label="Alle finance-taken afgevinkt?"
              value={answers.administratie.finance_taken_afgevinkt}
              onChange={(v) => updateAdmin('finance_taken_afgevinkt', v)}
            />
            <TextareaField
              label="Openstaande afwijkingen"
              value={answers.administratie.openstaande_afwijkingen}
              onChange={(v) => updateAdmin('openstaande_afwijkingen', v)}
              rows={2}
            />
          </div>
        </section>

        {/* ── 5. Support aan sales/ops ── */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <SectionHeader number={5} title="Support aan sales / ops" />
          <div className="space-y-4">
            <NumberField
              label="Speciale betalingsafspraken goedgekeurd"
              value={answers.support.speciale_afspraken}
              onChange={(v) => updateSupport('speciale_afspraken', v)}
            />
            <TextareaField
              label="Uitzonderingen die de organisatie moet weten"
              value={answers.support.uitzonderingen}
              onChange={(v) => updateSupport('uitzonderingen', v)}
              rows={2}
            />
          </div>
        </section>

        {/* ── 6. Reflectie ── */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <SectionHeader number={6} title="Reflectie" />
          <div className="space-y-4">
            <TextareaField
              label="Wat ging goed?"
              value={answers.reflectie.wat_ging_goed}
              onChange={(v) => updateReflectie('wat_ging_goed', v)}
              rows={2}
            />
            <TextareaField
              label="Waar loop je vast / welk besluit is nodig?"
              value={answers.reflectie.waar_loop_je_vast}
              onChange={(v) => updateReflectie('waar_loop_je_vast', v)}
              rows={2}
            />
            <TextareaField
              label="1 verbeteridee cash-in / failed payments"
              value={answers.reflectie.verbeteridee}
              onChange={(v) => updateReflectie('verbeteridee', v)}
              rows={2}
            />
          </div>
        </section>

        {/* ── Submit ── */}
        <div className="flex items-center gap-3 pb-8">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="h-10 px-6 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors duration-[120ms] flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Opslaan...' : 'EOD Opslaan'}
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
              <CheckCircle2 className="w-4 h-4" />
              Opgeslagen
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
