import { supabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN', 'CLOSER', 'SETTER'])
  if (denied) return denied

  const { searchParams } = req.nextUrl
  const week = searchParams.get('week')
  const month = searchParams.get('month')
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')
  const source = searchParams.get('source')
  const sourceType = searchParams.get('sourceType')
  const result = searchParams.get('result')

  let query = supabase
    .from('calls')
    .select(`
      *,
      closer:closers(id, name),
      setter:setters(id, name)
    `)
    .order('date_start_time', { ascending: false })

  if (week) query = query.eq('week', Number(week))
  if (month) query = query.eq('month', Number(month))
  if (dateFrom) query = query.gte('date_start_time', dateFrom)
  if (dateTo) query = query.lte('date_start_time', dateTo + 'T23:59:59')
  if (source) query = query.eq('source', source)
  if (sourceType) query = query.eq('source_type', sourceType)
  if (result) query = query.eq('result', result)

  // Role-based filtering: closers only see their own calls
  if (user!.role === 'CLOSER' && user!.closerId) {
    query = query.eq('closer_id', user!.closerId)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN', 'CLOSER', 'SETTER'])
  if (denied) return denied

  const body = await req.json()

  const { name, email, phone, instagram, date_start_time, closer_id, setter_id,
    source, source_type, result, event_type, setter_notes } = body

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('calls')
    .insert({
      name,
      email: email || null,
      phone: phone || null,
      instagram: instagram || null,
      date_start_time: date_start_time || null,
      closer_id: closer_id || null,
      setter_id: setter_id || null,
      source: source || null,
      source_type: source_type || null,
      result: result || 'NEW',
      event_type: event_type || null,
      setter_notes: setter_notes || null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN', 'CLOSER'])
  if (denied) return denied

  const body = await req.json()
  const { id, ...updates } = body

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  // Only allow known fields to be updated
  const allowed = [
    'name', 'email', 'phone', 'instagram', 'date_start_time',
    'closer_id', 'setter_id', 'source', 'source_type', 'result',
    'show_status', 'deal_value', 'cash_collected', 'event_type',
    'meeting_link', 'reschedule_link', 'cancel_link', 'fathom_link',
    'setter_notes', 'pre_call_notes', 'closing_notes', 'triage_notes',
    'no_deal_reason', 'next_touch_point', 'payment_plan', 'first_deposit',
    'whop_link', 'stripe_link', 'contract_url', 'questions',
    'week', 'month',
  ]

  const safeUpdates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in updates) {
      safeUpdates[key] = updates[key]
    }
  }

  if (Object.keys(safeUpdates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { error } = await supabase
    .from('calls')
    .update(safeUpdates)
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // ── AUTO-SYNC: call result change → update linked lead stage ──
  if (safeUpdates.result) {
    const resultToLeadStage: Record<string, string> = {
      'CALL BOOKED': 'CLOSING CALL BOOKED',
      'RESCHEDULE': 'CLOSING CALL BOOKED',
      'DEPOSIT': 'CLOSING CALL BOOKED',
      'FOLLOW UP': 'FOLLOW UP',
      'FOLLOW UP LONG TERM': 'FOLLOW UP',
      'CANCELLED BY LEAD': 'FOLLOW UP',
      'CANCELLED BY CLOSER': 'FOLLOW UP',
      'NO SHOW': 'FOLLOW UP',
      'CLOSED': 'CLOSED',
      'LOST - BROKE': 'LOST - BROKE',
      'LOST - NO INTEREST': 'LOST - NO INTEREST',
      'LOST - BAD FIT': 'LOST - NO INTEREST',
    }
    const newLeadStage = resultToLeadStage[safeUpdates.result as string]
    if (newLeadStage) {
      // Direct FK lookup: find lead where call_id = this call
      const { data: lead } = await supabase
        .from('leads')
        .select('id')
        .eq('call_id', id)
        .single()

      if (lead) {
        await supabase.from('leads').update({ stage: newLeadStage }).eq('id', lead.id)
      }
    }
  }

  return NextResponse.json({ success: true })
}
