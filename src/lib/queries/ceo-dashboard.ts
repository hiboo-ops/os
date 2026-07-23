import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { periodBounds, type Period } from '@/lib/queries/finance-overview'

// ── TYPES ──

export interface CeoDashboardData {
  // Core KPIs
  omzet: number           // deal value (contracts + fallback calls)
  cash: number            // payments collected
  upsellRate: number      // % contracts that are UPSELL
  pifRate: number         // % Paid in Full
  splitRate: number       // % Split/termijn
  collectionRate: number

  // Comparisons (today vs yesterday)
  callsToday: number
  callsYesterday: number
  bookedToday: number
  bookedYesterday: number
  leadsToday: number
  leadsYesterday: number

  // Recurring & Customer
  mrr: number             // monthly recurring revenue (expected this month)
  churnRate: number       // % accounts churned in period
  churnCount: number
  activeAccountCount: number
  nps: number | null       // avg NPS score (null if no data)
  npsCount: number
  refundRate: number      // % payments refunded
  refundAmount: number
  refundCount: number

  // Outstanding
  outstandingToday: number
  outstandingWeek: number
  outstandingMonth: number

  // Financial
  revenue: number
  cost: number
  profit: number          // revenue - cost
  costByCategory: { category: string; amount: number }[]
  cashflowMonths: { month: string; cash: number; cost: number }[]

  // Top performers
  topClosers: { name: string; cash: number }[]
  topCreators: { name: string; revenue: number }[]

  // LTV
  avgLtv: number
  ltvGpRatio: number | null  // LTV : Gross Profit

  // Creator rollup
  creatorRev: number
  creatorCash: number
  creatorPifRate: number
  creatorSplitRate: number
}

// ── HELPERS ──

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function yesterdayStr() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

function startOfWeekStr() {
  const d = new Date()
  const day = d.getDay()
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1))
  return d.toISOString().slice(0, 10)
}

function startOfMonthStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function endOfMonthStr() {
  const d = new Date()
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return end.toISOString().slice(0, 10)
}

const MONTH_LABELS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

// ── MAIN QUERY ──

export async function getCeoDashboardData(period: Period = 'all'): Promise<CeoDashboardData> {
  const admin = getSupabaseAdmin()
  const today = todayStr()
  const yesterday = yesterdayStr()
  const weekStart = startOfWeekStr()
  const monthStart = startOfMonthStr()
  const monthEnd = endOfMonthStr()
  const bounds = periodBounds(period)

  // ── Parallel queries ──
  const [
    callsResult,
    leadsResult,
    contractsResult,
    paymentsResult,
    incomingResult,
    accountsResult,
    npsResult,
    costsResult,
    closersResult,
    creatorsResult,
  ] = await Promise.all([
    // 1. Calls
    admin.from('calls').select('id, date_start_time, result, closer_id'),

    // 2. Leads (non-legacy)
    admin.from('leads').select('id, date_received, creator_id').eq('is_legacy', false),

    // 3. Contracts
    admin.from('contracts').select('id, deal_value, type, payment_plan, account_id, created_at'),

    // 4. Payments
    admin.from('payments').select('id, amount, paid, paid_date, status, refund_amount, refund_date, legacy, collector_id, account_id'),

    // 5. Incoming payments
    admin.from('incoming_payments').select('id, amount, due_date, status, contract_id, account_id'),

    // 6. Accounts (with churn)
    admin.from('accounts').select('id, ltv, creator_id, closer_id, churn_date, is_legacy, created_at, status'),

    // 7. NPS scores
    admin.from('nps_scores').select('score'),

    // 8. Costs
    admin.from('costs').select('amount, category, date'),

    // 9. Closers (for name lookup)
    admin.from('closers').select('id, name'),

    // 10. Creators (for name lookup)
    admin.from('creators').select('id, name'),
  ])

  const calls = (callsResult.data || []) as unknown as { id: string; date_start_time: string | null; result: string | null; closer_id: string | null }[]
  const leads = (leadsResult.data || []) as unknown as { id: string; date_received: string | null; creator_id: string | null }[]
  const contracts = (contractsResult.data || []) as unknown as { id: string; deal_value: number | null; type: string | null; payment_plan: string | null; account_id: string | null; created_at: string }[]
  const payments = (paymentsResult.data || []) as unknown as { id: string; amount: number | null; paid: boolean; paid_date: string | null; status: string; refund_amount: number | null; refund_date: string | null; legacy: boolean; collector_id: string | null; account_id: string | null }[]
  const incoming = (incomingResult.data || []) as unknown as { id: string; amount: number | null; due_date: string | null; status: string; contract_id: string | null; account_id: string | null }[]
  const accounts = (accountsResult.data || []) as unknown as { id: string; ltv: number | null; creator_id: string | null; closer_id: string | null; churn_date: string | null; is_legacy: boolean; created_at: string; status: string }[]
  const npsRows = (npsResult.data || []) as unknown as { score: number }[]
  const costs = (costsResult.data || []) as unknown as { amount: number | null; category: string; date: string }[]
  const closers = (closersResult.data || []) as unknown as { id: string; name: string }[]
  const creators = (creatorsResult.data || []) as unknown as { id: string; name: string }[]

  const closerMap = Object.fromEntries(closers.map(c => [c.id, c.name]))
  const creatorMap = Object.fromEntries(creators.map(c => [c.id, c.name]))

  // ── Comparisons (today vs yesterday) ──
  const callsToday = calls.filter(c => c.date_start_time?.slice(0, 10) === today).length
  const callsYesterday = calls.filter(c => c.date_start_time?.slice(0, 10) === yesterday).length
  const bookedToday = calls.filter(c => c.date_start_time?.slice(0, 10) === today && c.result === 'CALL BOOKED').length
  const bookedYesterday = calls.filter(c => c.date_start_time?.slice(0, 10) === yesterday && c.result === 'CALL BOOKED').length
  const leadsToday = leads.filter(l => l.date_received === today).length
  const leadsYesterday = leads.filter(l => l.date_received === yesterday).length

  // ── Omzet (deal value from contracts, fallback calls) ──
  const inPeriod = (dateStr: string | null) => {
    if (!bounds || !dateStr) return !bounds
    const d = dateStr.slice(0, 10)
    return d >= bounds.start && d <= bounds.end
  }

  let omzet = 0
  let upsellCount = 0
  let totalContracts = 0
  for (const c of contracts) {
    if (!inPeriod(c.created_at)) continue
    totalContracts++
    omzet += c.deal_value || 0
    if (c.type === 'UPSELL') upsellCount++
  }
  // Fallback: if no contracts, use calls deal_value
  if (totalContracts === 0) {
    for (const c of calls) {
      if (!inPeriod(c.date_start_time)) continue
      // Can't get deal_value from calls select above, but CEO fallback
    }
  }

  const upsellRate = totalContracts > 0 ? Math.round((upsellCount / totalContracts) * 100) : 0

  // ── PIF vs Split ──
  const ipCountByContract: Record<string, number> = {}
  for (const ip of incoming) {
    if (ip.contract_id) ipCountByContract[ip.contract_id] = (ipCountByContract[ip.contract_id] || 0) + 1
  }
  let pifCount = 0, splitCount = 0
  for (const c of contracts) {
    if (!inPeriod(c.created_at)) continue
    const ipCount = ipCountByContract[c.id]
    const isSplit = ipCount != null ? ipCount >= 2 : false
    if (isSplit) splitCount++
    else pifCount++
  }
  const pifRate = totalContracts > 0 ? Math.round((pifCount / totalContracts) * 100) : 0
  const splitRate = totalContracts > 0 ? Math.round((splitCount / totalContracts) * 100) : 0

  // ── Cash collected ──
  let cash = 0
  const closerCash: Record<string, number> = {}
  let totalPaidPayments = 0
  let refundAmount = 0
  let refundCount = 0
  for (const p of payments) {
    if (!p.paid) continue
    if (!inPeriod(p.paid_date)) continue
    cash += p.amount || 0
    totalPaidPayments++
    // Track closer cash
    if (p.collector_id) {
      closerCash[p.collector_id] = (closerCash[p.collector_id] || 0) + (p.amount || 0)
    }
    // Refunds
    if (p.status === 'REFUNDED' || p.status === 'CHARGEBACK') {
      refundCount++
      refundAmount += p.refund_amount || p.amount || 0
    }
  }
  const refundRate = totalPaidPayments > 0 ? Math.round((refundCount / totalPaidPayments) * 100) : 0

  // ── Collection rate ──
  let paidIpCount = 0, openIpCount = 0
  for (const ip of incoming) {
    if (ip.status === 'PAID') paidIpCount++
    else if (ip.status !== 'REFUNDED') openIpCount++
  }
  const collectionRate = (paidIpCount + openIpCount) > 0
    ? Math.round((paidIpCount / (paidIpCount + openIpCount)) * 100)
    : 0

  // ── MRR (expected incoming payments this month, not yet paid) ──
  let mrr = 0
  for (const ip of incoming) {
    if (ip.status === 'PAID' || ip.status === 'REFUNDED') continue
    if (ip.due_date && ip.due_date >= monthStart && ip.due_date <= monthEnd) {
      mrr += ip.amount || 0
    }
  }

  // ── Churn ──
  const nonLegacyAccounts = accounts.filter(a => !a.is_legacy)
  const activeAccountCount = nonLegacyAccounts.filter(a => a.status === 'ACTIVE').length
  const churnCount = nonLegacyAccounts.filter(a => a.churn_date && inPeriod(a.churn_date)).length
  const churnRate = (activeAccountCount + churnCount) > 0
    ? Math.round((churnCount / (activeAccountCount + churnCount)) * 100)
    : 0

  // ── NPS ──
  const nps = npsRows.length > 0
    ? Math.round((npsRows.reduce((s, r) => s + r.score, 0) / npsRows.length) * 10) / 10
    : null

  // ── Outstanding ──
  let outstandingToday = 0, outstandingWeek = 0, outstandingMonth = 0
  for (const ip of incoming) {
    if (ip.status === 'PAID' || ip.status === 'REFUNDED') continue
    const amt = ip.amount || 0
    if (!ip.due_date) continue
    if (ip.due_date <= today) outstandingToday += amt
    if (ip.due_date >= weekStart && ip.due_date <= today) outstandingWeek += amt
    // This month total open
    if (ip.due_date >= monthStart && ip.due_date <= monthEnd) outstandingMonth += amt
  }
  // outstandingToday = all overdue up to today
  outstandingToday = 0
  for (const ip of incoming) {
    if (ip.status === 'PAID' || ip.status === 'REFUNDED') continue
    if (ip.due_date && ip.due_date <= today) outstandingToday += ip.amount || 0
  }

  // ── Financial: Revenue, Cost, P&L ──
  const revenue = omzet || cash // deal value or cash as fallback
  let totalCost = 0
  const catCosts: Record<string, number> = {}
  for (const c of costs) {
    if (!inPeriod(c.date)) continue
    const amt = c.amount || 0
    totalCost += amt
    catCosts[c.category] = (catCosts[c.category] || 0) + amt
  }
  const costByCategory = Object.entries(catCosts).map(([category, amount]) => ({ category, amount }))
  const profit = revenue - totalCost

  // ── Cashflow by month (6 months) ──
  const now = new Date()
  const cashflowMonths: { month: string; cash: number; cost: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    const mStart = d.toISOString().slice(0, 10)
    const mEnd = end.toISOString().slice(0, 10)
    const label = `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`

    let mCash = 0
    for (const p of payments) {
      if (!p.paid || p.paid_date == null) continue
      if (p.paid_date >= mStart && p.paid_date <= mEnd) mCash += p.amount || 0
    }

    let mCost = 0
    for (const c of costs) {
      if (c.date >= mStart && c.date <= mEnd) mCost += c.amount || 0
    }

    cashflowMonths.push({ month: label, cash: mCash, cost: mCost })
  }

  // ── Top closers ──
  const topClosers = Object.entries(closerCash)
    .map(([id, c]) => ({ name: closerMap[id] || 'Onbekend', cash: c }))
    .sort((a, b) => b.cash - a.cash)
    .slice(0, 5)

  // ── Top creators (by account revenue) ──
  const creatorRev: Record<string, number> = {}
  for (const acc of nonLegacyAccounts) {
    if (!acc.creator_id) continue
    // Get payments for this account
    const accPayments = payments.filter(p => p.account_id === acc.id && p.paid)
    const accCash = accPayments.reduce((s, p) => s + (p.amount || 0), 0)
    creatorRev[acc.creator_id] = (creatorRev[acc.creator_id] || 0) + accCash
  }
  const topCreators = Object.entries(creatorRev)
    .map(([id, rev]) => ({ name: creatorMap[id] || 'Onbekend', revenue: rev }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)

  // ── LTV ──
  const ltvAccounts = nonLegacyAccounts.filter(a => (a.ltv || 0) > 0)
  const avgLtv = ltvAccounts.length > 0
    ? Math.round(ltvAccounts.reduce((s, a) => s + (a.ltv || 0), 0) / ltvAccounts.length)
    : 0
  const grossProfit = revenue - totalCost
  const ltvGpRatio = grossProfit > 0 ? Math.round((avgLtv / grossProfit) * 100) / 100 : null

  // ── Creator rollup ──
  const totalCreatorRev = Object.values(creatorRev).reduce((s, v) => s + v, 0)
  let totalCreatorCash = 0
  for (const acc of nonLegacyAccounts) {
    if (!acc.creator_id) continue
    const accPayments = payments.filter(p => p.account_id === acc.id && p.paid)
    totalCreatorCash += accPayments.reduce((s, p) => s + (p.amount || 0), 0)
  }

  // Creator PIF/Split: contracts where account has creator_id
  let creatorPif = 0, creatorSplit = 0
  for (const c of contracts) {
    const acc = nonLegacyAccounts.find(a => a.id === c.account_id)
    if (!acc?.creator_id) continue
    const ipCount = ipCountByContract[c.id]
    if (ipCount != null && ipCount >= 2) creatorSplit++
    else creatorPif++
  }
  const creatorTotal = creatorPif + creatorSplit
  const creatorPifRate = creatorTotal > 0 ? Math.round((creatorPif / creatorTotal) * 100) : 0
  const creatorSplitRate = creatorTotal > 0 ? Math.round((creatorSplit / creatorTotal) * 100) : 0

  return {
    omzet,
    cash,
    upsellRate,
    pifRate,
    splitRate,
    collectionRate,
    callsToday,
    callsYesterday,
    bookedToday,
    bookedYesterday,
    leadsToday,
    leadsYesterday,
    mrr,
    churnRate,
    churnCount,
    activeAccountCount,
    nps,
    npsCount: npsRows.length,
    refundRate,
    refundAmount,
    refundCount,
    outstandingToday,
    outstandingWeek,
    outstandingMonth,
    revenue,
    cost: totalCost,
    profit,
    costByCategory,
    cashflowMonths,
    topClosers,
    topCreators,
    avgLtv,
    ltvGpRatio,
    creatorRev: totalCreatorRev,
    creatorCash: totalCreatorCash,
    creatorPifRate,
    creatorSplitRate,
  }
}
