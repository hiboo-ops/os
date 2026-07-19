import { supabase } from '@/lib/supabase'

interface FunnelMetrics {
  leadsIn: number
  contacted: number
  contactedRate: number
  callBooked: number
  callBookedRate: number
  closed: number
  closedRate: number
  revenue: number
  revenuePerLead: number
}

interface SourceRow {
  source: string
  leads: number
  contacted: number
  callBooked: number
  closed: number
  revenue: number
  endToEndRate: number
}

// ─── Funnel Metrics ─────────────────────────────────────────────────────────

export async function getFunnelMetrics(dateFrom?: string, dateTo?: string, source?: string): Promise<FunnelMetrics> {
  let query = supabase.from('leads')
    .select('id, stage, call_id, first_called_at, is_legacy')
    .limit(10000)

  if (dateFrom) query = query.gte('date_received', dateFrom)
  if (dateTo) query = query.lte('date_received', dateTo)
  if (source) query = query.eq('source', source)

  const { data } = await query
  const leads = data || []

  const leadsIn = leads.length
  const contacted = leads.filter(l => l.first_called_at != null).length
  const callBookedLeads = leads.filter(l =>
    l.stage === 'CLOSING CALL BOOKED' || l.stage === 'CLOSED' || l.call_id
  )
  const callBooked = callBookedLeads.length

  // Get closed deals from linked calls
  const callIds = leads.map(l => l.call_id).filter(Boolean) as string[]
  let closed = 0
  let revenue = 0

  if (callIds.length > 0) {
    const { data: calls } = await supabase
      .from('calls')
      .select('id, result, deal_value')
      .in('id', callIds)

    const closedCalls = (calls || []).filter(c => c.result === 'CLOSED')
    closed = closedCalls.length
    revenue = closedCalls.reduce((sum, c) => sum + (c.deal_value || 0), 0)
  }

  return {
    leadsIn,
    contacted,
    contactedRate: leadsIn > 0 ? (contacted / leadsIn) * 100 : 0,
    callBooked,
    callBookedRate: contacted > 0 ? (callBooked / contacted) * 100 : 0,
    closed,
    closedRate: callBooked > 0 ? (closed / callBooked) * 100 : 0,
    revenue,
    revenuePerLead: leadsIn > 0 ? revenue / leadsIn : 0,
  }
}

// ─── Source Performance ─────────────────────────────────────────────────────

export async function getSourcePerformance(dateFrom?: string, dateTo?: string): Promise<SourceRow[]> {
  let query = supabase.from('leads')
    .select('id, source, stage, call_id, first_called_at, is_legacy')
    .limit(10000)

  if (dateFrom) query = query.gte('date_received', dateFrom)
  if (dateTo) query = query.lte('date_received', dateTo)

  const { data } = await query
  const leads = data || []

  // Group by source
  const sourceMap = new Map<string, typeof leads>()
  for (const lead of leads) {
    const key = lead.source || 'UNKNOWN'
    if (!sourceMap.has(key)) sourceMap.set(key, [])
    sourceMap.get(key)!.push(lead)
  }

  // Get call results for deal lookup
  const allCallIds = leads.map(l => l.call_id).filter(Boolean) as string[]
  const callResults = new Map<string, { result: string; deal_value: number | null }>()

  if (allCallIds.length > 0) {
    const { data: calls } = await supabase
      .from('calls')
      .select('id, result, deal_value')
      .in('id', allCallIds)

    for (const c of calls || []) {
      callResults.set(c.id, { result: c.result, deal_value: c.deal_value })
    }
  }

  const rows: SourceRow[] = []
  for (const [source, sourceLeads] of sourceMap) {
    const total = sourceLeads.length
    const contacted = sourceLeads.filter(l => l.first_called_at != null).length
    const callBooked = sourceLeads.filter(l =>
      l.stage === 'CLOSING CALL BOOKED' || l.stage === 'CLOSED' || l.call_id
    ).length

    let closed = 0
    let revenue = 0
    for (const lead of sourceLeads) {
      if (lead.call_id && callResults.has(lead.call_id)) {
        const call = callResults.get(lead.call_id)!
        if (call.result === 'CLOSED') {
          closed++
          revenue += call.deal_value || 0
        }
      }
    }

    rows.push({
      source,
      leads: total,
      contacted,
      callBooked,
      closed,
      revenue,
      endToEndRate: total > 0 ? (closed / total) * 100 : 0,
    })
  }

  return rows.sort((a, b) => b.leads - a.leads)
}

// ─── SLA Status (used by leads board) ───────────────────────────────────────

interface SLAStatus {
  today: { total: number; withinSLA: number; outsideSLA: number; slaPercent: number }
  uncalled: number
}

export async function getSLAStatus(): Promise<SLAStatus> {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const { data: todayLeads } = await supabase
    .from('leads')
    .select('id, sla_met, first_called_at, stage')
    .gte('date_received', todayStart.toISOString())
    .eq('is_legacy', false)

  const leads = todayLeads || []
  const total = leads.length
  const withinSLA = leads.filter(l => l.sla_met === true).length
  const outsideSLA = leads.filter(l => l.sla_met === false).length
  const slaPercent = total > 0 ? Math.round((withinSLA / total) * 100) : 100

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
