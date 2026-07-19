import { supabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function POST(req: NextRequest) {
  const body = await req.json()

  // Log every webhook
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
    // Log error
    await supabase.from('webhook_logs').insert({
      source: 'calendly-error',
      event,
      payload: { error: String(err), original: payload },
    })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

async function handleInviteeCreated(p: Record<string, any>) {
  // Calendly v2 payload: invitee data is at top level of payload
  const name = (p.name as string) || ''
  const email = ((p.email as string) || '').toLowerCase()
  const tracking = p.tracking as Record<string, any> || {}
  const scheduledEvent = p.scheduled_event as Record<string, any> || {}
  const questionsAndAnswers = p.questions_and_answers as { question: string; answer: string; position: number }[] || []

  // Scheduled event details
  const eventName = (scheduledEvent.name as string) || null
  const startTime = (scheduledEvent.start_time as string) || null
  const meetingLink = scheduledEvent.location?.join_url as string || null

  // Cancel/reschedule URLs
  const cancelUrl = (p.cancel_url as string) || null
  const rescheduleUrl = (p.reschedule_url as string) || null

  // UTM tracking
  const utmSource = (tracking.utm_source as string) || null
  const utmCampaign = (tracking.utm_campaign as string) || null
  const utmContent = (tracking.utm_content as string) || null

  // Extract phone from questions (look for telefoon/phone)
  let phone: string | null = null
  const questions = questionsAndAnswers.map(qa => {
    if (qa.question.toLowerCase().includes('telefoon') || qa.question.toLowerCase().includes('phone')) {
      phone = qa.answer
    }
    return { question: qa.question, answer: qa.answer }
  })

  // Extract instagram from questions
  let instagram: string | null = null
  for (const qa of questionsAndAnswers) {
    if (qa.question.toLowerCase().includes('instagram')) {
      instagram = qa.answer
    }
  }

  // 1. Find matching lead by email
  let leadId: string | null = null
  let setterId: string | null = null
  let creatorName: string | null = utmCampaign

  if (email) {
    const { data: lead } = await supabase
      .from('leads')
      .select('id, triage_caller_id, creator_name, source')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (lead) {
      leadId = lead.id
      setterId = lead.triage_caller_id
      if (!creatorName) creatorName = lead.creator_name

      // Update lead stage
      await supabase.from('leads').update({
        stage: 'CLOSING CALL BOOKED',
        scheduled_call_date: startTime,
      }).eq('id', lead.id)
    }
  }

  // 2. Find closer from calendly_events table
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

  // 3. Create call record in sales pipeline
  const { data: call } = await supabase.from('calls').insert({
    name,
    email: email || null,
    phone,
    instagram,
    date_start_time: startTime,
    closer_id: closerId,
    setter_id: setterId,
    source: utmSource,
    source_type: utmContent,
    result: 'CALL BOOKED',
    event_type: eventName,
    questions: questions.length > 0 ? questions : null,
    meeting_link: meetingLink,
    cancel_link: cancelUrl,
    reschedule_link: rescheduleUrl,
  }).select('id').single()

  // 4. Link call to lead
  if (call && leadId) {
    await supabase.from('leads').update({
      call_id: call.id,
    }).eq('id', leadId)
  }
}

async function handleInviteeCanceled(p: Record<string, any>) {
  const email = ((p.email as string) || '').toLowerCase()
  const cancelReason = (p.canceler_type as string) || null

  if (!email) return

  // Find the most recent CALL BOOKED call for this email
  const { data: call } = await supabase
    .from('calls')
    .select('id')
    .eq('email', email)
    .eq('result', 'CALL BOOKED')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (call) {
    await supabase.from('calls').update({
      result: 'CANCELLED BY LEAD',
      no_deal_reason: cancelReason,
    }).eq('id', call.id)
  }

  // Update lead stage back to FOLLOW UP
  const { data: lead } = await supabase
    .from('leads')
    .select('id')
    .eq('email', email)
    .eq('stage', 'CLOSING CALL BOOKED')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (lead) {
    await supabase.from('leads').update({
      stage: 'FOLLOW UP',
    }).eq('id', lead.id)
  }
}
