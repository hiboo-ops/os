import { supabase } from '@/lib/supabase'

interface FunnelMetrics {
  leads: number
  toSetter: number
  setterRate: number
  calls: number
  deals: number
  dealRate: number
  revenue: number
  revenuePerLead: number
}

interface SourceRow {
  source: string
  leads: number
  toSetter: number
  setterRate: number
  deals: number
  dealRate: number
  revenue: number
  revPerLead: number
}

interface TriageRow {
  callerId: string | null
  name: string
  called: number
  connected: number
  toSetter: number
  avgTimeToCall: number | null
  slaPercent: number
}

interface WeekTrend {
  week: string
  leads: number
  toSetter: number
  setterRate: number
  avgTTC: number | null
  slaPercent: number
}

interface SLAStatus {
  today: { total: number; withinSLA: number; outsideSLA: number; slaPercent: number }
  uncalled: number
}

// ─── Funnel Metrics ─────────────────────────────────────────────────────────

export async function getFunnelMetrics(dateFrom?: string, dateTo?: string, source?: string): Promise<FunnelMetrics> {
  // Get leads in period
  let leadsQuery = supabase.from('leads').select('id, stage, call_id, source, date_received').limit(10000)
  if (dateFrom) leadsQuery = leadsQuery.gte('date_received', dateFrom)
  if (dateTo) leadsQuery = leadsQuery.lte('date_received', dateTo)
  if (source) leadsQuery = leadsQuery.eq('source', source)

  const { data: leadsData } = await leadsQuery
  const leads = leadsData || []

  const totalLeads = leads.length
  const toSetterLeads = leads.filter(l => l.stage === 'TO SETTER' || l.call_id)
  const toSetterCount = toSetterLeads.length
  const setterRate = totalLeads > 0 ? (toSetterCount / totalLeads) * 100 : 0

  // Get linked calls and their results
  const callIds = leads.map(l => l.call_id).filter(Boolean) as string[]
  let deals = 0
  let revenue = 0
  let callCount = 0

  if (callIds.length > 0) {
    const { data: callsData } = await supabase
      .from('calls')
      .select('id, result, deal_value')
      .in('id', callIds)

    const calls = callsData || []
    callCount = calls.length
    const dealCalls = calls.filter(c => c.result === 'DEAL')
    deals = dealCalls.length
    revenue = dealCalls.reduce((sum, c) => sum + (c.deal_value || 0), 0)
  }

  const dealRate = callCount > 0 ? (deals / callCount) * 100 : 0
  const revenuePerLead = totalLeads > 0 ? revenue / totalLeads : 0

  return { leads: totalLeads, toSetter: toSetterCount, setterRate, calls: callCount, deals, dealRate, revenue, revenuePerLead }
}

// ─── Source Performance ─────────────────────────────────────────────────────

export async function getSourcePerformance(dateFrom?: string, dateTo?: string): Promise<SourceRow[]> {
  let query = supabase.from('leads').select('id, source, stage, call_id, date_received, ad_campaign, creator_name').limit(10000)
  if (dateFrom) query = query.gte('date_received', dateFrom)
  if (dateTo) query = query.lte('date_received', dateTo)

  const { data: leadsData } = await query
  const leads = leadsData || []

  // Group by source (use creator_name or ad_campaign for more granularity)
  const sourceMap = new Map<string, typeof leads>()
  for (const lead of leads) {
    const key = lead.creator_name || lead.source || 'Onbekend'
    if (!sourceMap.has(key)) sourceMap.set(key, [])
    sourceMap.get(key)!.push(lead)
  }

  // Get all call IDs for deal lookup
  const allCallIds = leads.map(l => l.call_id).filter(Boolean) as string[]
  let callResults = new Map<string, { result: string; deal_value: number | null }>()

  if (allCallIds.length > 0) {
    const { data: callsData } = await supabase
      .from('calls')
      .select('id, result, deal_value')
      .in('id', allCallIds)

    for (const c of callsData || []) {
      callResults.set(c.id, { result: c.result, deal_value: c.deal_value })
    }
  }

  const rows: SourceRow[] = []
  for (const [source, sourceLeads] of sourceMap) {
    const total = sourceLeads.length
    const toSetter = sourceLeads.filter(l => l.stage === 'TO SETTER' || l.call_id).length
    const setterRate = total > 0 ? (toSetter / total) * 100 : 0

    let deals = 0
    let revenue = 0
    for (const lead of sourceLeads) {
      if (lead.call_id && callResults.has(lead.call_id)) {
        const call = callResults.get(lead.call_id)!
        if (call.result === 'DEAL') {
          deals++
          revenue += call.deal_value || 0
        }
      }
    }

    const dealRate = toSetter > 0 ? (deals / toSetter) * 100 : 0
    const revPerLead = total > 0 ? revenue / total : 0

    rows.push({ source, leads: total, toSetter, setterRate, deals, dealRate, revenue, revPerLead })
  }

  return rows.sort((a, b) => b.leads - a.leads)
}

// ─── Triage Performance ─────────────────────────────────────────────────────

export async function getTriagePerformance(dateFrom?: string, dateTo?: string): Promise<TriageRow[]> {
  let query = supabase.from('leads').select('id, triage_caller_id, stage, attempt_count, first_called_at, time_to_call_minutes, sla_met, date_received').limit(10000)
  if (dateFrom) query = query.gte('date_received', dateFrom)
  if (dateTo) query = query.lte('date_received', dateTo)
  // Only include leads that have been called at least once
  query = query.gt('attempt_count', 0)

  const { data: leadsData } = await query
  const leads = leadsData || []

  // Get setter/triage caller names
  const { data: setters } = await supabase.from('setters').select('id, name')
  const setterMap = new Map((setters || []).map(s => [s.id, s.name]))

  // Group by triage caller
  const callerMap = new Map<string, typeof leads>()
  for (const lead of leads) {
    const key = lead.triage_caller_id || 'unassigned'
    if (!callerMap.has(key)) callerMap.set(key, [])
    callerMap.get(key)!.push(lead)
  }

  const rows: TriageRow[] = []
  for (const [callerId, callerLeads] of callerMap) {
    const called = callerLeads.length
    const connected = callerLeads.filter(l => l.stage === 'TO SETTER' || l.stage === 'NOT QUALIFIED').length
    const toSetter = callerLeads.filter(l => l.stage === 'TO SETTER').length

    const ttcLeads = callerLeads.filter(l => l.time_to_call_minutes != null)
    const avgTimeToCall = ttcLeads.length > 0
      ? Math.round(ttcLeads.reduce((sum, l) => sum + (l.time_to_call_minutes || 0), 0) / ttcLeads.length)
      : null

    const slaLeads = callerLeads.filter(l => l.sla_met != null)
    const slaPercent = slaLeads.length > 0
      ? Math.round((slaLeads.filter(l => l.sla_met === true).length / slaLeads.length) * 100)
      : 0

    rows.push({
      callerId: callerId === 'unassigned' ? null : callerId,
      name: callerId === 'unassigned' ? 'Niet toegewezen' : (setterMap.get(callerId) || 'Onbekend'),
      called,
      connected,
      toSetter,
      avgTimeToCall,
      slaPercent,
    })
  }

  return rows.sort((a, b) => b.called - a.called)
}

// ─── Weekly Trends ──────────────────────────────────────────────────────────

export async function getWeeklyTrends(weeksBack = 12): Promise<WeekTrend[]> {
  const now = new Date()
  const startDate = new Date(now.getTime() - weeksBack * 7 * 24 * 60 * 60 * 1000)

  const { data: leadsData } = await supabase
    .from('leads')
    .select('id, stage, date_received, time_to_call_minutes, sla_met, call_id')
    .gte('date_received', startDate.toISOString())
    .limit(10000)

  const leads = leadsData || []

  // Group by ISO week
  const weekMap = new Map<string, typeof leads>()
  for (const lead of leads) {
    if (!lead.date_received) continue
    const d = new Date(lead.date_received)
    const week = getISOWeek(d)
    if (!weekMap.has(week)) weekMap.set(week, [])
    weekMap.get(week)!.push(lead)
  }

  const trends: WeekTrend[] = []
  for (const [week, weekLeads] of [...weekMap].sort((a, b) => a[0].localeCompare(b[0]))) {
    const total = weekLeads.length
    const toSetter = weekLeads.filter(l => l.stage === 'TO SETTER' || l.call_id).length
    const setterRate = total > 0 ? Math.round((toSetter / total) * 100) : 0

    const ttcLeads = weekLeads.filter(l => l.time_to_call_minutes != null)
    const avgTTC = ttcLeads.length > 0
      ? Math.round(ttcLeads.reduce((sum, l) => sum + (l.time_to_call_minutes || 0), 0) / ttcLeads.length)
      : null

    const slaLeads = weekLeads.filter(l => l.sla_met != null)
    const slaPercent = slaLeads.length > 0
      ? Math.round((slaLeads.filter(l => l.sla_met === true).length / slaLeads.length) * 100)
      : 0

    trends.push({ week, leads: total, toSetter, setterRate, avgTTC, slaPercent })
  }

  return trends
}

// ─── SLA Status (real-time) ─────────────────────────────────────────────────

export async function getSLAStatus(): Promise<SLAStatus> {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const { data: todayLeads } = await supabase
    .from('leads')
    .select('id, sla_met, first_called_at, stage')
    .gte('date_received', todayStart.toISOString())

  const leads = todayLeads || []
  const total = leads.length
  const withinSLA = leads.filter(l => l.sla_met === true).length
  const outsideSLA = leads.filter(l => l.sla_met === false).length
  const slaPercent = total > 0 ? Math.round((withinSLA / total) * 100) : 100

  // Uncalled leads — only recent (< 7 days), not old imported ones
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: uncalledData } = await supabase
    .from('leads')
    .select('id')
    .eq('stage', 'LEAD')
    .is('first_called_at', null)
    .gte('date_received', oneWeekAgo)

  return {
    today: { total, withinSLA, outsideSLA, slaPercent },
    uncalled: (uncalledData || []).length,
  }
}

// ─── Helper ─────────────────────────────────────────────────────────────────

function getISOWeek(d: Date): string {
  const date = new Date(d.getTime())
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7))
  const week1 = new Date(date.getFullYear(), 0, 4)
  const weekNum = 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
  return `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}
