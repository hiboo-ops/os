'use client'

import { useState, useEffect, useCallback } from 'react'
import { KpiStrip, KpiCell } from '@/components/ui/kpi-strip'
import { ScreenHeader } from '@/components/ui/industry-ui'
import type { EodReport } from '@/lib/queries/eod'
import { formatDate } from '@/lib/format'

function todayString() {
  return new Date().toISOString().slice(0, 10)
}

function weekAgoString() {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d.toISOString().slice(0, 10)
}

const ROLE_TABS = [
  { key: 'SETTER', label: 'Setters' },
  { key: 'CLOSER', label: 'Closers' },
  { key: 'FINANCE', label: 'Finance' },
  { key: 'PARTNER_MANAGER', label: 'Partner Managers' },
  { key: 'CREATOR', label: 'Creators' },
] as const

type RoleKey = (typeof ROLE_TABS)[number]['key']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Answers = any

const num = (v: unknown) => Number(v) || 0
const euro = (v: unknown) =>
  '€ ' + (Number(v) || 0).toLocaleString('nl-NL')

function YesNo({ value }: { value: unknown }) {
  const yes = value === true || value === 'ja'
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
        yes ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
      }`}
    >
      {yes ? 'Ja' : 'Nee'}
    </span>
  )
}

// Kolommen per rol (naast Datum + Naam)
const COLUMNS: Record<RoleKey, { label: string; cell: (a: Answers) => React.ReactNode }[]> = {
  SETTER: [
    { label: 'Outbounds', cell: a => num(a.activiteit?.nieuwe_outbounds) },
    { label: 'Follow-ups', cell: a => num(a.activiteit?.follow_ups) },
    {
      label: 'Calls geboekt',
      cell: a => num(a.calls?.calls_geboekt_inbound) + num(a.calls?.calls_geboekt_outbound),
    },
    { label: 'CRM bijgewerkt', cell: a => <YesNo value={a.crm?.crm_bijgewerkt} /> },
    { label: 'Taken af', cell: a => <YesNo value={a.crm?.taken_afgevinkt} /> },
  ],
  CLOSER: [],
  FINANCE: [
    { label: 'Cash-in', cell: a => euro(a.cash?.totaal_geincasseerd) },
    { label: 'Failed', cell: a => num(a.mislukt?.aantal_failed) },
    { label: 'Refunds', cell: a => num(a.refunds?.aantal_refunds) },
    { label: 'Verwerkt', cell: a => <YesNo value={a.administratie?.betalingen_verwerkt} /> },
  ],
  PARTNER_MANAGER: [
    { label: 'Outbounds', cell: a => num(a.outbound_activiteit?.aantal_outbounds) },
    { label: 'Deals besproken', cell: a => num(a.deals_gesprekken?.aantal_deals_besproken) },
    { label: 'Nieuwe partners', cell: a => num(a.nieuwe_partners?.volledig_onboard) },
    { label: 'CRM bijgewerkt', cell: a => <YesNo value={a.crm_taken?.crm_bijgewerkt} /> },
  ],
  CREATOR: [
    { label: 'TikTok posts', cell: a => num(a.tiktok?.aantal_posts) },
    { label: 'IG posts', cell: a => num(a.instagram_main?.aantal_posts) },
    { label: 'Story gepost', cell: a => <YesNo value={a.instagram_stories?.story_gepost} /> },
  ],
}

export default function EodOverviewPage() {
  const [reports, setReports] = useState<EodReport[]>([])
  const [loading, setLoading] = useState(true)
  const [roleType, setRoleType] = useState<RoleKey>('SETTER')
  const [dateFrom, setDateFrom] = useState(weekAgoString)
  const [dateTo, setDateTo] = useState(todayString)
  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/me')
      .then(r => r.json())
      .then(data => setUserRole(data?.role ?? null))
  }, [])

  const loadReports = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ roleType, dateFrom, dateTo })
    const res = await fetch(`/api/eod?${params}`)
    const data = await res.json()
    setReports(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [roleType, dateFrom, dateTo])

  useEffect(() => {
    if (userRole !== null) loadReports()
  }, [loadReports, userRole])

  const totalReports = reports.length
  const uniqueDays = new Set(reports.map(r => r.report_date)).size
  const uniquePeople = new Set(reports.map(r => r.submitted_name)).size

  const columns = COLUMNS[roleType]

  if (userRole !== null && userRole !== 'ADMIN') {
    return (
      <div>
        <h1 className="text-xl font-semibold text-gray-900 mb-4">EOD Overzicht</h1>
        <p className="text-sm text-gray-500">
          Alleen admins hebben toegang tot het overzicht.
        </p>
      </div>
    )
  }

  return (
    <div>
      <ScreenHeader eyebrow="DELIVERY & SYSTEM" title="EOD Reports" />

      {/* Rol-tabs */}
      <div className="flex items-center gap-1 mb-5 border-b border-divider">
        {ROLE_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setRoleType(tab.key)}
            className={`px-3.5 py-2 font-heading font-semibold uppercase text-[11px] tracking-[0.06em] -mb-px border-b-2 transition-colors duration-[120ms] ${
              roleType === tab.key
                ? 'border-accent-800 text-ink'
                : 'border-transparent text-ink/45 hover:text-ink/70'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Van</label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="mt-1 block text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-accent-700"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Tot</label>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="mt-1 block text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-accent-700"
          />
        </div>
      </div>

      {/* KPIs */}
      <div className="mb-6">
        <KpiStrip cols={3}>
          <KpiCell label="Reports" value={totalReports} />
          <KpiCell label="Days" value={uniqueDays} />
          <KpiCell label="People" value={uniquePeople} />
        </KpiStrip>
      </div>

      {/* Tabel */}
      {loading ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-sm text-gray-400">
          Laden...
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-sm text-gray-400">
          Geen rapportages gevonden in deze periode.
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100">
                  <th className="px-5 py-3">Datum</th>
                  <th className="px-4 py-3">Naam</th>
                  {columns.map(col => (
                    <th key={col.label} className="px-4 py-3">{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {reports.map(report => {
                  const a = (report.answers || {}) as Answers
                  return (
                    <tr key={report.id} className="hover:bg-gray-50 transition-colors duration-[120ms]">
                      <td className="px-5 py-3 text-gray-900 tabular-nums">
                        {formatDate(report.report_date)}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {report.submitted_name}
                      </td>
                      {columns.map(col => (
                        <td key={col.label} className="px-4 py-3 tabular-nums text-gray-700">
                          {col.cell(a)}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
