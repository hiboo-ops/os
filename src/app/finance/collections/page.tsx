'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { SkeletonPage } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { KpiStrip, KpiCell } from '@/components/ui/kpi-strip'
import { ScreenHeader, SegmentedControl, Panel } from '@/components/ui/industry-ui'
import { SteelBars, GroupedSteelBars } from '@/components/ui/industry-charts'
import { eur, formatDateShort } from '@/lib/format'
import {
  Inbox, Send, Phone, MessageSquare, AlertTriangle,
  ExternalLink, CheckCircle, Clock,
} from 'lucide-react'

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-2.5 h-2.5" style={{ background: color }} />
      <span className="font-heading font-semibold uppercase text-[9.5px] tracking-[0.08em] text-ink/55">{label}</span>
    </span>
  )
}

// ── Types ──

interface CollectionKpis {
  collectionRate: number
  totalOpen: number
  overdueCount: number
  overdueAmount: number
  expectedThisWeek: number
  collectedThisMonth: number
  inDispute: number
}

interface AgingBucket { label: string; count: number; amount: number }
interface CashForecastWeek { weekLabel: string; amount: number }
interface ExpectedVsCollectedMonth { month: string; expected: number; collected: number }
interface WorklistItem {
  id: string
  account_id: string
  account_name: string
  account_email: string | null
  package_name: string | null
  installment_number: number
  amount: number
  due_date: string | null
  status: string
  collection_status: string
  promise_to_pay_date: string | null
  last_contact_at: string | null
  days_overdue: number
  priority_score: number
  priority_label: string | null
}

interface CollectionData {
  kpis: CollectionKpis
  aging: AgingBucket[]
  forecast: CashForecastWeek[]
  expectedVsCollected: ExpectedVsCollectedMonth[]
  worklist: { items: WorklistItem[]; nextCursor: string | null }
}

type ViewMode = 'werklijst' | 'kanban' | 'kalender'

// ── Collection Status columns for Kanban ──
// Mono steel steps — red only for the dispute signal.
const KANBAN_COLUMNS = [
  { key: 'OPEN', label: 'Te innen', color: 'bg-accent-800' },
  { key: 'REMINDER_SENT', label: 'Reminder', color: 'bg-accent-600' },
  { key: 'CONTACTED', label: 'Gecontacteerd', color: 'bg-accent-500' },
  { key: 'PROMISE_TO_PAY', label: 'Toegezegd', color: 'bg-accent-400' },
  { key: 'DISPUTE', label: 'Geschil', color: 'bg-[var(--color-danger)]' },
]

// ── Activity type icons ──
const activityIcons: Record<string, { icon: typeof Phone; label: string }> = {
  CONTACT: { icon: Phone, label: 'Contact loggen' },
  REMINDER: { icon: Send, label: 'Reminder sturen' },
  PAYMENT_LINK: { icon: ExternalLink, label: 'Betaallink sturen' },
  NOTE: { icon: MessageSquare, label: 'Notitie' },
  PROMISE: { icon: Clock, label: 'Belofte registreren' },
  DISPUTE: { icon: AlertTriangle, label: 'Geschil melden' },
  PAID: { icon: CheckCircle, label: 'Markeer betaald' },
}

export default function CollectionsPage() {
  const [type, setType] = useState<'legacy' | 'nieuw'>('legacy')
  const [data, setData] = useState<CollectionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<ViewMode>('werklijst')

  // Activity modal
  const [activityTarget, setActivityTarget] = useState<WorklistItem | null>(null)
  const [activityType, setActivityType] = useState('')
  const [activityNote, setActivityNote] = useState('')
  const [activityPromiseDate, setActivityPromiseDate] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(() => {
    setLoading(true)
    fetch(`/api/collections?type=${type}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false))
  }, [type])

  useEffect(() => { fetchData() }, [fetchData])

  const handleLogActivity = async () => {
    if (!activityTarget || !activityType) return
    setSaving(true)
    await fetch('/api/collection-activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        incoming_payment_id: activityTarget.id,
        account_id: activityTarget.account_id,
        type: activityType,
        note: activityNote || null,
        promise_date: activityType === 'PROMISE' ? activityPromiseDate || null : null,
      }),
    })
    setSaving(false)
    setActivityTarget(null)
    setActivityType('')
    setActivityNote('')
    setActivityPromiseDate('')
    fetchData()
  }

  if (loading && !data) return <SkeletonPage />

  const kpis = data?.kpis
  const items = data?.worklist.items || []

  return (
    <div>
      {/* Header + Toggle */}
      <ScreenHeader
        eyebrow="REVENUE / FINANCE"
        title="Collections"
        right={
          <SegmentedControl<'legacy' | 'nieuw'>
            options={[{ value: 'legacy', label: 'Legacy' }, { value: 'nieuw', label: 'New' }]}
            value={type} onChange={setType}
          />
        }
      />

      {/* KPI strip */}
      <div className="mb-6">
        <KpiStrip cols={6}>
          <KpiCell size="sm" label="Collection Rate" value={`${kpis?.collectionRate ?? 0}%`} caption="target 98%" />
          <KpiCell size="sm" label="Total Open" value={eur(kpis?.totalOpen ?? 0)} />
          <KpiCell size="sm" label="Overdue" value={eur(kpis?.overdueAmount ?? 0)} caption={`${kpis?.overdueCount ?? 0} installments`} danger={(kpis?.overdueCount ?? 0) > 0} />
          <KpiCell size="sm" label="Expected This Week" value={eur(kpis?.expectedThisWeek ?? 0)} />
          <KpiCell size="sm" label="Collected This Month" value={eur(kpis?.collectedThisMonth ?? 0)} />
          <KpiCell size="sm" label="In Dispute" value={eur(kpis?.inDispute ?? 0)} danger={(kpis?.inDispute ?? 0) > 0} />
        </KpiStrip>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-[22px] mb-6">
        <Panel title="Ageing Outstanding">
          <div className="h-[170px]">
            <SteelBars
              labels={(data?.aging || []).map((b) => b.label)}
              data={(data?.aging || []).map((b) => b.amount)}
              danger={(data?.aging || []).map((b) => /90/.test(b.label))}
            />
          </div>
        </Panel>
        <Panel title="Cash Forecast · 12 Weeks">
          <div className="h-[170px]">
            <SteelBars labels={(data?.forecast || []).map((w) => w.weekLabel)} data={(data?.forecast || []).map((w) => w.amount)} />
          </div>
        </Panel>
        <Panel
          title="Expected vs Collected"
          action={<div className="flex items-center gap-3"><LegendSwatch color="#d6ebff" label="Expected" /><LegendSwatch color="#416180" label="Collected" /></div>}
        >
          <div className="h-[170px]">
            <GroupedSteelBars
              labels={(data?.expectedVsCollected || []).map((m) => m.month.slice(0, 3).toUpperCase())}
              a={(data?.expectedVsCollected || []).map((m) => m.expected)}
              b={(data?.expectedVsCollected || []).map((m) => m.collected)}
            />
          </div>
        </Panel>
      </div>

      {/* View Toggle */}
      <div className="flex items-center gap-3 mb-4">
        <h2 className="font-heading font-semibold uppercase text-[11px] tracking-[0.08em] text-ink/50">Work View</h2>
        <SegmentedControl<ViewMode>
          size="sm"
          options={[{ value: 'werklijst', label: 'Worklist' }, { value: 'kanban', label: 'Kanban' }, { value: 'kalender', label: 'Calendar' }]}
          value={view} onChange={setView}
        />
      </div>

      {/* Views */}
      {items.length === 0 && type === 'nieuw' ? (
        <EmptyState
          icon={Inbox}
          title="Geen termijnen"
          description="Er zijn nog geen niet-legacy termijnen om te innen."
        />
      ) : view === 'werklijst' ? (
        <WorklistView items={items} onAction={setActivityTarget} />
      ) : view === 'kanban' ? (
        <KanbanView items={items} onAction={setActivityTarget} />
      ) : (
        <CalendarView items={items} onAction={setActivityTarget} />
      )}

      {/* Activity Modal */}
      {activityTarget && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={() => setActivityTarget(null)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 w-full max-w-md p-6 relative">
              <h3 className="text-base font-semibold text-gray-900 mb-1">Actie loggen</h3>
              <p className="text-sm text-gray-500 mb-4">
                {activityTarget.account_name} — #{activityTarget.installment_number} ({eur(activityTarget.amount)})
              </p>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Type</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(activityIcons).map(([key, { icon: Icon, label }]) => (
                      <button
                        key={key}
                        onClick={() => setActivityType(key)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                          activityType === key
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {activityType === 'PROMISE' && (
                  <div>
                    <label className="text-xs font-medium text-gray-700 mb-1 block">Beloofde betaaldatum</label>
                    <input
                      type="date"
                      value={activityPromiseDate}
                      onChange={(e) => setActivityPromiseDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Notitie</label>
                  <textarea
                    value={activityNote}
                    onChange={(e) => setActivityNote(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none"
                    placeholder="Optioneel..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setActivityTarget(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Annuleren
                </button>
                <button
                  onClick={handleLogActivity}
                  disabled={!activityType || saving}
                  className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Opslaan...' : 'Opslaan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Werklijst View ──

function WorklistView({
  items,
  onAction,
}: {
  items: WorklistItem[]
  onAction: (item: WorklistItem) => void
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="grid grid-cols-[1fr_120px_100px_100px_120px_140px] gap-4 px-5 py-3 border-b border-gray-100 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
        <div>Klant</div>
        <div className="text-right">Bedrag</div>
        <div className="text-center">Dagen</div>
        <div>Status</div>
        <div>Laatst contact</div>
        <div>Acties</div>
      </div>

      {items.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm text-gray-400">Geen openstaande termijnen</div>
      ) : (
        items.map((item) => (
          <div
            key={item.id}
            className="grid grid-cols-[1fr_120px_100px_100px_120px_140px] gap-4 px-5 py-3.5 border-b border-gray-50 items-center hover:bg-gray-50/50 transition-colors"
          >
            <div>
              <Link
                href={`/finance/accounts/${item.account_id}`}
                className="text-sm font-medium text-gray-900 hover:text-gray-700 transition-colors"
              >
                {item.account_name}
              </Link>
              <div className="text-xs text-gray-500 mt-0.5">
                #{item.installment_number}
                {item.package_name && <span className="ml-1.5">· {item.package_name}</span>}
                {item.due_date && <span className="ml-1.5">· verval {formatDateShort(item.due_date)}</span>}
              </div>
              {item.priority_label && (
                <span className="inline-flex items-center text-[10px] font-semibold rounded px-1.5 py-0.5 mt-1 text-red-700 bg-red-50 border border-red-200">
                  {item.priority_label}
                </span>
              )}
            </div>
            <div className="text-sm font-medium text-gray-900 text-right tabular-nums">{eur(item.amount)}</div>
            <div className="text-center">
              {item.days_overdue > 0 ? (
                <span className="inline-flex items-center text-[11px] font-semibold rounded-md px-2 py-0.5 tabular-nums text-red-600 bg-red-50">
                  {item.days_overdue}d
                </span>
              ) : (
                <span className="text-xs text-gray-400">—</span>
              )}
            </div>
            <div>
              <Badge status={item.collection_status} />
            </div>
            <div className="text-xs text-gray-500 tabular-nums">
              {item.last_contact_at
                ? new Date(item.last_contact_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
                : '—'}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onAction(item)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                <Phone className="w-3 h-3" strokeWidth={1.75} />
                Log
              </button>
              <Link
                href={`/finance/accounts/${item.account_id}`}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Detail
              </Link>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

// ── Kanban View ──

function KanbanView({
  items,
  onAction,
}: {
  items: WorklistItem[]
  onAction: (item: WorklistItem) => void
}) {
  return (
    <div className="grid grid-cols-5 gap-3">
      {KANBAN_COLUMNS.map((col) => {
        const colItems = items.filter((i) => i.collection_status === col.key)
        return (
          <div key={col.key} className="bg-gray-50 rounded-lg min-h-[200px]">
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-200">
              <div className={`w-2 h-2 rounded-full ${col.color}`} />
              <span className="text-xs font-semibold text-gray-700">{col.label}</span>
              <span className="text-[10px] font-medium text-gray-400 ml-auto">{colItems.length}</span>
            </div>
            <div className="p-2 space-y-2">
              {colItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onAction(item)}
                  className="w-full text-left bg-white rounded-lg border border-gray-200 p-3 hover:border-gray-300 transition-colors"
                >
                  <div className="text-sm font-medium text-gray-900 truncate">{item.account_name}</div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-xs text-gray-500">#{item.installment_number}</span>
                    <span className="text-sm font-medium text-gray-900 tabular-nums">{eur(item.amount)}</span>
                  </div>
                  {item.days_overdue > 0 && (
                    <div className="mt-1.5">
                      <span className="text-[10px] font-semibold text-red-600 bg-red-50 rounded px-1.5 py-0.5">
                        {item.days_overdue}d te laat
                      </span>
                    </div>
                  )}
                  {item.priority_label && (
                    <div className="mt-1">
                      <span className="text-[10px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
                        {item.priority_label}
                      </span>
                    </div>
                  )}
                </button>
              ))}
              {colItems.length === 0 && (
                <div className="text-center py-6 text-xs text-gray-400">Leeg</div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Calendar View ──

function CalendarView({
  items,
  onAction,
}: {
  items: WorklistItem[]
  onAction: (item: WorklistItem) => void
}) {
  // Group items by due_date week
  const now = new Date()
  const weeks: { label: string; start: Date; end: Date }[] = []
  const mondayThisWeek = new Date(now)
  const day = mondayThisWeek.getDay()
  mondayThisWeek.setDate(mondayThisWeek.getDate() - day + (day === 0 ? -6 : 1))
  mondayThisWeek.setHours(0, 0, 0, 0)

  // Show overdue + 8 weeks
  weeks.push({
    label: 'Achterstallig',
    start: new Date(2000, 0, 1),
    end: new Date(mondayThisWeek.getTime() - 1),
  })
  for (let i = 0; i < 8; i++) {
    const start = new Date(mondayThisWeek.getTime() + i * 7 * 86400000)
    const end = new Date(start.getTime() + 6 * 86400000)
    const label = i === 0
      ? 'Deze week'
      : i === 1
        ? 'Volgende week'
        : `${start.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}`
    weeks.push({ label, start, end })
  }

  return (
    <div className="space-y-4">
      {weeks.map((week, wi) => {
        const weekItems = items.filter((item) => {
          if (!item.due_date) return wi === 0 // no date → overdue bucket
          const d = new Date(item.due_date)
          return d >= week.start && d <= week.end
        })
        if (weekItems.length === 0 && wi > 0) return null
        return (
          <div key={wi} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900">{week.label}</span>
              <span className="text-xs text-gray-400">{weekItems.length} termijnen · {eur(weekItems.reduce((s, i) => s + i.amount, 0))}</span>
            </div>
            {weekItems.length === 0 ? (
              <div className="px-5 py-6 text-center text-xs text-gray-400">Geen termijnen</div>
            ) : (
              weekItems.map((item) => (
                <div key={item.id} className="flex items-center gap-4 px-5 py-3 border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <Link href={`/finance/accounts/${item.account_id}`} className="text-sm font-medium text-gray-900 hover:text-gray-700">
                      {item.account_name}
                    </Link>
                    <div className="text-xs text-gray-500 mt-0.5">
                      #{item.installment_number}
                      {item.due_date && <span className="ml-1.5">· {formatDateShort(item.due_date)}</span>}
                    </div>
                  </div>
                  <Badge status={item.collection_status} />
                  <div className="text-sm font-medium text-gray-900 tabular-nums w-24 text-right">{eur(item.amount)}</div>
                  <button
                    onClick={() => onAction(item)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                  >
                    <Phone className="w-3 h-3" strokeWidth={1.75} />
                    Log
                  </button>
                </div>
              ))
            )}
          </div>
        )
      })}
    </div>
  )
}
