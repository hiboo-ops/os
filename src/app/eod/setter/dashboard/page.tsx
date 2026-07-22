'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { KpiCard, Card, CardHeader, CardContent } from '@/components/ui/card'
import { DailyBarChart } from '@/components/ui/charts'
import { EmptyState } from '@/components/ui/empty-state'
import { SkeletonPage } from '@/components/ui/skeleton'
import { formatDateShort, eur } from '@/lib/format'
import { ClipboardList, Flame, CalendarCheck, PhoneCall } from 'lucide-react'
import { calculateMetrics } from '@/lib/queries/sales'
import type { Call } from '@/lib/queries/sales'
import type { EodReport } from '@/lib/queries/eod'
import type { SetterBenchmark } from '@/lib/queries/eod'

// ── Datum-helpers ──
function todayString() {
  return new Date().toISOString().slice(0, 10)
}
function daysAgoString(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}
// Alle dagen (YYYY-MM-DD) tussen from en to, inclusief.
function dateRange(from: string, to: string): string[] {
  const out: string[] = []
  const cur = new Date(from + 'T00:00:00')
  const end = new Date(to + 'T00:00:00')
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Answers = any
const num = (v: unknown) => Number(v) || 0

// Metric-definities: haal waarde uit de answers-jsonb + optionele benchmark-key.
type BenchKey = keyof SetterBenchmark['perDayAvg']
interface Metric {
  key: string
  label: string
  get: (a: Answers) => number
  bench?: BenchKey
}
const METRICS: Metric[] = [
  { key: 'outbounds', label: 'Outbounds', get: a => num(a.activiteit?.nieuwe_outbounds), bench: 'nieuwe_outbounds' },
  { key: 'follow_ups', label: 'Follow-ups', get: a => num(a.activiteit?.follow_ups), bench: 'follow_ups' },
  { key: 'inbound', label: 'Inbound gesprekken', get: a => num(a.conversies?.inbound_gesprekken) },
  { key: 'positief', label: 'Positieve reacties', get: a => num(a.conversies?.positieve_reacties), bench: 'positieve_reacties' },
  { key: 'gekwalificeerd', label: 'Leads gekwalificeerd', get: a => num(a.conversies?.leads_gekwalificeerd), bench: 'leads_gekwalificeerd' },
  { key: 'calls_geboekt', label: 'Calls geboekt', get: a => num(a.calls?.calls_geboekt_inbound) + num(a.calls?.calls_geboekt_outbound), bench: 'calls_geboekt' },
  { key: 'calendly', label: 'Calendly links', get: a => num(a.calls?.calendly_links_gestuurd), bench: 'calendly_links_gestuurd' },
]

// Trend-grafieken (per dag)
const TRENDS: { key: string; label: string; get: (a: Answers) => number }[] = [
  { key: 'outbounds', label: 'Outbounds per dag', get: a => num(a.activiteit?.nieuwe_outbounds) },
  { key: 'calls_geboekt', label: 'Calls geboekt per dag', get: a => num(a.calls?.calls_geboekt_inbound) + num(a.calls?.calls_geboekt_outbound) },
  { key: 'positief', label: 'Positieve reacties per dag', get: a => num(a.conversies?.positieve_reacties) },
]

// De 8 vastgelegde conversie-metrics. `own(t)` en `bench(b)` geven elk [teller, noemer]
// terug — eigen uit de periode-totalen, team uit perDayAvg (zelfde formule).
type Totals = {
  outbounds: number; replies: number; inbound: number
  positief: number; voorgesteld: number; geboekt: number
}
type PerDay = SetterBenchmark['perDayAvg']
const FUNNEL: { key: string; label: string; hint: string; own: (t: Totals) => [number, number]; bench: (b: PerDay) => [number, number] }[] = [
  { key: 'resp_ob', label: 'Response rate op outbound', hint: 'replies ÷ outbounds',
    own: t => [t.replies, t.outbounds], bench: b => [b.replies_outbound, b.nieuwe_outbounds] },
  { key: 'posresp_ob', label: 'Positive response rate op outbound', hint: 'positief ÷ outbounds',
    own: t => [t.positief, t.outbounds], bench: b => [b.positieve_reacties, b.nieuwe_outbounds] },
  { key: 'resp_prop', label: 'Response → Call proposed', hint: 'voorgesteld ÷ replies',
    own: t => [t.voorgesteld, t.replies], bench: b => [b.calls_voorgesteld, b.replies_outbound] },
  { key: 'prop_booked', label: 'Call proposed → booked', hint: 'geboekt ÷ voorgesteld',
    own: t => [t.geboekt, t.voorgesteld], bench: b => [b.calls_geboekt, b.calls_voorgesteld] },
  { key: 'book_resp', label: 'Booking % based on responses', hint: 'geboekt ÷ replies',
    own: t => [t.geboekt, t.replies], bench: b => [b.calls_geboekt, b.replies_outbound] },
  { key: 'book_ob', label: 'Booking % on outbound', hint: 'geboekt ÷ outbounds',
    own: t => [t.geboekt, t.outbounds], bench: b => [b.calls_geboekt, b.nieuwe_outbounds] },
  { key: 'book_in', label: 'Booking % on inbounds', hint: 'geboekt ÷ inbound gesprekken',
    own: t => [t.geboekt, t.inbound], bench: b => [b.calls_geboekt, b.inbound_gesprekken] },
  { key: 'book_conv', label: 'Booking on total conversations', hint: 'geboekt ÷ (replies + inbound)',
    own: t => [t.geboekt, t.replies + t.inbound], bench: b => [b.calls_geboekt, b.replies_outbound + b.inbound_gesprekken] },
]
const pct = (numr: number, den: number) => (den > 0 ? Math.round((numr / den) * 100) : 0)

function OutcomeTile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="p-4">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="text-2xl font-bold text-gray-900 tabular-nums mt-1">{value}</div>
      {sub && <div className="text-[11px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  )
}

export default function SetterEodDashboardPage() {
  const [dateFrom, setDateFrom] = useState(() => daysAgoString(7))
  const [dateTo, setDateTo] = useState(todayString)
  const [reports, setReports] = useState<EodReport[]>([])
  const [benchmark, setBenchmark] = useState<SetterBenchmark | null>(null)
  const [calls, setCalls] = useState<Call[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const qs = `dateFrom=${dateFrom}&dateTo=${dateTo}`
      const [ownRes, benchRes, callsRes] = await Promise.all([
        fetch(`/api/eod?roleType=SETTER&${qs}`),
        fetch(`/api/eod/setter-benchmark?${qs}`),
        fetch(`/api/calls?${qs}`),
      ])
      const own = await ownRes.json()
      const bench = await benchRes.json()
      const callsData = await callsRes.json()
      setReports(Array.isArray(own) ? own : [])
      setBenchmark(bench && typeof bench === 'object' && 'perDayAvg' in bench ? bench : null)
      setCalls(Array.isArray(callsData) ? callsData : [])
    } catch {
      setReports([])
      setBenchmark(null)
      setCalls([])
    }
    setLoading(false)
  }, [dateFrom, dateTo])

  useEffect(() => { loadData() }, [loadData])

  if (loading && reports.length === 0 && !benchmark) return <SkeletonPage />

  const reportCount = reports.length

  // Eigen gem/dag = totaal / aantal eigen rapport-dagen (zelfde basis als team-benchmark).
  const ownAvg = (total: number) => (reportCount > 0 ? Math.round((total / reportCount) * 10) / 10 : 0)

  // Consistentie / streak
  const reportDates = new Set(reports.map(r => r.report_date))
  const daysFilled = reportDates.size
  const rangeDays = dateRange(dateFrom, dateTo)
  const missingDays = rangeDays.filter(d => !reportDates.has(d) && d <= todayString()).length

  // Streak: opeenvolgende dagen t/m vandaag (of gisteren) met een rapport.
  const streak = (() => {
    let count = 0
    const cur = new Date(todayString() + 'T00:00:00')
    // Als vandaag nog niet ingevuld, start bij gisteren.
    if (!reportDates.has(cur.toISOString().slice(0, 10))) cur.setDate(cur.getDate() - 1)
    while (reportDates.has(cur.toISOString().slice(0, 10))) {
      count++
      cur.setDate(cur.getDate() - 1)
    }
    return count
  })()

  // CRM-completion (% dagen crm_bijgewerkt = ja)
  const crmJa = reports.filter(r => (r.answers as Answers)?.crm?.crm_bijgewerkt === 'ja').length
  const crmPct = reportCount > 0 ? Math.round((crmJa / reportCount) * 100) : 0

  // Trend-data: per dag in de reeks, 0 waar geen rapport.
  const byDate: Record<string, Answers> = {}
  for (const r of reports) byDate[r.report_date] = r.answers || {}
  const trendLabels = rangeDays.map(d => formatDateShort(d))

  // Totalen voor de conversie-metrics (som over de periode).
  const sumOf = (get: (a: Answers) => number) => reports.reduce((s, r) => s + get(r.answers as Answers), 0)
  const totals: Totals = {
    outbounds: sumOf(a => num(a.activiteit?.nieuwe_outbounds)),
    replies: sumOf(a => num(a.conversies?.replies_outbound)),
    inbound: sumOf(a => num(a.conversies?.inbound_gesprekken)),
    positief: sumOf(a => num(a.conversies?.positieve_reacties)),
    voorgesteld: sumOf(a => num(a.calls?.calls_voorgesteld)),
    geboekt: sumOf(a => num(a.calls?.calls_geboekt_inbound) + num(a.calls?.calls_geboekt_outbound)),
  }

  // Echte call-uitkomsten (calls-tabel, setter-scoped) via de sales-metrics.
  const cm = calculateMetrics(calls)
  const takenCalls = cm.totalCalls - cm.noShows - cm.cancelled

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Mijn EOD-dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Eigen prestaties over tijd, met team-benchmark</p>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Van</label>
            <input
              type="date" value={dateFrom} max={dateTo}
              onChange={e => setDateFrom(e.target.value)}
              className="mt-1 block text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-accent-700"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Tot</label>
            <input
              type="date" value={dateTo} min={dateFrom} max={todayString()}
              onChange={e => setDateTo(e.target.value)}
              className="mt-1 block text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-accent-700"
            />
          </div>
          <div className="flex rounded-lg border border-gray-200 bg-white p-0.5">
            {[7, 30].map(n => (
              <button
                key={n}
                onClick={() => { setDateFrom(daysAgoString(n)); setDateTo(todayString()) }}
                className="px-3 py-1.5 text-xs font-medium rounded-md text-gray-500 hover:text-gray-900"
              >
                {n}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {reportCount === 0 ? (
        <Card>
          <EmptyState
            icon={ClipboardList}
            title="Nog geen EOD's in deze periode"
            description="Vul je einde-dag rapportage in — je cijfers, trends en team-vergelijking verschijnen hier vanzelf."
          />
          <div className="pb-6 text-center">
            <Link href="/eod/setter" className="inline-flex items-center gap-2 px-4 h-9 bg-accent-700 text-white rounded-lg text-sm font-medium hover:bg-accent-800 transition-colors duration-[120ms]">
              EOD invullen
            </Link>
          </div>
        </Card>
      ) : (
        <>
          {/* Consistentie */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <KpiCard label="Rapportages" value={reportCount} caption={`${daysFilled} dagen ingevuld`} />
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-500" strokeWidth={2} /> Streak
              </div>
              <div className="text-2xl font-bold text-gray-900 tabular-nums">{streak}</div>
              <div className="text-xs mt-1 text-gray-400">opeenvolgende dagen</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                <CalendarCheck className="w-3.5 h-3.5 text-gray-400" strokeWidth={2} /> Gemist
              </div>
              <div className="text-2xl font-bold text-gray-900 tabular-nums">{missingDays}</div>
              <div className="text-xs mt-1 text-gray-400">dagen zonder EOD</div>
            </div>
            <KpiCard
              label="CRM bijgewerkt"
              value={`${crmPct}%`}
              caption={`${crmJa}/${reportCount} dagen`}
              captionColor={crmPct >= 80 ? 'success' : 'warning'}
            />
          </div>

          {/* KPI's met benchmark */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {METRICS.map(m => {
              const total = reports.reduce((s, r) => s + m.get(r.answers as Answers), 0)
              const avg = ownAvg(total)
              const teamAvg = m.bench && benchmark ? benchmark.perDayAvg[m.bench] : null
              let caption = `${avg}/dag`
              let captionColor: 'default' | 'success' | 'warning' = 'default'
              if (teamAvg !== null && teamAvg !== undefined) {
                caption = `${avg}/dag · team ${teamAvg}/dag`
                captionColor = avg >= teamAvg ? 'success' : 'warning'
              }
              return <KpiCard key={m.key} label={m.label} value={total} caption={caption} captionColor={captionColor} />
            })}
          </div>

          {/* Conversie-metrics (funnel) */}
          <Card className="mb-6">
            <CardHeader>
              <h2 className="text-sm font-semibold text-gray-900">Conversie-metrics</h2>
              <p className="text-xs text-gray-400 mt-0.5">Outbound + inbound funnel — eigen % met team-benchmark</p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y divide-gray-100">
                {FUNNEL.map(f => {
                  const [on, od] = f.own(totals)
                  const own = pct(on, od)
                  const teamAvg = benchmark ? (() => { const [bn, bd] = f.bench(benchmark.perDayAvg); return pct(bn, bd) })() : null
                  const good = teamAvg !== null && own >= teamAvg
                  return (
                    <div key={f.key} className="p-4">
                      <div className="text-xs font-medium text-gray-500 leading-tight min-h-[28px]">{f.label}</div>
                      <div className="text-2xl font-bold text-gray-900 tabular-nums mt-1">{own}%</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">{f.hint}</div>
                      {teamAvg !== null && (
                        <div className={`text-[11px] mt-1 ${good ? 'text-emerald-600' : 'text-amber-600'}`}>
                          team {teamAvg}%
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Echte call-uitkomsten (calls-tabel) */}
          <Card className="mb-6">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                  <PhoneCall className="w-3.5 h-3.5 text-gray-400" strokeWidth={2} /> Echte call-uitkomsten
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">Geboekte calls → show → closed (uit de sales-pipeline)</p>
              </div>
              <span className="text-[11px] text-gray-400">
                EOD-geboekt {totals.geboekt} · echte calls {cm.totalCalls}
              </span>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 divide-x divide-y divide-gray-100">
                <OutcomeTile label="Geboekt" value={cm.totalCalls} />
                <OutcomeTile label="Show" value={takenCalls} sub={`${Math.round(cm.showUpRate)}% show-rate`} />
                <OutcomeTile label="Closed" value={cm.closedDeals} sub={`${Math.round(cm.closingRateTaken)}% v. taken`} />
                <OutcomeTile label="No-show" value={cm.noShows} />
                <OutcomeTile label="Cancelled" value={cm.cancelled} />
                <OutcomeTile label="Omzet" value={eur(cm.totalDealValue)} />
                <OutcomeTile label="Cash collected" value={eur(cm.totalCashCollected)} />
              </div>
            </CardContent>
          </Card>

          {/* Trend-grafieken */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {TRENDS.map(t => {
              const data = rangeDays.map(d => (byDate[d] ? t.get(byDate[d]) : 0))
              return (
                <Card key={t.key}>
                  <CardHeader>
                    <h2 className="text-sm font-semibold text-gray-900">{t.label}</h2>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[200px]">
                      <DailyBarChart labels={trendLabels} data={data} />
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {benchmark && (
            <p className="text-xs text-gray-400 mt-4">
              Team-benchmark op basis van {benchmark.reportCount} rapportage{benchmark.reportCount !== 1 ? 's' : ''} van {benchmark.setterCount} setter{benchmark.setterCount !== 1 ? 's' : ''} in deze periode (gemiddelde per setter per dag).
            </p>
          )}
        </>
      )}
    </div>
  )
}
