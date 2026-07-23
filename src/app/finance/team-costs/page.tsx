'use client'

import { useEffect, useState, useCallback } from 'react'
import type { CommissionOverview, CostRow } from '@/lib/queries/commissions'
import { ScreenHeader, Panel } from '@/components/ui/industry-ui'
import { KpiStrip, KpiCell } from '@/components/ui/kpi-strip'
import { Tag } from '@/components/ui/tag'
import { eur, formatDate } from '@/lib/format'
import { SkeletonPage } from '@/components/ui/skeleton'

const COST_CATEGORIES = ['PERSONNEL', 'MARKETING', 'SALES', 'SOFTWARE', 'OTHER']

export default function TeamCostsPage() {
  const [commData, setCommData] = useState<CommissionOverview | null>(null)
  const [costs, setCosts] = useState<CostRow[]>([])
  const [loading, setLoading] = useState(true)
  const [payingId, setPayingId] = useState<string | null>(null)

  // Cost form
  const [showCostForm, setShowCostForm] = useState(false)
  const [costTitle, setCostTitle] = useState('')
  const [costAmount, setCostAmount] = useState('')
  const [costCategory, setCostCategory] = useState('PERSONNEL')
  const [costDate, setCostDate] = useState(new Date().toISOString().split('T')[0])
  const [costNotes, setCostNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    const [commRes, costRes] = await Promise.all([
      fetch('/api/finance/commissions').then(r => r.ok ? r.json() : null),
      fetch('/api/finance/costs').then(r => r.ok ? r.json() : null),
    ])
    if (commRes) setCommData(commRes)
    if (costRes) setCosts(costRes.costs || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handlePayout = async (commissionId: string) => {
    setPayingId(commissionId)
    try {
      const res = await fetch('/api/finance/commissions/payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commission_id: commissionId }),
      })
      if (res.ok) {
        // Optimistic update
        setCommData(prev => {
          if (!prev) return prev
          return {
            ...prev,
            commissions: prev.commissions.map(c =>
              c.id === commissionId ? { ...c, status: 'PAID OUT', paidAt: new Date().toISOString() } : c,
            ),
            totalPaidOut: prev.totalPaidOut + (prev.commissions.find(c => c.id === commissionId)?.amount || 0),
            totalOpen: prev.totalOpen - (prev.commissions.find(c => c.id === commissionId)?.amount || 0),
          }
        })
      }
    } catch {
      // ignore
    }
    setPayingId(null)
  }

  const handleAddCost = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/finance/costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: costTitle,
          amount: parseFloat(costAmount),
          category: costCategory,
          date: costDate,
          notes: costNotes || null,
        }),
      })
      if (res.ok) {
        setCostTitle('')
        setCostAmount('')
        setCostNotes('')
        setShowCostForm(false)
        fetchData()
      }
    } catch {
      // ignore
    }
    setSaving(false)
  }

  if (loading) return <SkeletonPage />

  const totalCosts = costs.reduce((s, c) => s + c.amount, 0)

  return (
    <div className="space-y-6">
      <ScreenHeader eyebrow="FINANCE" title="Team Costs & Commissie" />

      {/* ── KPI Strip ── */}
      <KpiStrip cols={4}>
        <KpiCell label="CALCULATED" value={eur(commData?.totalCalculated || 0)} size="sm" />
        <KpiCell label="PAID OUT" value={eur(commData?.totalPaidOut || 0)} size="sm" />
        <KpiCell label="OPEN" value={eur(commData?.totalOpen || 0)} size="sm" danger={(commData?.totalOpen || 0) > 0} />
        <KpiCell label="TEAM COSTS" value={eur(totalCosts)} size="sm" />
      </KpiStrip>

      {/* ── Commissie per persoon ── */}
      <Panel title="COMMISSION PER PERSON">
        {commData && commData.commissions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-divider">
                  {['NAME', 'ROLE', 'AMOUNT', '%', 'DATE', 'STATUS', ''].map(h => (
                    <th key={h} className="font-heading font-semibold uppercase text-[9.5px] tracking-[0.08em] text-ink/50 text-left pb-2 pr-3 last:pr-0">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {commData.commissions.map(c => (
                  <tr key={c.id} className="border-b border-divider last:border-0">
                    <td className="font-body text-[12px] text-ink py-2.5 pr-3">{c.teamMemberName || '—'}</td>
                    <td className="py-2.5 pr-3"><Tag variant="outline">{c.role}</Tag></td>
                    <td className="font-heading font-semibold tabular-nums text-[12px] text-ink py-2.5 pr-3">{eur(c.amount)}</td>
                    <td className="font-heading tabular-nums text-[12px] text-ink/50 py-2.5 pr-3">{c.percentage}%</td>
                    <td className="font-body text-[11px] text-ink/50 py-2.5 pr-3">{formatDate(c.date)}</td>
                    <td className="py-2.5 pr-3">
                      <Tag variant={c.status === 'PAID OUT' ? 'accent' : c.status === 'REVERSED' ? 'danger' : 'neutral'}>
                        {c.status}
                      </Tag>
                    </td>
                    <td className="py-2.5">
                      {c.status === 'CALCULATED' && (
                        <button
                          onClick={() => handlePayout(c.id)}
                          disabled={payingId === c.id}
                          className="font-heading font-semibold uppercase text-[10px] tracking-[0.06em] px-3 py-1.5 border border-accent text-accent hover:bg-accent hover:text-white transition-colors disabled:opacity-50"
                        >
                          {payingId === c.id ? 'PAYING...' : 'UITBETAALD'}
                        </button>
                      )}
                      {c.status === 'PAID OUT' && (
                        <Tag variant="accent">PAID OUT</Tag>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[11px] text-ink/35 font-body">
            No commissions yet. Commissions are auto-calculated when payments are confirmed.
          </p>
        )}
      </Panel>

      {/* ── Kosten ── */}
      <Panel
        title="COSTS"
        action={
          <button
            onClick={() => setShowCostForm(!showCostForm)}
            className="font-heading font-semibold uppercase text-[10px] tracking-[0.06em] px-3 py-1.5 border border-accent text-accent hover:bg-accent hover:text-white transition-colors"
          >
            {showCostForm ? 'CANCEL' : '+ ADD COST'}
          </button>
        }
      >
        {showCostForm && (
          <form onSubmit={handleAddCost} className="grid grid-cols-5 gap-3 mb-4 pb-4 border-b border-divider">
            <input
              type="text"
              placeholder="Title"
              value={costTitle}
              onChange={e => setCostTitle(e.target.value)}
              required
              className="font-body text-[12px] border border-divider px-2 py-1.5 text-ink placeholder:text-ink/30"
            />
            <input
              type="number"
              step="0.01"
              placeholder="Amount"
              value={costAmount}
              onChange={e => setCostAmount(e.target.value)}
              required
              className="font-body text-[12px] border border-divider px-2 py-1.5 text-ink placeholder:text-ink/30"
            />
            <select
              value={costCategory}
              onChange={e => setCostCategory(e.target.value)}
              className="font-body text-[12px] border border-divider px-2 py-1.5 text-ink"
            >
              {COST_CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input
              type="date"
              value={costDate}
              onChange={e => setCostDate(e.target.value)}
              required
              className="font-body text-[12px] border border-divider px-2 py-1.5 text-ink"
            />
            <button
              type="submit"
              disabled={saving}
              className="font-heading font-semibold uppercase text-[10px] tracking-[0.06em] bg-accent text-white px-3 py-1.5 hover:bg-accent-800 transition-colors disabled:opacity-50"
            >
              {saving ? 'SAVING...' : 'SAVE'}
            </button>
          </form>
        )}

        {costs.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="border-b border-divider">
                {['TITLE', 'AMOUNT', 'CATEGORY', 'DATE', 'NOTES'].map(h => (
                  <th key={h} className="font-heading font-semibold uppercase text-[9.5px] tracking-[0.08em] text-ink/50 text-left pb-2 pr-3 last:pr-0">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {costs.map(c => (
                <tr key={c.id} className="border-b border-divider last:border-0">
                  <td className="font-body text-[12px] text-ink py-2.5 pr-3">{c.title}</td>
                  <td className="font-heading font-semibold tabular-nums text-[12px] text-ink py-2.5 pr-3">{eur(c.amount)}</td>
                  <td className="py-2.5 pr-3"><Tag variant="outline">{c.category}</Tag></td>
                  <td className="font-body text-[11px] text-ink/50 py-2.5 pr-3">{formatDate(c.date)}</td>
                  <td className="font-body text-[11px] text-ink/50 py-2.5">{c.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-[11px] text-ink/35 font-body">No costs entered yet.</p>
        )}
      </Panel>
    </div>
  )
}
