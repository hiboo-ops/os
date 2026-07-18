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
  creator: { id: string; name: string } | null
  triage_caller: { id: string; name: string } | null
  closer: { id: string; name: string } | null
}

export async function getAllLeads(filters?: { source?: string; stage?: string; search?: string }) {
  let query = supabase
    .from('leads')
    .select(`
      *,
      creator:creators(id, name),
      triage_caller:setters(id, name),
      closer:closers(id, name)
    `)
    .order('created_at', { ascending: false })

  if (filters?.source) query = query.eq('source', filters.source)
  if (filters?.stage) query = query.eq('stage', filters.stage)

  const { data } = await query
  let results = (data || []) as unknown as Lead[]

  if (filters?.search) {
    const q = filters.search.toLowerCase()
    results = results.filter(l =>
      l.name?.toLowerCase().includes(q) ||
      l.email?.toLowerCase().includes(q) ||
      l.phone?.includes(q)
    )
  }

  return results
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
  const { data } = await supabase.from('leads').select('id, stage, source')
  const all = data || []
  return {
    total: all.length,
    new: all.filter(l => l.stage === 'NEW').length,
    callBooked: all.filter(l => l.stage === 'CALL BOOKED').length,
    triage: all.filter(l => l.stage === 'TRIAGE').length,
    qualified: all.filter(l => l.stage === 'QUALIFIED').length,
    notQualified: all.filter(l => l.stage === 'NOT QUALIFIED').length,
    noAnswer: all.filter(l => l.stage === 'NO ANSWER').length,
    fromQuiz: all.filter(l => l.source === 'QUIZ').length,
    fromAds: all.filter(l => l.source === 'HIBOO ADS').length,
    fromCreator: all.filter(l => l.source === 'CREATOR').length,
  }
}
