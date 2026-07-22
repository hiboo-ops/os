import { getSupabaseAdmin } from '@/lib/supabase-admin'

// ── TYPES ──

export type Period = 'all' | 'year' | 'quarter' | 'month'

export interface FinanceKpis {
  totalContracts: number
  totalDealValue: number
  cashCollected: number
  openAmount: number
  openCount: number
  paidFirstDepositsAmount: number
  paidFirstDepositsCount: number
  pendingAmount: number
  pendingCount: number
  lateAmount: number
  lateCount: number
  paidInstallmentsAmount: number
  paidInstallmentsCount: number
  collectionRate: number // percentage
  cashVsDeal: number // percentage
  avgLtv: number
  totalLtv: number
  pifCount: number
  splitCount: number
  pifPct: number // % van contracts dat Paid in Full is
  splitPct: number // % van contracts dat een termijnregeling (split) is
}

export interface MonthlyData {
  month: string // 'jan 2025'
  dealValue: number
  cash: number
  open: number
  late: number
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

export interface AttributionRow {
  id: string | null
  name: string
  cash: number
  dealValue: number
  avgLtv: number
  openAmount: number
  accountCount: number
}

export type AttributionDimension = 'closer' | 'setter' | 'source'

// ── HELPERS ──

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export function periodBounds(period: Period): { start: string; end: string } | null {
  if (period === 'all') return null
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()

  if (period === 'year') {
    return {
      start: `${y}-01-01`,
      end: `${y}-12-31`,
    }
  }
  if (period === 'quarter') {
    const qStart = Math.floor(m / 3) * 3
    const qEnd = new Date(y, qStart + 3, 0)
    return {
      start: new Date(y, qStart, 1).toISOString().slice(0, 10),
      end: qEnd.toISOString().slice(0, 10),
    }
  }
  // month
  const monthEnd = new Date(y, m + 1, 0)
  return {
    start: new Date(y, m, 1).toISOString().slice(0, 10),
    end: monthEnd.toISOString().slice(0, 10),
  }
}

function startOfWeek(d: Date): Date {
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.getFullYear(), d.getMonth(), diff)
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

const MONTH_LABELS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

function monthKey(d: Date): string {
  return `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`
}

// ── KPI's ──

export async function getFinanceKpis(
  period: Period = 'all',
  includeLegacy: boolean = true,
): Promise<FinanceKpis> {
  const admin = getSupabaseAdmin()
  const today = todayStr()
  const bounds = periodBounds(period)

  // ─ Query 1: incoming_payments ─
  const { data: ipRows } = includeLegacy
    ? await admin.from('incoming_payments').select('amount, due_date, status, installment_number, contract_id')
    : await admin.from('incoming_payments')
        .select('amount, due_date, status, installment_number, contract_id, account:accounts!inner(is_legacy)')
        .eq('accounts.is_legacy', false)

  const ips = (ipRows || []) as unknown as {
    amount: number | null
    due_date: string | null
    status: string
    installment_number: number
    contract_id: string | null
  }[]

  // Aantal termijnen per contract (voor PIF vs Split): 1 = PIF, >=2 = Split.
  const ipCountByContract: Record<string, number> = {}
  for (const ip of ips) {
    if (ip.contract_id) ipCountByContract[ip.contract_id] = (ipCountByContract[ip.contract_id] || 0) + 1
  }

  let openAmount = 0, openCount = 0
  let lateAmount = 0, lateCount = 0
  let pendingAmount = 0, pendingCount = 0
  let paidInstallmentsAmount = 0, paidInstallmentsCount = 0
  let paidFirstDepositsAmount = 0, paidFirstDepositsCount = 0
  let totalIpCount = 0

  for (const ip of ips) {
    const amt = ip.amount || 0
    const inPeriod = !bounds || (ip.due_date && ip.due_date >= bounds.start && ip.due_date <= bounds.end)

    if (ip.status === 'PAID') {
      if (inPeriod) {
        paidInstallmentsAmount += amt
        paidInstallmentsCount++
        if (ip.installment_number === 1) {
          paidFirstDepositsAmount += amt
          paidFirstDepositsCount++
        }
      }
      totalIpCount++
      continue
    }
    if (ip.status === 'REFUNDED') {
      totalIpCount++
      continue
    }

    // Not paid, not refunded → open/pending
    totalIpCount++
    if (!inPeriod) continue

    openAmount += amt
    openCount++
    pendingAmount += amt
    pendingCount++

    if (ip.due_date && ip.due_date < today) {
      lateAmount += amt
      lateCount++
    }
  }

  // ─ Query 2: payments (cash collected) ─
  const { data: payRows } = includeLegacy
    ? await admin.from('payments').select('amount, paid, paid_date, legacy')
    : await admin.from('payments')
        .select('amount, paid, paid_date, legacy, account:accounts!inner(is_legacy)')
        .eq('accounts.is_legacy', false)

  let cashCollected = 0
  for (const row of (payRows || []) as unknown as {
    amount: number | null
    paid: boolean
    paid_date: string | null
    legacy: boolean
  }[]) {
    if (!row.paid) continue
    if (!includeLegacy && row.legacy) continue
    const inPeriod = !bounds || (row.paid_date && row.paid_date >= bounds.start && row.paid_date <= bounds.end)
    if (inPeriod) cashCollected += row.amount || 0
  }

  // ─ Query 3: contracts ─
  const { data: ctRows } = includeLegacy
    ? await admin.from('contracts').select('id, deal_value, payment_plan, created_at')
    : await admin.from('contracts')
        .select('id, deal_value, payment_plan, created_at, account:accounts!inner(is_legacy)')
        .eq('accounts.is_legacy', false)

  let totalContracts = 0, totalDealValue = 0
  let pifCount = 0, splitCount = 0
  for (const row of (ctRows || []) as unknown as {
    id: string
    deal_value: number | null
    payment_plan: string | null
    created_at: string
  }[]) {
    const inPeriod = !bounds || (row.created_at && row.created_at.slice(0, 10) >= bounds.start && row.created_at.slice(0, 10) <= bounds.end)
    if (inPeriod) {
      totalContracts++
      totalDealValue += row.deal_value || 0
      // PIF vs Split: primair op aantal termijnen; fallback op payment_plan-tekst.
      const ipCount = ipCountByContract[row.id]
      const pp = (row.payment_plan || '').toLowerCase()
      const isSplit = ipCount != null
        ? ipCount >= 2
        : /(\d+)\s*(installment|termijn)/.test(pp) ? Number(pp.match(/(\d+)/)?.[1]) >= 2 : !pp.includes('paid in full')
      if (isSplit) splitCount++
      else pifCount++
    }
  }
  const pifPct = totalContracts > 0 ? Math.round((pifCount / totalContracts) * 100) : 0
  const splitPct = totalContracts > 0 ? Math.round((splitCount / totalContracts) * 100) : 0

  // ─ Query 4: LTV ─
  let ltvQuery = admin.from('accounts').select('ltv, created_at')
  if (!includeLegacy) {
    ltvQuery = ltvQuery.eq('is_legacy', false)
  }
  const { data: ltvRows } = await ltvQuery

  let totalLtv = 0, ltvAccountCount = 0
  for (const row of (ltvRows || []) as unknown as { ltv: number | null; created_at: string }[]) {
    const ltv = row.ltv || 0
    if (ltv <= 0) continue
    const inPeriod = !bounds || (row.created_at && row.created_at.slice(0, 10) >= bounds.start && row.created_at.slice(0, 10) <= bounds.end)
    if (inPeriod) {
      totalLtv += ltv
      ltvAccountCount++
    }
  }
  const avgLtv = ltvAccountCount > 0 ? Math.round(totalLtv / ltvAccountCount) : 0

  // Collection rate: paid / total
  const collectionRate = totalIpCount > 0
    ? Math.round((paidInstallmentsCount / (paidInstallmentsCount + pendingCount)) * 100)
    : 0

  // Cash vs deal value
  const cashVsDeal = totalDealValue > 0
    ? Math.round((cashCollected / totalDealValue) * 100)
    : 0

  return {
    totalContracts,
    totalDealValue,
    cashCollected,
    openAmount,
    openCount,
    paidFirstDepositsAmount,
    paidFirstDepositsCount,
    pendingAmount,
    pendingCount,
    lateAmount,
    lateCount,
    paidInstallmentsAmount,
    paidInstallmentsCount,
    collectionRate,
    cashVsDeal,
    avgLtv,
    totalLtv,
    pifCount,
    splitCount,
    pifPct,
    splitPct,
  }
}

// ── MONTHLY BREAKDOWN (12 months, 4 series) ──

export async function getMonthlyBreakdown(includeLegacy: boolean = true): Promise<MonthlyData[]> {
  const admin = getSupabaseAdmin()
  const now = new Date()
  const today = todayStr()

  // Build 12 month buckets
  const months: { key: string; start: string; end: string }[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    months.push({
      key: monthKey(d),
      start: d.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    })
  }

  const twelveMonthsAgo = months[0].start

  // Contracts → deal value per month
  const { data: ctRows } = includeLegacy
    ? await admin.from('contracts').select('deal_value, created_at').gte('created_at', twelveMonthsAgo)
    : await admin.from('contracts')
        .select('deal_value, created_at, account:accounts!inner(is_legacy)')
        .eq('accounts.is_legacy', false)
        .gte('created_at', twelveMonthsAgo)

  // Payments → cash per month
  const { data: payRows } = includeLegacy
    ? await admin.from('payments').select('amount, paid_date, paid, legacy').eq('paid', true).gte('paid_date', twelveMonthsAgo)
    : await admin.from('payments')
        .select('amount, paid_date, paid, legacy, account:accounts!inner(is_legacy)')
        .eq('accounts.is_legacy', false)
        .eq('paid', true)
        .gte('paid_date', twelveMonthsAgo)

  // Incoming payments → open + late per month
  const { data: ipRows } = includeLegacy
    ? await admin.from('incoming_payments').select('amount, due_date, status').not('status', 'in', '("PAID","REFUNDED")').gte('due_date', twelveMonthsAgo)
    : await admin.from('incoming_payments')
        .select('amount, due_date, status, account:accounts!inner(is_legacy)')
        .eq('accounts.is_legacy', false)
        .not('status', 'in', '("PAID","REFUNDED")')
        .gte('due_date', twelveMonthsAgo)

  return months.map((m) => {
    const dealValue = (ctRows || [])
      .filter((r) => {
        const ca = (r as { created_at: string }).created_at?.slice(0, 10)
        return ca && ca >= m.start && ca <= m.end
      })
      .reduce((s, r) => s + ((r as { deal_value: number | null }).deal_value || 0), 0)

    const cash = (payRows || [])
      .filter((r) => {
        const row = r as { paid_date: string | null; legacy: boolean }
        if (!includeLegacy && row.legacy) return false
        return row.paid_date && row.paid_date >= m.start && row.paid_date <= m.end
      })
      .reduce((s, r) => s + ((r as { amount: number | null }).amount || 0), 0)

    let open = 0, late = 0
    for (const r of (ipRows || []) as unknown as { amount: number | null; due_date: string | null }[]) {
      if (!r.due_date || r.due_date < m.start || r.due_date > m.end) continue
      const amt = r.amount || 0
      open += amt
      if (r.due_date < today) late += amt
    }

    return { month: m.key, dealValue, cash, open, late }
  })
}

// ── AGING BUCKETS (all, optionally filter legacy) ──

export async function getAgingBucketsAll(includeLegacy: boolean = true): Promise<AgingBucket[]> {
  const admin = getSupabaseAdmin()
  const today = todayStr()

  const { data: rows } = includeLegacy
    ? await admin.from('incoming_payments').select('amount, due_date').not('status', 'in', '("PAID","REFUNDED")')
    : await admin.from('incoming_payments')
        .select('amount, due_date, account:accounts!inner(is_legacy)')
        .eq('accounts.is_legacy', false)
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
      const idx = daysLate <= 30 ? 1 : daysLate <= 60 ? 2 : daysLate <= 90 ? 3 : 4
      buckets[idx].count++
      buckets[idx].amount += row.amount
    }
  }

  return buckets
}

// ── CASH FORECAST (12 weeks, optionally filter legacy) ──

export async function getCashForecastAll(includeLegacy: boolean = true): Promise<CashForecastWeek[]> {
  const admin = getSupabaseAdmin()
  const now = new Date()
  const ws = startOfWeek(now)

  const { data: rows } = includeLegacy
    ? await admin.from('incoming_payments').select('amount, due_date').not('status', 'in', '("PAID","REFUNDED")')
    : await admin.from('incoming_payments')
        .select('amount, due_date, account:accounts!inner(is_legacy)')
        .eq('accounts.is_legacy', false)
        .not('status', 'in', '("PAID","REFUNDED")')

  const weeks: CashForecastWeek[] = []
  for (let i = 0; i < 12; i++) {
    const weekStart = addDays(ws, i * 7)
    const weekEnd = addDays(weekStart, 6)
    const wsStr = weekStart.toISOString().slice(0, 10)
    const weStr = weekEnd.toISOString().slice(0, 10)

    let amount = 0
    for (const row of (rows || []) as { amount: number; due_date: string | null }[]) {
      if (!row.due_date) continue
      if (i === 0 && row.due_date < wsStr) {
        amount += row.amount // overdue into week 0
      } else if (row.due_date >= wsStr && row.due_date <= weStr) {
        amount += row.amount
      }
    }

    weeks.push({
      weekLabel: `W${i + 1} (${weekStart.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })})`,
      amount,
    })
  }

  return weeks
}

// ── ATTRIBUTION ──

export async function getAttributionData(
  dimension: AttributionDimension,
  period: Period = 'all',
  includeLegacy: boolean = true,
): Promise<AttributionRow[]> {
  const admin = getSupabaseAdmin()
  const bounds = periodBounds(period)

  // 1. Get accounts with the relevant FK + ltv
  const fkField = dimension === 'source' ? 'source' : `${dimension}_id`
  const selectFields = dimension === 'source'
    ? 'id, source, ltv, is_legacy'
    : `id, ${fkField}, ltv, is_legacy`

  let accQuery = admin.from('accounts').select(selectFields)
  if (!includeLegacy) accQuery = accQuery.eq('is_legacy', false)
  const { data: accounts } = await accQuery

  if (!accounts || accounts.length === 0) return []

  const accs = accounts as unknown as Record<string, unknown>[]
  const accountIds = accs.map((a) => a.id as string)

  // 2. Get payments for cash
  let paySelect = 'amount, paid, paid_date, account_id, legacy'
  let payQuery = admin.from('payments').select(paySelect).eq('paid', true).in('account_id', accountIds)
  const { data: payRows } = await payQuery

  // 3. Get incoming_payments for open amount
  let ipSelect = 'amount, due_date, account_id'
  let ipQuery = admin.from('incoming_payments').select(ipSelect)
    .not('status', 'in', '("PAID","REFUNDED")')
    .in('account_id', accountIds)
  const { data: ipRows } = await ipQuery

  // 4. Get contracts for deal value
  let ctSelect = 'deal_value, created_at, account_id'
  let ctQuery = admin.from('contracts').select(ctSelect).in('account_id', accountIds)
  const { data: ctRows } = await ctQuery

  // 5. Resolve names for closer/setter
  let nameMap: Record<string, string> = {}
  if (dimension !== 'source') {
    const table = dimension === 'closer' ? 'closers' : 'setters'
    const { data: people } = await admin.from(table).select('id, name')
    for (const p of (people || []) as { id: string; name: string }[]) {
      nameMap[p.id] = p.name
    }
  }

  // 6. Group by dimension
  const groups: Record<string, {
    id: string | null
    name: string
    cash: number
    dealValue: number
    ltvSum: number
    openAmount: number
    accountIds: Set<string>
  }> = {}

  for (const acc of accs) {
    const groupKey = dimension === 'source'
      ? (acc.source as string || 'Onbekend')
      : (acc[fkField] as string || 'Onbekend')

    if (!groups[groupKey]) {
      const name = dimension === 'source'
        ? groupKey
        : (nameMap[groupKey] || 'Onbekend')
      groups[groupKey] = {
        id: dimension === 'source' ? null : groupKey,
        name,
        cash: 0,
        dealValue: 0,
        ltvSum: 0,
        openAmount: 0,
        accountIds: new Set(),
      }
    }

    const g = groups[groupKey]
    g.accountIds.add(acc.id as string)
    g.ltvSum += (acc.ltv as number) || 0
  }

  // Distribute payments
  for (const p of (payRows || []) as unknown as {
    amount: number | null; paid_date: string | null; account_id: string; legacy: boolean
  }[]) {
    if (!includeLegacy && p.legacy) continue
    const inPeriod = !bounds || (p.paid_date && p.paid_date >= bounds.start && p.paid_date <= bounds.end)
    if (!inPeriod) continue

    // Find which group this account belongs to
    const acc = accs.find((a) => a.id === p.account_id)
    if (!acc) continue
    const groupKey = dimension === 'source'
      ? (acc.source as string || 'Onbekend')
      : (acc[fkField] as string || 'Onbekend')
    if (groups[groupKey]) groups[groupKey].cash += p.amount || 0
  }

  // Distribute incoming_payments (open)
  for (const ip of (ipRows || []) as unknown as {
    amount: number | null; due_date: string | null; account_id: string
  }[]) {
    const acc = accs.find((a) => a.id === ip.account_id)
    if (!acc) continue
    const groupKey = dimension === 'source'
      ? (acc.source as string || 'Onbekend')
      : (acc[fkField] as string || 'Onbekend')
    if (groups[groupKey]) groups[groupKey].openAmount += ip.amount || 0
  }

  // Distribute contracts (deal value)
  for (const ct of (ctRows || []) as unknown as {
    deal_value: number | null; created_at: string; account_id: string
  }[]) {
    const inPeriod = !bounds || (ct.created_at && ct.created_at.slice(0, 10) >= bounds.start && ct.created_at.slice(0, 10) <= bounds.end)
    if (!inPeriod) continue

    const acc = accs.find((a) => a.id === ct.account_id)
    if (!acc) continue
    const groupKey = dimension === 'source'
      ? (acc.source as string || 'Onbekend')
      : (acc[fkField] as string || 'Onbekend')
    if (groups[groupKey]) groups[groupKey].dealValue += ct.deal_value || 0
  }

  // Convert to array, sorted by cash desc
  return Object.values(groups)
    .map((g) => ({
      id: g.id,
      name: g.name,
      cash: g.cash,
      dealValue: g.dealValue,
      avgLtv: g.accountIds.size > 0 ? Math.round(g.ltvSum / g.accountIds.size) : 0,
      openAmount: g.openAmount,
      accountCount: g.accountIds.size,
    }))
    .sort((a, b) => b.cash - a.cash)
}
