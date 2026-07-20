import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { validateTwilioRequest, twimlResponse, emptyTwiml } from '@/lib/twilio'

// Lifecycle-callbacks van de lead-poot (<Number statusCallback>).
// CallSid = child leg, ParentCallSid = browser/setter leg (= triage_calls.twilio_call_sid).
export async function POST(req: Request) {
  const body = await validateTwilioRequest(req, '/api/twilio/status')
  if (!body) return new Response('Forbidden', { status: 403 })

  const callSid = body.get('CallSid')
  const parentCallSid = body.get('ParentCallSid')
  const callStatus = body.get('CallStatus')
  const duration = body.get('CallDuration')

  if (!callSid || !callStatus) return twimlResponse(emptyTwiml)

  const { data: call } = parentCallSid
    ? await getSupabaseAdmin().from('triage_calls').select('id, lead_id').eq('twilio_call_sid', parentCallSid).single()
    : await getSupabaseAdmin().from('triage_calls').select('id, lead_id').eq('child_call_sid', callSid).single()

  if (!call) return twimlResponse(emptyTwiml)

  const now = new Date().toISOString()
  const updates: Record<string, unknown> = { status: callStatus, child_call_sid: callSid }
  if (callStatus === 'in-progress' || callStatus === 'answered') {
    updates.status = 'in-progress'
    updates.started_at = now
  }
  if (['completed', 'busy', 'no-answer', 'failed', 'canceled'].includes(callStatus)) {
    updates.ended_at = now
    if (duration) updates.duration_seconds = Number(duration)
  }

  await getSupabaseAdmin().from('triage_calls').update(updates).eq('id', call.id)

  return twimlResponse(emptyTwiml)
}
