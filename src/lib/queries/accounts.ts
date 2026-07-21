import { getSupabaseAdmin } from '@/lib/supabase-admin'

// ── TYPES ──

export interface Account {
  id: string
  name: string
  email: string | null
  phone: string | null
  status: string
  ltv: number
  source: string | null
  creator_id: string | null
  setter_id: string | null
  closer_id: string | null
  coach_id: string | null
  lead_id: string | null
  call_id: string | null
  client_id: string | null
  created_at: string
  updated_at: string
}

export interface AccountWithRelations extends Account {
  creator: { id: string; name: string } | null
  setter: { id: string; name: string } | null
  closer: { id: string; name: string } | null
  coach: { id: string; name: string } | null
}

export interface IncomingPayment {
  id: string
  account_id: string
  contract_id: string | null
  installment_number: number
  amount: number
  due_date: string | null
  status: string
  stripe_link: string | null
  whop_link: string | null
  pay_token: string
  payment_id: string | null
  is_manual: boolean
  screenshot_url: string | null
  verification_status: string | null
  verified_by: string | null
  created_at: string
  updated_at: string
}

export interface AccountContract {
  id: string
  account_id: string | null
  call_id: string | null
  name: string
  deal_value: number | null
  payment_plan: string | null
  type: string | null
  source: string | null
  contract_signed: boolean | null
  contract_url: string | null
  esign_contract_id: string | null
  esign_status: string | null
  contract_pdf_url: string | null
  created_at: string
}

// ── QUERIES (server-side, admin client) ──

export async function getAccountsList(opts: {
  page?: number
  pageSize?: number
  search?: string
  status?: string
} = {}) {
  const { page = 1, pageSize = 50, search, status } = opts
  const admin = getSupabaseAdmin()
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = admin
    .from('accounts')
    .select(`
      *,
      creator:creators(id, name),
      setter:setters(id, name),
      closer:closers(id, name),
      coach:coaches(id, name)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`)
  }
  if (status) {
    query = query.eq('status', status)
  }

  const { data, count, error } = await query
  if (error) throw error

  return {
    accounts: (data || []) as unknown as AccountWithRelations[],
    total: count || 0,
    page,
    pageSize,
  }
}

export async function getAccountById(id: string) {
  const admin = getSupabaseAdmin()

  const { data, error } = await admin
    .from('accounts')
    .select(`
      *,
      creator:creators(id, name),
      setter:setters(id, name),
      closer:closers(id, name),
      coach:coaches(id, name)
    `)
    .eq('id', id)
    .single()

  if (error) return null
  return data as unknown as AccountWithRelations
}

export async function getContractsForAccount(accountId: string) {
  const admin = getSupabaseAdmin()

  const { data } = await admin
    .from('contracts')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })

  return (data || []) as unknown as AccountContract[]
}

export async function getIncomingPaymentsForAccount(accountId: string) {
  const admin = getSupabaseAdmin()

  const { data } = await admin
    .from('incoming_payments')
    .select('*')
    .eq('account_id', accountId)
    .order('due_date', { ascending: true })

  return (data || []) as unknown as IncomingPayment[]
}

export async function getPaymentsForAccount(accountId: string) {
  const admin = getSupabaseAdmin()

  const { data } = await admin
    .from('payments')
    .select('*')
    .eq('account_id', accountId)
    .order('payment_number', { ascending: true })

  return data || []
}

export async function findAccountByEmail(email: string) {
  const admin = getSupabaseAdmin()

  const { data } = await admin
    .from('accounts')
    .select('*')
    .ilike('email', email.toLowerCase())
    .limit(1)
    .maybeSingle()

  return data as Account | null
}

export async function createAccount(input: {
  name: string
  email?: string | null
  phone?: string | null
  source?: string | null
  creator_id?: string | null
  setter_id?: string | null
  closer_id?: string | null
  coach_id?: string | null
  lead_id?: string | null
  call_id?: string | null
  client_id?: string | null
}) {
  const admin = getSupabaseAdmin()

  const { data, error } = await admin
    .from('accounts')
    .insert({
      name: input.name,
      email: input.email?.toLowerCase() || null,
      phone: input.phone || null,
      source: input.source || null,
      creator_id: input.creator_id || null,
      setter_id: input.setter_id || null,
      closer_id: input.closer_id || null,
      coach_id: input.coach_id || null,
      lead_id: input.lead_id || null,
      call_id: input.call_id || null,
      client_id: input.client_id || null,
    })
    .select()
    .single()

  if (error) throw error
  return data as Account
}

export async function updateAccountLtv(accountId: string) {
  const admin = getSupabaseAdmin()

  // LTV = som van alle betaalde payments voor dit account
  const { data: payments } = await admin
    .from('payments')
    .select('amount')
    .eq('account_id', accountId)
    .eq('paid', true)

  const ltv = (payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0)

  await admin
    .from('accounts')
    .update({ ltv, updated_at: new Date().toISOString() })
    .eq('id', accountId)

  return ltv
}

// ── INCOMING PAYMENT HELPERS ──

export async function createIncomingPayment(input: {
  account_id: string
  contract_id?: string | null
  installment_number: number
  amount: number
  due_date?: string | null
  stripe_link?: string | null
  whop_link?: string | null
}) {
  const admin = getSupabaseAdmin()

  const { data, error } = await admin
    .from('incoming_payments')
    .insert({
      account_id: input.account_id,
      contract_id: input.contract_id || null,
      installment_number: input.installment_number,
      amount: input.amount,
      due_date: input.due_date || null,
      stripe_link: input.stripe_link || null,
      whop_link: input.whop_link || null,
    })
    .select()
    .single()

  if (error) throw error
  return data as IncomingPayment
}

// ── VERIFICATIE-QUEUE ──

export async function getPendingVerifications() {
  const admin = getSupabaseAdmin()

  const { data } = await admin
    .from('incoming_payments')
    .select(`
      *,
      account:accounts(id, name, email)
    `)
    .eq('is_manual', true)
    .eq('verification_status', 'PENDING')
    .order('created_at', { ascending: true })

  return (data || []) as unknown as (IncomingPayment & {
    account: { id: string; name: string; email: string | null }
  })[]
}

// ── OPEN/LATE TERMIJNEN (account-gebaseerd) ──

export async function getOpenIncomingPayments() {
  const admin = getSupabaseAdmin()

  const { data } = await admin
    .from('incoming_payments')
    .select(`
      *,
      account:accounts(id, name, email,
        closer:closers(id, name),
        setter:setters(id, name)
      )
    `)
    .neq('status', 'PAID')
    .neq('status', 'REFUNDED')
    .order('due_date', { ascending: true })

  return data || []
}
