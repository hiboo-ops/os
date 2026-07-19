import { supabase } from '@/lib/supabase'

export interface Lead {
  id: string
  name: string
  email: string | null
  phone: string | null
  source: string | null
  utm_parameter: string | null
  stage: string
  call_booked_on: string | null
  triage_caller_id: string | null
  triage_notes: string | null
  date_received: string | null
  creator_id: string | null
  creator_name: string | null
  quiz_answers: { question: string; answer: string }[] | null
  ad_campaign: string | null
  ad_set: string | null
  last_contact: string | null
  contact_count: number
  call_id: string | null
  scheduled_call_date: string | null
  closer_id: string | null
  notes: string | null
  created_at: string
  first_called_at: string | null
  attempt_count: number
  last_attempt_at: string | null
  time_to_call_minutes: number | null
  lead_id: string | null
  sla_deadline: string | null
  sla_met: boolean | null
  follow_up_at: string | null
  calendly_event_id: string | null
  calendly_booking_url: string | null
  is_legacy: boolean
  creator: { id: string; name: string } | null
  triage_caller: { id: string; name: string } | null
  closer: { id: string; name: string } | null
}

export const LEAD_STAGES = ['LEAD', 'FOLLOW UP', 'ATTEMPT 1', 'ATTEMPT 2', 'ATTEMPT 3', 'ATTEMPT 4', 'CLOSING CALL BOOKED', 'CLOSED', 'LOST - NO INTEREST', 'LOST - BROKE'] as const
export type LeadStage = typeof LEAD_STAGES[number]

export async function getAllLeads(filters?: { source?: string; stage?: string; search?: string; activeOnly?: boolean }) {
  const PAGE_SIZE = 500

  // Build a base query to get count
  let countQuery = supabase.from('leads').select('id', { count: 'exact', head: true })
  if (filters?.source) countQuery = countQuery.eq('source', filters.source)
  if (filters?.stage) countQuery = countQuery.eq('stage', filters.stage)
  if (filters?.activeOnly) countQuery = countQuery.in('stage', [...LEAD_STAGES])

  const { count } = await countQuery
  const total = count || 0
  if (total === 0) return []

  // Fetch all pages in parallel
  const batches = Math.ceil(total / PAGE_SIZE)
  const promises = Array.from({ length: batches }, (_, i) => {
    let query = supabase
      .from('leads')
      .select('*')
      .order('date_received', { ascending: true })
      .range(i * PAGE_SIZE, (i + 1) * PAGE_SIZE - 1)

    if (filters?.source) query = query.eq('source', filters.source)
    if (filters?.stage) query = query.eq('stage', filters.stage)
    if (filters?.activeOnly) query = query.in('stage', [...LEAD_STAGES])

    return query
  })

  const results = await Promise.all(promises)
  let allResults = results.flatMap(r => (r.data || []) as unknown as Lead[])

  if (filters?.search) {
    const q = filters.search.toLowerCase()
    allResults = allResults.filter(l =>
      l.name?.toLowerCase().includes(q) ||
      l.email?.toLowerCase().includes(q) ||
      l.phone?.includes(q)
    )
  }

  return allResults
}

export async function getLeadById(id: string) {
  const { data } = await supabase
    .from('leads')
    .select(`
      *,
      creator:creators(id, name),
      triage_caller:setters(id, name),
      closer:closers(id, name)
    `)
    .eq('id', id)
    .single()

  return data as unknown as Lead | null
}

export async function getLeadStats() {
  type StatRow = { id: string; stage: string; source: string | null; first_called_at: string | null; date_received: string | null; time_to_call_minutes: number | null; sla_deadline: string | null; is_legacy: boolean }
  let all: StatRow[] = []
  let from = 0
  let hasMore = true
  while (hasMore) {
    const { data } = await supabase.from('leads').select('id, stage, source, first_called_at, date_received, time_to_call_minutes, sla_deadline, is_legacy').range(from, from + 999)
    const page = (data || []) as unknown as StatRow[]
    all = all.concat(page)
    hasMore = page.length === 1000
    from += 1000
  }
  const active = all.filter(l => LEAD_STAGES.includes(l.stage as LeadStage))

  // Avg time to call — exclude legacy (imported) leads
  const nonLegacy = all.filter(l => !l.is_legacy)
  const calledLeads = nonLegacy.filter(l => l.time_to_call_minutes != null)
  const avgTimeToCall = calledLeads.length > 0
    ? Math.round(calledLeads.reduce((sum, l) => sum + (l.time_to_call_minutes || 0), 0) / calledLeads.length)
    : null

  return {
    total: all.length,
    active: active.length,
    lead: all.filter(l => l.stage === 'LEAD').length,
    attempt1: all.filter(l => l.stage === 'ATTEMPT 1').length,
    attempt2: all.filter(l => l.stage === 'ATTEMPT 2').length,
    attempt3: all.filter(l => l.stage === 'ATTEMPT 3').length,
    attempt4: all.filter(l => l.stage === 'ATTEMPT 4').length,
    toSetter: all.filter(l => l.stage === 'TO SETTER').length,
    notQualified: all.filter(l => l.stage === 'NOT QUALIFIED').length,
    avgTimeToCall,
    fromAthena: all.filter(l => l.source === 'ATHENA').length,
    fromQuiz: all.filter(l => l.source === 'QUIZ').length,
    fromAds: all.filter(l => l.source === 'HIBOO ADS').length,
  }
}
