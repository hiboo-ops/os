import { getSupabaseAdmin } from '@/lib/supabase-admin'

// ── TYPES ──

export type CollectionStatus =
  | 'OPEN'
  | 'REMINDER_SENT'
  | 'CONTACTED'
  | 'PROMISE_TO_PAY'
  | 'DISPUTE'
  | 'ESCALATED'

export type ActivityType =
  | 'REMINDER'
  | 'CONTACT'
  | 'NOTE'
  | 'PROMISE'
  | 'DISPUTE'
  | 'PAYMENT_LINK'
  | 'PAID'

export interface CollectionKpis {
  collectionRate: number // percentage
  totalOpen: number
  overdueCount: number
  overdueAmount: number
  expectedThisWeek: number
  collectedThisMonth: number
  inDispute: number
}

export interface AgingBucket {
  label: string
  count: number
  amount: number
}

export interface CashForecastWeek {
  weekLabel: string
  amount: number
}

export interface ExpectedVsCollectedMonth {
  month: string
  expected: number
  collected: number
}

export interface WorklistItem {
  id: string // incoming_payment id
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

// ── HELPERS ──

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function startOfWeek(d: Date): Date {
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday
  return new Date(d.getFullYear(), d.getMonth(), diff)
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function monthKey(d: Date): string {
  return d.toLocaleDateString('nl-NL', { month: 'short', year: 'numeric' })
}

// ── KPI's ──

export async function getCollectionKpis(isLegacy: boolean): Promise<CollectionKpis> {
  const admin = getSupabaseAdmin()
  const today = todayStr()

  // All incoming_payments for accounts matching is_legacy
  const { data: rows } = await admin
    .from('incoming_payments')
    .select('amount, due_date, status, collection_status, account:accounts!inner(is_legacy)')
    .eq('accounts.is_legacy', isLegacy)

  const all = (rows || []) as unknown as {
    amount: number
    due_date: string | null
    status: string
    collection_status: string
  }[]

  let totalOpen = 0
  let overdueCount = 0
  let overdueAmount = 0
  let inDispute = 0
  let paidCount = 0
  let totalCount = all.length

  // Expected this week
  const now = new Date()
  const weekStart = startOfWeek(now)
  const weekEnd = addDays(weekStart, 6)
  const weekStartStr = weekStart.toISOString().slice(0, 10)
  const weekEndStr = weekEnd.toISOString().slice(0, 10)
  let expectedThisWeek = 0

  for (const row of all) {
    if (row.status === 'PAID' || row.status === 'REFUNDED') {
      paidCount++
      continue
    }
    totalOpen += row.amount
    if (row.due_date && row.due_date < today) {
      overdueCount++
      overdueAmount += row.amount
    }
    if (row.due_date && row.due_date >= weekStartStr && row.due_date <= weekEndStr) {
      expectedThisWeek += row.amount
    }
    if (row.collection_status === 'DISPUTE' || row.collection_status === 'ESCALATED') {
      inDispute += row.amount
    }
  }

  // Collected this month (paid payments linked to matching accounts)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const { data: paidRows } = await admin
    .from('payments')
    .select('amount, paid_date, account:accounts!inner(is_legacy)')
    .eq('accounts.is_legacy', isLegacy)
    .eq('paid', true)
    .gte('paid_date', monthStart)

  const collectedThisMonth = (paidRows || []).reduce(
    (s, r) => s + (Number((r as { amount: number }).amount) || 0),
    0,
  )

  const collectionRate = totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0

  return {
    collectionRate,
    totalOpen,
    overdueCount,
    overdueAmount,
    expectedThisWeek,
    collectedThisMonth,
    inDispute,
  }
}

// ── AGING BUCKETS ──

export async function getAgingBuckets(isLegacy: boolean): Promise<AgingBucket[]> {
  const admin = getSupabaseAdmin()
  const today = todayStr()

  const { data: rows } = await admin
    .from('incoming_payments')
    .select('amount, due_date, account:accounts!inner(is_legacy)')
    .eq('accounts.is_legacy', isLegacy)
    .not('status', 'in', '("PAID","REFUNDED")')

  const buckets: AgingBucket[] = [
    { label: 'Niet vervallen', count: 0, amount: 0 },
    { label: '1–30 dagen', count: 0, amount: 0 },
    { label: '31–60 dagen', count: 0, amount: 0 },
    { label: '61–90 dagen', count: 0, amount: 0 },
    { label: '90+ dagen', count: 0, amount: 0 },
  ]

  for (const row of (rows || []) as { amount: number; due_date: string | null }[]) {
    if (!row.due_date || row.due_date >= today) {
      buckets[0].count++
      buckets[0].amount += row.amount
    } else {
      const daysLate = Math.floor(
        (new Date(today).getTime() - new Date(row.due_date).getTime()) / 86400000,
      )
      if (daysLate <= 30) {
        buckets[1].count++
        buckets[1].amount += row.amount
      } else if (daysLate <= 60) {
        buckets[2].count++
        buckets[2].amount += row.amount
      } else if (daysLate <= 90) {
        buckets[3].count++
        buckets[3].amount += row.amount
      } else {
        buckets[4].count++
        buckets[4].amount += row.amount
      }
    }
  }

  return buckets
}

// ── CASH FORECAST (12 weeks) ──

export async function getCashForecast(isLegacy: boolean): Promise<CashForecastWeek[]> {
  const admin = getSupabaseAdmin()
  const now = new Date()
  const weekStart = startOfWeek(now)

  // Fetch all open payments with future due dates (+ overdue for week 0)
  const { data: rows } = await admin
    .from('incoming_payments')
    .select('amount, due_date, account:accounts!inner(is_legacy)')
    .eq('accounts.is_legacy', isLegacy)
    .not('status', 'in', '("PAID","REFUNDED")')

  const weeks: CashForecastWeek[] = []
  for (let i = 0; i < 12; i++) {
    const ws = addDays(weekStart, i * 7)
    const we = addDays(ws, 6)
    weeks.push({
      weekLabel: `W${i + 1} (${ws.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })})`,
      amount: 0,
    })
    const wsStr = ws.toISOString().slice(0, 10)
    const weStr = we.toISOString().slice(0, 10)

    for (const row of (rows || []) as { amount: number; due_date: string | null }[]) {
      if (!row.due_date) continue
      // Overdue items go into week 0
      if (i === 0 && row.due_date < wsStr) {
        weeks[i].amount += row.amount
      } else if (row.due_date >= wsStr && row.due_date <= weStr) {
        weeks[i].amount += row.amount
      }
    }
  }

  return weeks
}

// ── EXPECTED VS COLLECTED (per month, last 6 months) ──

export async function getExpectedVsCollected(isLegacy: boolean): Promise<ExpectedVsCollectedMonth[]> {
  const admin = getSupabaseAdmin()
  const now = new Date()

  // Build 6 months
  const months: { key: string; start: string; end: string }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    months.push({
      key: monthKey(d),
      start: d.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    })
  }

  const sixMonthsAgo = months[0].start

  // Expected: due_date in range
  const { data: expected } = await admin
    .from('incoming_payments')
    .select('amount, due_date, account:accounts!inner(is_legacy)')
    .eq('accounts.is_legacy', isLegacy)
    .gte('due_date', sixMonthsAgo)

  // Collected: paid_date in range
  const { data: collected } = await admin
    .from('payments')
    .select('amount, paid_date, account:accounts!inner(is_legacy)')
    .eq('accounts.is_legacy', isLegacy)
    .eq('paid', true)
    .gte('paid_date', sixMonthsAgo)

  return months.map((m) => {
    const exp = (expected || [])
      .filter((r) => {
        const dd = (r as { due_date: string | null }).due_date
        return dd && dd >= m.start && dd <= m.end
      })
      .reduce((s, r) => s + (Number((r as { amount: number }).amount) || 0), 0)

    const col = (collected || [])
      .filter((r) => {
        const pd = (r as { paid_date: string | null }).paid_date
        return pd && pd >= m.start && pd <= m.end
      })
      .reduce((s, r) => s + (Number((r as { amount: number }).amount) || 0), 0)

    return { month: m.key, expected: exp, collected: col }
  })
}

// ── COLLECTION WORKLIST (prioritized, paginated) ──

export async function getCollectionWorklist(
  isLegacy: boolean,
  opts: {
    cursor?: string // incoming_payment id for keyset pagination
    limit?: number
    statusFilter?: string
  } = {},
): Promise<{ items: WorklistItem[]; nextCursor: string | null }> {
  const admin = getSupabaseAdmin()
  const today = todayStr()
  const limit = opts.limit || 50

  // We need a raw query for priority sorting. Use RPC or build with multiple queries.
  // Supabase JS doesn't support complex ORDER BY expressions, so we fetch + sort in JS.
  // For scale this should be an RPC, but with <200 rows this is fine.

  let query = admin
    .from('incoming_payments')
    .select(`
      id, installment_number, amount, due_date, status, collection_status,
      promise_to_pay_date, last_contact_at,
      account:accounts!inner(id, name, email, is_legacy),
      contract:contracts(id, name)
    `)
    .eq('accounts.is_legacy', isLegacy)
    .not('status', 'in', '("PAID","REFUNDED")')

  if (opts.statusFilter) {
    query = query.eq('collection_status', opts.statusFilter)
  }

  const { data: rows } = await query

  // Build worklist items with priority scoring
  const items: WorklistItem[] = (rows || []).map((row) => {
    const r = row as unknown as {
      id: string
      installment_number: number
      amount: number
      due_date: string | null
      status: string
      collection_status: string
      promise_to_pay_date: string | null
      last_contact_at: string | null
      account: { id: string; name: string; email: string | null }
      contract: { id: string; name: string } | null
    }

    const daysOverdue = r.due_date && r.due_date < today
      ? Math.floor((new Date(today).getTime() - new Date(r.due_date).getTime()) / 86400000)
      : 0

    // Priority: 1) expired promise_to_pay_date, 2) overdue days*amount desc, 3) upcoming
    let priorityScore = 0
    let priorityLabel: string | null = null

    if (
      r.promise_to_pay_date &&
      r.promise_to_pay_date < today &&
      r.collection_status === 'PROMISE_TO_PAY'
    ) {
      priorityScore = 1_000_000_000 // highest
      priorityLabel = 'Belofte verlopen'
    } else if (daysOverdue > 0) {
      priorityScore = daysOverdue * r.amount
    }
    // Upcoming: negative priority (sort last)
    if (daysOverdue === 0 && r.due_date && r.due_date >= today) {
      priorityScore = -1
    }

    return {
      id: r.id,
      account_id: r.account.id,
      account_name: r.account.name,
      account_email: r.account.email,
      package_name: r.contract?.name || null,
      installment_number: r.installment_number,
      amount: r.amount,
      due_date: r.due_date,
      status: r.status,
      collection_status: r.collection_status,
      promise_to_pay_date: r.promise_to_pay_date,
      last_contact_at: r.last_contact_at,
      days_overdue: daysOverdue,
      priority_score: priorityScore,
      priority_label: priorityLabel,
    }
  })

  // Sort: highest priority first, then by score descending
  items.sort((a, b) => b.priority_score - a.priority_score)

  // Keyset pagination: find cursor position
  let startIdx = 0
  if (opts.cursor) {
    const cursorIdx = items.findIndex((i) => i.id === opts.cursor)
    if (cursorIdx >= 0) startIdx = cursorIdx + 1
  }

  const page = items.slice(startIdx, startIdx + limit)
  const nextCursor = page.length === limit ? page[page.length - 1].id : null

  return { items: page, nextCursor }
}

// ── LOG COLLECTION ACTIVITY ──

export async function logCollectionActivity(input: {
  incoming_payment_id: string
  account_id: string
  type: ActivityType
  note?: string | null
  outcome?: string | null
  promise_date?: string | null
  created_by?: string | null
}) {
  const admin = getSupabaseAdmin()

  // Insert activity
  const { data: activity, error } = await admin
    .from('collection_activities')
    .insert({
      incoming_payment_id: input.incoming_payment_id,
      account_id: input.account_id,
      type: input.type,
      note: input.note || null,
      outcome: input.outcome || null,
      promise_date: input.promise_date || null,
      created_by: input.created_by || null,
    })
    .select()
    .single()

  if (error) throw error

  // Update incoming_payment collection fields
  const updates: Record<string, unknown> = {
    last_contact_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  // Map activity type to collection_status
  const statusMap: Partial<Record<ActivityType, CollectionStatus>> = {
    REMINDER: 'REMINDER_SENT',
    CONTACT: 'CONTACTED',
    PROMISE: 'PROMISE_TO_PAY',
    DISPUTE: 'DISPUTE',
  }

  if (statusMap[input.type]) {
    updates.collection_status = statusMap[input.type]
  }

  if (input.type === 'PROMISE' && input.promise_date) {
    updates.promise_to_pay_date = input.promise_date
  }

  await admin
    .from('incoming_payments')
    .update(updates)
    .eq('id', input.incoming_payment_id)

  return activity
}

// ── GET ACTIVITIES FOR A PAYMENT OR ACCOUNT ──

export async function getActivitiesForAccount(accountId: string) {
  const admin = getSupabaseAdmin()

  const { data } = await admin
    .from('collection_activities')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })

  return data || []
}

export async function getActivitiesForPayment(incomingPaymentId: string) {
  const admin = getSupabaseAdmin()

  const { data } = await admin
    .from('collection_activities')
    .select('*')
    .eq('incoming_payment_id', incomingPaymentId)
    .order('created_at', { ascending: false })

  return data || []
}
