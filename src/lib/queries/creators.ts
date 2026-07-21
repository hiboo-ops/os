import { supabase } from '@/lib/supabase'

export interface SocialAccount {
  handle?: string
  followers?: string
  url?: string
}

export interface Creator {
  id: string
  name: string
  last_name: string | null
  email: string | null
  phone: string | null
  socials: Record<string, SocialAccount> | null
  status: string
  calendly_link: string | null
  quiz_utm: string | null
  quiz_clicks: number | null
  cac: number | null
  setup_fee: number | null
  start_date: string | null
  birth_date: string | null
  kvk: string | null
  company_name: string | null
  contract_status: string | null
  contract_signed_date: string | null
  contract_end_date: string | null
  contract_url: string | null
}

const CREATOR_COLUMNS =
  'id, name, last_name, email, phone, socials, status, calendly_link, quiz_utm, quiz_clicks, cac, setup_fee, start_date, birth_date, kvk, company_name, contract_status, contract_signed_date, contract_end_date, contract_url'

export async function getCreatorList() {
  const { data } = await supabase
    .from('creators')
    .select(CREATOR_COLUMNS)
    .order('name')

  return (data || []) as unknown as Creator[]
}

export async function getCreatorById(id: string) {
  const { data } = await supabase
    .from('creators')
    .select(CREATOR_COLUMNS)
    .eq('id', id)
    .single()

  return (data as unknown as Creator) || null
}

export async function getLeadCountsByCreator() {
  const { data } = await supabase
    .from('leads')
    .select('creator_id')

  if (!data) return {} as Record<string, number>

  const counts: Record<string, number> = {}
  for (const row of data) {
    const cid = (row as unknown as { creator_id: string | null }).creator_id
    if (cid) {
      counts[cid] = (counts[cid] || 0) + 1
    }
  }
  return counts
}

export interface CreatorLead {
  id: string
  name: string | null
  created_at: string | null
  source: string | null
  phone: string | null
  quiz_answers: { question: string; answer: string }[] | null
}

/**
 * Leads gekoppeld aan een creator. Primair via `creator_id` (schone FK),
 * met fallback op `creator_name` voor quiz-leads waar de FK nog niet gebackfilld is.
 */
export async function getLeadsForCreator(id: string, creatorName?: string | null) {
  let query = supabase
    .from('leads')
    .select('id, name, created_at, source, phone, quiz_answers')

  if (creatorName) {
    query = query.or(`creator_id.eq.${id},creator_name.eq.${creatorName}`)
  } else {
    query = query.eq('creator_id', id)
  }

  const { data } = await query.order('created_at', { ascending: false }).limit(25)
  return (data || []) as unknown as CreatorLead[]
}

export interface CreatorRevenue {
  clientCount: number
  omzetTotaal: number
  omzetDezeMaand: number
  cashCollected: number
  openstaand: number
  ltv: number
  ltvCac: number | null
  months: string[]
  omzetPerMaand: number[]
}

const MONTH_LABELS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

/**
 * Omzet van een creator via de keten creators.id -> clients.creator_id -> payments.client_id.
 * Legacy-betalingen worden uitgesloten van alle bedragen (conform finance/delivery).
 */
export async function getRevenueForCreator(id: string, cac: number | null): Promise<CreatorRevenue> {
  const empty: CreatorRevenue = {
    clientCount: 0, omzetTotaal: 0, omzetDezeMaand: 0, cashCollected: 0,
    openstaand: 0, ltv: 0, ltvCac: null, months: [], omzetPerMaand: [],
  }

  const { data: clients } = await supabase
    .from('clients')
    .select('id, tcv')
    .eq('creator_id', id)

  // 12-maands buckets (altijd renderen, ook bij 0)
  const now = new Date()
  const months: string[] = []
  const buckets: number[] = []
  const bucketKeys: string[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(MONTH_LABELS[d.getMonth()])
    buckets.push(0)
    bucketKeys.push(`${d.getFullYear()}-${d.getMonth()}`)
  }

  if (!clients || clients.length === 0) {
    return { ...empty, months, omzetPerMaand: buckets }
  }

  const clientIds = clients.map(c => (c as { id: string }).id)
  const tcvTotaal = clients.reduce((s, c) => s + ((c as { tcv: number | null }).tcv || 0), 0)

  const { data: payments } = await supabase
    .from('payments')
    .select('amount, paid, legacy, payment_date, client_id')
    .in('client_id', clientIds)

  const active = (payments || []).filter(p => !(p as { legacy: boolean }).legacy)
  const monthCutoff = new Date(now.getFullYear(), now.getMonth(), 1)

  let cashCollected = 0
  let omzetDezeMaand = 0
  for (const p of active) {
    const row = p as { amount: number | null; paid: boolean; payment_date: string | null }
    const amount = row.amount || 0
    if (row.paid) {
      cashCollected += amount
      if (row.payment_date && new Date(row.payment_date) >= monthCutoff) {
        omzetDezeMaand += amount
      }
      if (row.payment_date) {
        const d = new Date(row.payment_date)
        const key = `${d.getFullYear()}-${d.getMonth()}`
        const idx = bucketKeys.indexOf(key)
        if (idx >= 0) buckets[idx] += amount
      }
    }
  }

  const clientCount = clients.length
  const omzetTotaal = tcvTotaal
  const openstaand = Math.max(0, omzetTotaal - cashCollected)
  const ltv = clientCount > 0 ? omzetTotaal / clientCount : 0
  const ltvCac = cac && cac > 0 ? ltv / cac : null

  return {
    clientCount, omzetTotaal, omzetDezeMaand, cashCollected, openstaand,
    ltv, ltvCac, months, omzetPerMaand: buckets,
  }
}
