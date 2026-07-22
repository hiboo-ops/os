'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { KpiCard, Card, CardHeader, CardContent } from '@/components/ui/card'
import { DailyBarChart } from '@/components/ui/charts'
import { EmptyState } from '@/components/ui/empty-state'
import { SkeletonPage } from '@/components/ui/skeleton'
import { formatDateShort } from '@/lib/format'
import { ClipboardList, Flame, CalendarCheck } from 'lucide-react'
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

// Conversieratio's over de funnel: outbounds → replies → positief → gekwalificeerd → geboekt.
// `num`/`den` indexeren de eigen totalen; `bNum`/`bDen` de team-benchmark (perDayAvg).
type TotalKey = 'outbounds' | 'replies' | 'positief' | 'gekwalificeerd' | 'geboekt' | 'calendly'
const CONVERSIONS: { key: string; label: string; hint: string; num: TotalKey; den: TotalKey; bNum: BenchKey; bDen: BenchKey }[] = [
  { key: 'reply', label: 'Reply-rate', hint: 'replies ÷ outbounds', num: 'replies', den: 'outbounds', bNum: 'replies_outbound', bDen: 'nieuwe_outbounds' },
  { key: 'positief', label: 'Positief v. replies', hint: 'positief ÷ replies', num: 'positief', den: 'replies', bNum: 'positieve_reacties', bDen: 'replies_outbound' },
  { key: 'kwal', label: 'Kwalificatie', hint: 'gekwalificeerd ÷ positief', num: 'gekwalificeerd', den: 'positief', bNum: 'leads_gekwalificeerd', bDen: 'positieve_reacties' },
  { key: 'boeking', label: 'Boeking v. gekwal.', hint: 'geboekt ÷ gekwalificeerd', num: 'geboekt', den: 'gekwalificeerd', bNum: 'calls_geboekt', bDen: 'leads_gekwalificeerd' },
  { key: 'calendly', label: 'Calendly-conversie', hint: 'geboekt ÷ links', num: 'geboekt', den: 'calendly', bNum: 'calls_geboekt', bDen: 'calendly_links_gestuurd' },
  { key: 'ob2call', label: 'Outbound → call', hint: 'geboekt ÷ outbounds', num: 'geboekt', den: 'outbounds', bNum: 'calls_geboekt', bDen: 'nieuwe_outbounds' },
]
const pct = (numr: number, den: number) => (den > 0 ? Math.round((numr / den) * 100) : 0)

export default function SetterEodDashboardPage() {
  const [dateFrom, setDateFrom] = useState(() => daysAgoString(7))
  const [dateTo, setDateTo] = useState(todayString)
  const [reports, setReports] = useState<EodReport[]>([])
  const [benchmark, setBenchmark] = useState<SetterBenchmark | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const qs = `dateFrom=${dateFrom}&dateTo=${dateTo}`
      const [ownRes, benchRes] = await Promise.all([
        fetch(`/api/eod?roleType=SETTER&${qs}`),
        fetch(`/api/eod/setter-benchmark?${qs}`),
      ])
      const own = await ownRes.json()
      const bench = await benchRes.json()
      setReports(Array.isArray(own) ? own : [])
      setBenchmark(bench && typeof bench === 'object' && 'perDayAvg' in bench ? bench : null)
    } catch {
      setReports([])
      setBenchmark(null)
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

  // Totalen voor conversieratio's (som over de periode).
  const sumOf = (get: (a: Answers) => number) => reports.reduce((s, r) => s + get(r.answers as Answers), 0)
  const totals: Record<TotalKey, number> = {
    outbounds: sumOf(a => num(a.activiteit?.nieuwe_outbounds)),
    replies: sumOf(a => num(a.conversies?.replies_outbound)),
    positief: sumOf(a => num(a.conversies?.positieve_reacties)),
    gekwalificeerd: sumOf(a => num(a.conversies?.leads_gekwalificeerd)),
    geboekt: sumOf(a => num(a.calls?.calls_geboekt_inbound) + num(a.calls?.calls_geboekt_outbound)),
    calendly: sumOf(a => num(a.calls?.calendly_links_gestuurd)),
  }

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

          {/* Conversieratio's */}
          <Card className="mb-6">
            <CardHeader>
              <h2 className="text-sm font-semibold text-gray-900">Conversieratio&apos;s</h2>
              <p className="text-xs text-gray-400 mt-0.5">Funnel: outbounds → replies → positief → gekwalificeerd → geboekt</p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 divide-x divide-y divide-gray-100">
                {CONVERSIONS.map(c => {
                  const own = pct(totals[c.num], totals[c.den])
                  const teamAvg = benchmark ? pct(benchmark.perDayAvg[c.bNum], benchmark.perDayAvg[c.bDen]) : null
                  const good = teamAvg !== null && own >= teamAvg
                  return (
                    <div key={c.key} className="p-4">
                      <div className="text-xs font-medium text-gray-500">{c.label}</div>
                      <div className="text-2xl font-bold text-gray-900 tabular-nums mt-1">{own}%</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">{c.hint}</div>
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
