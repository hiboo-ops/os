import { supabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function POST(req: NextRequest) {
  const body = await req.json()

  await supabase.from('webhook_logs').insert({
    source: 'calendly',
    event: body.event || 'unknown',
    payload: body,
  })

  const event = body.event as string | undefined
  const payload = body.payload as Record<string, any> | undefined

  if (!event || !payload) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  try {
    if (event === 'invitee.created') {
      await handleInviteeCreated(payload)
    } else if (event === 'invitee.canceled') {
      await handleInviteeCanceled(payload)
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Calendly webhook error:', err)
    await supabase.from('webhook_logs').insert({
      source: 'calendly-error',
      event,
      payload: { error: String(err), original: payload },
    })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

function getWeekAndMonth(dateStr: string | null): { week: number; month: number } {
  const d = dateStr ? new Date(dateStr) : new Date()
  const month = d.getMonth() + 1
  // ISO week number
  const tmp = new Date(d.getTime())
  tmp.setHours(0, 0, 0, 0)
  tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7))
  const week1 = new Date(tmp.getFullYear(), 0, 4)
  const week = 1 + Math.round(((tmp.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
  return { week, month }
}

async function handleInviteeCreated(p: Record<string, any>) {
  const inviteeUri = (p.uri as string) || null
  const name = (p.name as string) || ''
  const email = ((p.email as string) || '').toLowerCase()
  const tracking = p.tracking as Record<string, any> || {}
  const scheduledEvent = p.scheduled_event as Record<string, any> || {}
  const questionsAndAnswers = p.questions_and_answers as { question: string; answer: string; position: number }[] || []

  const eventName = (scheduledEvent.name as string) || null
  const startTime = (scheduledEvent.start_time as string) || null
  const meetingLink = scheduledEvent.location?.join_url as string || null
  const cancelUrl = (p.cancel_url as string) || null
  const rescheduleUrl = (p.reschedule_url as string) || null

  const utmSource = (tracking.utm_source as string) || null
  const utmCampaign = (tracking.utm_campaign as string) || null
  const utmContent = (tracking.utm_content as string) || null

  // Extract phone + instagram from questions
  let phone: string | null = null
  let instagram: string | null = null
  const questions = questionsAndAnswers.map(qa => {
    const q = qa.question.toLowerCase()
    if (q.includes('telefoon') || q.includes('phone')) phone = qa.answer
    if (q.includes('instagram')) instagram = qa.answer
    return { question: qa.question, answer: qa.answer }
  })

  // ── DUPLICATE CHECK ──
  if (inviteeUri) {
    const { data: existing } = await supabase
      .from('calls')
      .select('id')
      .eq('calendly_invitee_uri', inviteeUri)
      .limit(1)
      .single()

    if (existing) {
      // Update existing call instead of creating duplicate
      await supabase.from('calls').update({
        date_start_time: startTime,
        meeting_link: meetingLink,
        cancel_link: cancelUrl,
        reschedule_link: rescheduleUrl,
      }).eq('id', existing.id)
      return
    }
  }

  // ── FIND LEAD ──
  let leadId: string | null = null
  let setterId: string | null = null
  let leadSource: string | null = null
  let leadCreatorName: string | null = utmCampaign
  let leadAdCampaign: string | null = utmContent
  let triageNotes: string | null = null

  if (email) {
    const { data: lead } = await supabase
      .from('leads')
      .select('id, triage_caller_id, creator_name, source, ad_campaign, triage_notes')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (lead) {
      leadId = lead.id
      setterId = lead.triage_caller_id
      leadSource = lead.source
      triageNotes = lead.triage_notes
      if (lead.creator_name) leadCreatorName = lead.creator_name
      if (lead.ad_campaign) leadAdCampaign = lead.ad_campaign

      await supabase.from('leads').update({
        stage: 'CLOSING CALL BOOKED',
        scheduled_call_date: startTime,
        phone: phone || undefined,
        quiz_answers: questions.length > 0 ? questions : undefined,
      }).eq('id', lead.id)
    } else {
      // No existing lead → create one
      const { data: newLead } = await supabase.from('leads').insert({
        name,
        email,
        phone,
        source: utmSource || 'CALENDLY',
        stage: 'CLOSING CALL BOOKED',
        date_received: new Date().toISOString(),
        scheduled_call_date: startTime,
        creator_name: leadCreatorName,
        ad_campaign: leadAdCampaign,
        quiz_answers: questions.length > 0 ? questions : null,
      }).select('id').single()
      if (newLead) leadId = newLead.id
    }
  }

  // ── SOURCE: lead source takes priority over UTM ──
  const callSource = leadSource || utmSource

  // ── FIND CLOSER from calendly_events table ──
  let closerId: string | null = null
  if (eventName) {
    const { data: calEvent } = await supabase
      .from('calendly_events')
      .select('default_closer_id')
      .ilike('name', `%${eventName.replace(/[^\w\s]/g, '')}%`)
      .limit(1)
      .single()

    if (calEvent?.default_closer_id) {
      closerId = calEvent.default_closer_id
    }
  }

  // ── WEEK/MONTH ──
  const { week, month } = getWeekAndMonth(startTime)

  // ── CREATE CALL ──
  const { data: call } = await supabase.from('calls').insert({
    name,
    email: email || null,
    phone,
    instagram,
    date_start_time: startTime,
    closer_id: closerId,
    setter_id: setterId,
    source: callSource,
    source_type: [leadCreatorName, leadAdCampaign].filter(Boolean).join(' | ') || utmContent || null,
    result: 'CALL BOOKED',
    event_type: eventName,
    questions: questions.length > 0 ? questions : null,
    triage_notes: triageNotes,
    meeting_link: meetingLink,
    cancel_link: cancelUrl,
    reschedule_link: rescheduleUrl,
    calendly_invitee_uri: inviteeUri,
    week,
    month,
  }).select('id').single()

  // ── LINK CALL TO LEAD ──
  if (call && leadId) {
    await supabase.from('leads').update({ call_id: call.id }).eq('id', leadId)
  }
}

async function handleInviteeCanceled(p: Record<string, any>) {
  const email = ((p.email as string) || '').toLowerCase()
  const inviteeUri = (p.uri as string) || null
  const cancelReason = (p.canceler_type as string) || null

  if (!email && !inviteeUri) return

  // Find call by invitee URI first (most reliable), then by email
  let callId: string | null = null

  if (inviteeUri) {
    const { data } = await supabase
      .from('calls')
      .select('id')
      .eq('calendly_invitee_uri', inviteeUri)
      .single()
    if (data) callId = data.id
  }

  if (!callId && email) {
    const { data } = await supabase
      .from('calls')
      .select('id')
      .eq('email', email)
      .eq('result', 'CALL BOOKED')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    if (data) callId = data.id
  }

  if (callId) {
    await supabase.from('calls').update({
      result: 'CANCELLED BY LEAD',
      no_deal_reason: cancelReason,
    }).eq('id', callId)
  }

  // Revert lead stage
  if (email) {
    const { data: lead } = await supabase
      .from('leads')
      .select('id')
      .eq('email', email)
      .eq('stage', 'CLOSING CALL BOOKED')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (lead) {
      await supabase.from('leads').update({ stage: 'FOLLOW UP' }).eq('id', lead.id)
    }
  }
}
