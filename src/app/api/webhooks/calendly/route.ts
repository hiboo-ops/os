import { supabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Calendly Webhook Endpoint
 *
 * Handles two event types:
 * - invitee.created → lead booked a call → create call record + update lead
 * - invitee.canceled → lead cancelled → update call record
 *
 * Setup in Calendly:
 * 1. Go to https://calendly.com/integrations/webhooks (or via API)
 * 2. Subscribe to events: invitee.created, invitee.canceled
 * 3. Set webhook URL to: https://your-domain.vercel.app/api/webhooks/calendly
 * 4. Set signing key in env var CALENDLY_WEBHOOK_SECRET (optional but recommended)
 *
 * UTM tracking flows through from the booking link:
 * - utm_source = lead source (ATHENA, QUIZ, etc.)
 * - utm_campaign = creator name
 * - utm_content = ad campaign
 */

export async function POST(req: NextRequest) {
  const body = await req.json()

  // Log every webhook for debugging
  await supabase.from('webhook_logs').insert({
    source: 'calendly',
    event: body.event || body.trigger || 'unknown',
    payload: body,
  })

  const event = body.event // 'invitee.created' or 'invitee.canceled'
  const payload = body.payload

  if (!event || !payload) {
    return NextResponse.json({ error: 'Invalid payload', received: Object.keys(body) }, { status: 400 })
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
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

async function handleInviteeCreated(payload: Record<string, unknown>) {
  const invitee = payload.invitee as Record<string, unknown> | undefined
  const eventData = payload.event as Record<string, unknown> | undefined
  const tracking = payload.tracking as Record<string, unknown> | undefined

  if (!invitee) return

  const name = invitee.name as string || ''
  const email = (invitee.email as string || '').toLowerCase()
  const scheduledAt = (eventData?.start_time as string) || null
  const eventName = (eventData?.name as string) || null
  const calendlyEventUri = (eventData?.uri as string) || null
  const inviteeUri = (invitee.uri as string) || null

  // UTM params from booking link
  const utmSource = (tracking?.utm_source as string) || null
  const utmCampaign = (tracking?.utm_campaign as string) || null
  const utmContent = (tracking?.utm_content as string) || null

  // Extract questions/answers if available
  const questionsAnswers = invitee.questions_and_answers as { question: string; answer: string }[] | undefined
  const questions = questionsAnswers?.map(qa => ({
    question: qa.question,
    answer: qa.answer,
  })) || null

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
        scheduled_call_date: scheduledAt,
      }).eq('id', lead.id)
    }
  }

  // 2. Find closer from calendly_events table (match on event name)
  let closerId: string | null = null
  if (eventName) {
    const { data: calEvent } = await supabase
      .from('calendly_events')
      .select('default_closer_id')
      .ilike('name', eventName)
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
    date_start_time: scheduledAt,
    closer_id: closerId,
    setter_id: setterId,
    source: utmSource,
    source_type: utmContent,
    result: 'CALL BOOKED',
    event_type: eventName,
    questions: questions,
    meeting_link: calendlyEventUri,
  }).select('id').single()

  // 4. Link call to lead
  if (call && leadId) {
    await supabase.from('leads').update({
      call_id: call.id,
    }).eq('id', leadId)
  }
}

async function handleInviteeCanceled(payload: Record<string, unknown>) {
  const invitee = payload.invitee as Record<string, unknown> | undefined
  if (!invitee) return

  const email = (invitee.email as string || '').toLowerCase()
  const cancelReason = (invitee.cancel_reason as string) || null

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

  // Also update lead stage
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
