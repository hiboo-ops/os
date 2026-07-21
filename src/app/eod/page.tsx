'use client'

import { useState, useEffect, useCallback } from 'react'
import { KpiCard } from '@/components/ui/card'
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

export default function EodOverviewPage() {
  const [reports, setReports] = useState<EodReport[]>([])
  const [loading, setLoading] = useState(true)
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
    const params = new URLSearchParams({
      roleType: 'SETTER',
      dateFrom,
      dateTo,
    })
    const res = await fetch(`/api/eod?${params}`)
    const data = await res.json()
    setReports(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [dateFrom, dateTo])

  useEffect(() => {
    if (userRole !== null) loadReports()
  }, [loadReports, userRole])

  // KPI berekeningen
  const totalReports = reports.length
  const uniqueDays = new Set(reports.map(r => r.report_date)).size
  const totalOutbounds = reports.reduce(
    (sum, r) => sum + (Number(r.answers?.activiteit?.nieuwe_outbounds) || 0),
    0
  )
  const totalCallsBooked = reports.reduce(
    (sum, r) =>
      sum +
      (Number(r.answers?.calls?.calls_geboekt_inbound) || 0) +
      (Number(r.answers?.calls?.calls_geboekt_outbound) || 0),
    0
  )

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">EOD Overzicht — Setters</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            <span className="tabular-nums">{totalReports}</span> rapportage{totalReports !== 1 ? 's' : ''}
          </p>
        </div>
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Rapportages" value={totalReports} />
        <KpiCard label="Dagen" value={uniqueDays} />
        <KpiCard label="Totaal outbounds" value={totalOutbounds} />
        <KpiCard label="Totaal calls geboekt" value={totalCallsBooked} />
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
                  <th className="px-4 py-3">Outbounds</th>
                  <th className="px-4 py-3">Follow-ups</th>
                  <th className="px-4 py-3">Calls geboekt</th>
                  <th className="px-4 py-3">CRM bijgewerkt</th>
                  <th className="px-4 py-3">Taken af</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {reports.map(report => {
                  const a = report.answers || {}
                  const outbounds = Number(a.activiteit?.nieuwe_outbounds) || 0
                  const followUps = Number(a.activiteit?.follow_ups) || 0
                  const callsInbound = Number(a.calls?.calls_geboekt_inbound) || 0
                  const callsOutbound = Number(a.calls?.calls_geboekt_outbound) || 0
                  const callsBooked = callsInbound + callsOutbound
                  const crmDone = a.crm?.crm_bijgewerkt === 'ja'
                  const takenDone = a.crm?.taken_afgevinkt === 'ja'

                  return (
                    <tr key={report.id} className="hover:bg-gray-50 transition-colors duration-[120ms]">
                      <td className="px-5 py-3 text-gray-900 tabular-nums">
                        {formatDate(report.report_date)}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {report.submitted_name}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-gray-700">{outbounds}</td>
                      <td className="px-4 py-3 tabular-nums text-gray-700">{followUps}</td>
                      <td className="px-4 py-3 tabular-nums text-gray-700">{callsBooked}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                            crmDone
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {crmDone ? 'Ja' : 'Nee'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                            takenDone
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {takenDone ? 'Ja' : 'Nee'}
                        </span>
                      </td>
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
