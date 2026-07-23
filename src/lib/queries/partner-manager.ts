import { getSupabaseAdmin } from '@/lib/supabase-admin'

// ── TYPES ──

export interface CreatorStats {
  id: string
  name: string
  status: string
  revenue: number
  cash: number
  leadCount: number
  revPerLead: number
  shareOfRevenue: number   // percentage of total
  churnCount: number
  accountCount: number
}

export interface PartnerManagerOverview {
  totalRevenue: number
  totalCash: number
  avgCashPerCreator: number
  avgRevenuePerCreator: number
  avgRevPerLead: number

  // Key-man risk
  keyManRisk: { name: string; share: number }[]  // creators with >30% share

  // Leaderboard
  leaderboard: CreatorStats[]

  // Growth
  creatorGrowth: { month: string; count: number }[]
  revenueGrowth: { month: string; revenue: number; creatorCount: number }[]

  // Status counts
  activeCount: number
  churnedCount: number
  onboardingCount: number

  // Highest churn partner
  highestChurnCreator: { name: string; churnCount: number } | null
}

const MONTH_LABELS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

export async function getPartnerManagerOverview(): Promise<PartnerManagerOverview> {
  const admin = getSupabaseAdmin()

  const [creatorsResult, accountsResult, paymentsResult, leadsResult, contractsResult] = await Promise.all([
    admin.from('creators').select('id, name, status, created_at'),
    admin.from('accounts').select('id, creator_id, ltv, churn_date, is_legacy, status'),
    admin.from('payments').select('amount, paid, account_id, legacy'),
    admin.from('leads').select('id, creator_id').eq('is_legacy', false),
    admin.from('contracts').select('id, deal_value, account_id, created_at'),
  ])

  const creators = (creatorsResult.data || []) as unknown as { id: string; name: string; status: string; created_at: string }[]
  const accounts = (accountsResult.data || []) as unknown as { id: string; creator_id: string | null; ltv: number | null; churn_date: string | null; is_legacy: boolean; status: string }[]
  const payments = (paymentsResult.data || []) as unknown as { amount: number | null; paid: boolean; account_id: string | null; legacy: boolean }[]
  const leads = (leadsResult.data || []) as unknown as { id: string; creator_id: string | null }[]
  const contracts = (contractsResult.data || []) as unknown as { id: string; deal_value: number | null; account_id: string | null; created_at: string }[]

  // Map account → creator
  const accountCreator: Record<string, string> = {}
  for (const a of accounts) {
    if (a.creator_id) accountCreator[a.id] = a.creator_id
  }

  // Revenue per creator (from contracts via account)
  const creatorRevenue: Record<string, number> = {}
  const creatorCash: Record<string, number> = {}
  const creatorChurn: Record<string, number> = {}
  const creatorAccountCount: Record<string, number> = {}

  for (const c of contracts) {
    if (!c.account_id) continue
    const cid = accountCreator[c.account_id]
    if (!cid) continue
    creatorRevenue[cid] = (creatorRevenue[cid] || 0) + (c.deal_value || 0)
  }

  for (const p of payments) {
    if (!p.paid || p.legacy || !p.account_id) continue
    const cid = accountCreator[p.account_id]
    if (!cid) continue
    creatorCash[cid] = (creatorCash[cid] || 0) + (p.amount || 0)
  }

  for (const a of accounts) {
    if (!a.creator_id || a.is_legacy) continue
    creatorAccountCount[a.creator_id] = (creatorAccountCount[a.creator_id] || 0) + 1
    if (a.churn_date) {
      creatorChurn[a.creator_id] = (creatorChurn[a.creator_id] || 0) + 1
    }
  }

  // Lead counts per creator
  const creatorLeads: Record<string, number> = {}
  for (const l of leads) {
    if (l.creator_id) creatorLeads[l.creator_id] = (creatorLeads[l.creator_id] || 0) + 1
  }

  // Total revenue across all creators
  const totalRevenue = Object.values(creatorRevenue).reduce((s, v) => s + v, 0)
  const totalCash = Object.values(creatorCash).reduce((s, v) => s + v, 0)

  // Build leaderboard
  const leaderboard: CreatorStats[] = creators.map(c => {
    const rev = creatorRevenue[c.id] || 0
    const cash = creatorCash[c.id] || 0
    const lc = creatorLeads[c.id] || 0
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      revenue: rev,
      cash,
      leadCount: lc,
      revPerLead: lc > 0 ? Math.round(rev / lc) : 0,
      shareOfRevenue: totalRevenue > 0 ? Math.round((rev / totalRevenue) * 100) : 0,
      churnCount: creatorChurn[c.id] || 0,
      accountCount: creatorAccountCount[c.id] || 0,
    }
  }).sort((a, b) => b.revenue - a.revenue)

  // Key-man risk (>30% share)
  const keyManRisk = leaderboard
    .filter(c => c.shareOfRevenue > 30)
    .map(c => ({ name: c.name, share: c.shareOfRevenue }))

  // Averages
  const activeCreators = creators.filter(c => c.status === 'ACTIVE').length
  const avgCashPerCreator = activeCreators > 0 ? Math.round(totalCash / activeCreators) : 0
  const avgRevenuePerCreator = activeCreators > 0 ? Math.round(totalRevenue / activeCreators) : 0

  const totalLeadCount = Object.values(creatorLeads).reduce((s, v) => s + v, 0)
  const avgRevPerLead = totalLeadCount > 0 ? Math.round(totalRevenue / totalLeadCount) : 0

  // Highest churn partner
  let highestChurnCreator: { name: string; churnCount: number } | null = null
  for (const c of leaderboard) {
    if (c.churnCount > 0 && (!highestChurnCreator || c.churnCount > highestChurnCreator.churnCount)) {
      highestChurnCreator = { name: c.name, churnCount: c.churnCount }
    }
  }

  // Creator growth per month (last 12 months)
  const now = new Date()
  const creatorGrowth: { month: string; count: number }[] = []
  const revenueGrowth: { month: string; revenue: number; creatorCount: number }[] = []

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    const mStart = d.toISOString().slice(0, 10)
    const mEnd = end.toISOString().slice(0, 10)
    const label = `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`

    // Creators created up to this month
    const createdBefore = creators.filter(c => c.created_at.slice(0, 10) <= mEnd).length
    creatorGrowth.push({ month: label, count: createdBefore })

    // Revenue this month
    let mRev = 0
    for (const c of contracts) {
      if (!c.created_at) continue
      const cd = c.created_at.slice(0, 10)
      if (cd >= mStart && cd <= mEnd) mRev += c.deal_value || 0
    }
    revenueGrowth.push({ month: label, revenue: mRev, creatorCount: createdBefore })
  }

  // Status counts
  const activeCount = creators.filter(c => c.status === 'ACTIVE').length
  const churnedCount = creators.filter(c => c.status === 'INACTIVE' || c.status === 'BLOCKED').length
  const onboardingCount = creators.filter(c => c.status === 'ONBOARDING').length

  return {
    totalRevenue,
    totalCash,
    avgCashPerCreator,
    avgRevenuePerCreator,
    avgRevPerLead,
    keyManRisk,
    leaderboard,
    creatorGrowth,
    revenueGrowth,
    activeCount,
    churnedCount,
    onboardingCount,
    highestChurnCreator,
  }
}
