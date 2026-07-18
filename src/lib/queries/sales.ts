import { supabase } from '@/lib/supabase'

// ── TYPES ──

export type CallResult =
  | 'CALL BOOKED' | 'RESCHEDULE' | 'FOLLOW UP' | 'FOLLOW UP LONG TERM'
  | 'DEPOSIT' | 'CLOSED' | 'LOST - BROKE' | 'LOST - NO INTEREST'
  | 'LOST - BAD FIT' | 'NO SHOW' | 'CANCELLED BY LEAD' | 'CANCELLED BY CLOSER'

export interface Call {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  instagram: string | null
  date_start_time: string | null
  closer_id: string | null
  setter_id: string | null
  source: string | null
  source_type: string | null
  result: CallResult | null
  show_status: string | null
  deal_value: number | null
  cash_collected: number | null
  week: number | null
  month: number | null
  event_type: string | null
  meeting_link: string | null
  reschedule_link: string | null
  cancel_link: string | null
  fathom_link: string | null
  setter_notes: string | null
  pre_call_notes: string | null
  closing_notes: string | null
  triage_notes: string | null
  no_deal_reason: string | null
  next_touch_point: string | null
  payment_plan: string | null
  first_deposit: number | null
  whop_link: string | null
  stripe_link: string | null
  contract_url: string | null
  questions: Record<string, unknown> | null
  created_at: string
  closer: { id: string; name: string } | null
  setter: { id: string; name: string } | null
}

export interface CallFilters {
  week?: number
  month?: number
  dateFrom?: string
  dateTo?: string
  source?: string
  sourceType?: string
  result?: CallResult
  closerId?: string
  setterId?: string
}

export interface SalesMetrics {
  totalCalls: number
  closedDeals: number
  totalDealValue: number
  totalCashCollected: number
  closingRate: number
  closingRateTaken: number
  showUpRate: number
  cancelRate: number
  avgOrderValue: number
  cashPerCallTaken: number
  cashPerCallBooked: number
  noShows: number
  followUps: number
  deposits: number
  lostBroke: number
  lostNoInterest: number
  lostBadFit: number
  cancelled: number
}

export interface Installment {
  id: string
  call_id: string
  installment_number: number
  amount: number | null
  due_date: string | null
  status: string
  whop_link: string | null
  call: {
    name: string | null
    closer: { id: string; name: string } | null
    setter: { id: string; name: string } | null
  } | null
}

export interface DealWithContract {
  id: string
  name: string | null
  email: string | null
  date_start_time: string | null
  deal_value: number | null
  cash_collected: number | null
  payment_plan: string | null
  closer: { id: string; name: string } | null
  setter: { id: string; name: string } | null
  contracts: { id: string; call_id: string }[]
  first_deposits: { id: string; call_id: string; whop_link: string | null; stripe_link: string | null }[]
}

// ── QUERIES ──

export async function getAllCalls(filters?: CallFilters): Promise<Call[]> {
  let query = supabase
    .from('calls')
    .select(`
      *,
      closer:closers(id, name),
      setter:setters(id, name)
    `)
    .order('date_start_time', { ascending: false })

  if (filters?.week) {
    query = query.eq('week', filters.week)
  }
  if (filters?.month) {
    query = query.eq('month', filters.month)
  }
  if (filters?.dateFrom) {
    query = query.gte('date_start_time', filters.dateFrom)
  }
  if (filters?.dateTo) {
    query = query.lte('date_start_time', filters.dateTo + 'T23:59:59')
  }
  if (filters?.source) {
    query = query.eq('source', filters.source)
  }
  if (filters?.sourceType) {
    query = query.eq('source_type', filters.sourceType)
  }
  if (filters?.result) {
    query = query.eq('result', filters.result)
  }
  if (filters?.closerId) {
    query = query.eq('closer_id', filters.closerId)
  }
  if (filters?.setterId) {
    query = query.eq('setter_id', filters.setterId)
  }

  const { data } = await query
  return (data || []) as unknown as Call[]
}

export async function getCallById(id: string) {
  const { data: call } = await supabase
    .from('calls')
    .select(`
      *,
      closer:closers(id, name),
      setter:setters(id, name)
    `)
    .eq('id', id)
    .single()

  if (!call) return null

  const [contracts, firstDeposits, installments] = await Promise.all([
    supabase.from('contracts').select('*').eq('call_id', id),
    supabase.from('first_deposits').select('*').eq('call_id', id),
    supabase.from('sales_installments').select('*').eq('call_id', id).order('installment_number'),
  ])

  return {
    ...call,
    contracts: contracts.data || [],
    first_deposits: firstDeposits.data || [],
    installments: installments.data || [],
  }
}

export async function getTodayCalls(dayOffset: number = 0): Promise<Call[]> {
  const target = new Date()
  target.setDate(target.getDate() + dayOffset)
  const dateStr = target.toISOString().split('T')[0]

  const { data } = await supabase
    .from('calls')
    .select(`
      *,
      closer:closers(id, name),
      setter:setters(id, name)
    `)
    .gte('date_start_time', dateStr)
    .lt('date_start_time', dateStr + 'T23:59:59')
    .order('date_start_time', { ascending: true })

  return (data || []) as unknown as Call[]
}

export async function getCallsByResult(): Promise<Record<CallResult, Call[]>> {
  const calls = await getAllCalls()

  const stages: CallResult[] = [
    'CALL BOOKED', 'RESCHEDULE', 'FOLLOW UP', 'FOLLOW UP LONG TERM',
    'DEPOSIT', 'CLOSED', 'LOST - BROKE', 'LOST - NO INTEREST',
    'LOST - BAD FIT', 'NO SHOW', 'CANCELLED BY LEAD', 'CANCELLED BY CLOSER',
  ]

  const grouped: Record<string, Call[]> = {}
  for (const stage of stages) {
    grouped[stage] = []
  }

  for (const call of calls) {
    const result = call.result || 'CALL BOOKED'
    if (grouped[result]) {
      grouped[result].push(call)
    } else {
      grouped['CALL BOOKED'].push(call)
    }
  }

  return grouped as Record<CallResult, Call[]>
}

// ── METRICS ──

export function calculateMetrics(calls: Call[]): SalesMetrics {
  const totalCalls = calls.length
  const closedDeals = calls.filter(c => c.result === 'CLOSED').length
  const totalDealValue = calls
    .filter(c => c.result === 'CLOSED')
    .reduce((sum, c) => sum + (c.deal_value || 0), 0)
  const totalCashCollected = calls.reduce((sum, c) => sum + (c.cash_collected || 0), 0)

  const noShows = calls.filter(c => c.result === 'NO SHOW').length
  const cancelled = calls.filter(c => c.result === 'CANCELLED BY LEAD' || c.result === 'CANCELLED BY CLOSER').length
  const followUps = calls.filter(c => c.result === 'FOLLOW UP' || c.result === 'FOLLOW UP LONG TERM').length
  const deposits = calls.filter(c => c.result === 'DEPOSIT').length
  const lostBroke = calls.filter(c => c.result === 'LOST - BROKE').length
  const lostNoInterest = calls.filter(c => c.result === 'LOST - NO INTEREST').length
  const lostBadFit = calls.filter(c => c.result === 'LOST - BAD FIT').length

  // Calls that actually happened (not no-show, not cancelled)
  const takenCalls = totalCalls - noShows - cancelled
  const closingRate = totalCalls > 0 ? (closedDeals / totalCalls) * 100 : 0
  const closingRateTaken = takenCalls > 0 ? (closedDeals / takenCalls) * 100 : 0
  const showUpRate = totalCalls > 0 ? ((totalCalls - noShows) / totalCalls) * 100 : 0
  const cancelRate = totalCalls > 0 ? (cancelled / totalCalls) * 100 : 0
  const avgOrderValue = closedDeals > 0 ? totalDealValue / closedDeals : 0
  const cashPerCallTaken = takenCalls > 0 ? totalCashCollected / takenCalls : 0
  const cashPerCallBooked = totalCalls > 0 ? totalCashCollected / totalCalls : 0

  return {
    totalCalls,
    closedDeals,
    totalDealValue,
    totalCashCollected,
    closingRate,
    closingRateTaken,
    showUpRate,
    cancelRate,
    avgOrderValue,
    cashPerCallTaken,
    cashPerCallBooked,
    noShows,
    followUps,
    deposits,
    lostBroke,
    lostNoInterest,
    lostBadFit,
    cancelled,
  }
}

// ── INSTALLMENTS ──

export async function getOpenInstallments(): Promise<Installment[]> {
  const { data } = await supabase
    .from('sales_installments')
    .select(`
      id, call_id, installment_number, amount, due_date, status, whop_link,
      call:calls(
        name,
        closer:closers(id, name),
        setter:setters(id, name)
      )
    `)
    .neq('status', 'PAID')
    .order('due_date', { ascending: true })

  return (data || []) as unknown as Installment[]
}

// ── DEALS WITH CONTRACTS ──

export async function getDealsWithContracts(): Promise<DealWithContract[]> {
  const { data: deals } = await supabase
    .from('calls')
    .select(`
      id, name, email, date_start_time, deal_value, cash_collected, payment_plan,
      closer:closers(id, name),
      setter:setters(id, name),
      contracts(id, call_id),
      first_deposits(id, call_id, whop_link, stripe_link)
    `)
    .eq('result', 'CLOSED')
    .order('date_start_time', { ascending: false })

  return (deals || []) as unknown as DealWithContract[]
}
