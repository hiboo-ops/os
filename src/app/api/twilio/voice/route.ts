import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { validateTwilioRequest, twimlResponse, appUrl, twilioCallerId, emptyTwiml } from '@/lib/twilio'
import { logApiEvent } from '@/lib/api-log'

const SLA_MINUTES = 5

// Zet speed-to-lead velden server-side op het moment dat er echt gebeld wordt.
async function markLeadCalled(leadId: string) {
  const { data: lead } = await getSupabaseAdmin()
    .from('leads')
    .select('id, first_called_at, date_received')
    .eq('id', leadId)
    .single()
  if (!lead) return

  const now = new Date().toISOString()
  const updates: Record<string, unknown> = { last_attempt_at: now }
  if (!lead.first_called_at) {
    updates.first_called_at = now
    if (lead.date_received) {
      const ttc = Math.round((Date.now() - new Date(lead.date_received).getTime()) / 60000)
      updates.time_to_call_minutes = ttc
      updates.sla_met = ttc <= SLA_MINUTES
    }
  }
  await getSupabaseAdmin().from('leads').update(updates).eq('id', leadId)
}

function dialTwiml(to: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${twilioCallerId()}" answerOnBridge="true"
        record="record-from-answer-dual"
        recordingStatusCallback="${appUrl('/api/twilio/recording')}"
        recordingStatusCallbackEvent="completed">
    <Number statusCallback="${appUrl('/api/twilio/status')}"
            statusCallbackEvent="initiated ringing answered completed">${to}</Number>
  </Dial>
</Response>`
}

export async function POST(req: Request) {
  const body = await validateTwilioRequest(req, '/api/twilio/voice')
  if (!body) return new Response('Forbidden', { status: 403 })

  logApiEvent({
    direction: 'INBOUND',
    source: 'twilio',
    action: 'voice',
    event_type: 'twiml_request',
    status: 'SUCCESS',
    idempotency_key: body.get('CallSid') ? `twilio:voice:${body.get('CallSid')}` : undefined,
  })

  const callSid = body.get('CallSid')
  if (!callSid) return twimlResponse(emptyTwiml)

  const to = body.get('To')
  const leadId = body.get('leadId')
  const teamMemberId = body.get('teamMemberId')

  // Browserflow: SDK stuurt custom params (To/leadId/teamMemberId) mee.
  if (to && leadId) {
    let setterId: string | null = null
    if (teamMemberId) {
      const { data: member } = await getSupabaseAdmin()
        .from('team_members')
        .select('setter_id')
        .eq('id', teamMemberId)
        .single()
      setterId = member?.setter_id ?? null
    }

    await getSupabaseAdmin().from('triage_calls').insert({
      lead_id: leadId,
      team_member_id: teamMemberId || null,
      setter_id: setterId,
      twilio_call_sid: callSid,
      call_mode: 'browser',
      status: 'initiated',
    })
    await markLeadCalled(leadId)

    return twimlResponse(dialTwiml(to))
  }

  // Mobiele flow: REST-call geeft geen custom params door; de rij is vooraf
  // aangemaakt door /api/twilio/call — zoek op CallSid (1x retry voor de race).
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data: call } = await getSupabaseAdmin()
      .from('triage_calls')
      .select('id, lead_id, leads:lead_id(phone)')
      .eq('twilio_call_sid', callSid)
      .single()
    if (call) {
      const phone = (call.leads as unknown as { phone: string | null } | null)?.phone
      if (!phone) break
      await markLeadCalled(call.lead_id)
      return twimlResponse(dialTwiml(phone))
    }
    await new Promise(r => setTimeout(r, 500))
  }

  return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Say language="nl-NL">Er ging iets mis bij het verbinden. Probeer het opnieuw vanuit het dashboard.</Say></Response>`)
}
