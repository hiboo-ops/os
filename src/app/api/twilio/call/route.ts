import { NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getTwilioClient, twilioCallerId, appUrl } from '@/lib/twilio'
import { withApiLog } from '@/lib/api-log'

// Mobiele fallback: Twilio belt eerst de setter op mobiel; na opnemen draait
// /api/twilio/voice dezelfde TwiML en wordt de lead verbonden.
export async function POST(req: Request) {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN', 'SETTER'])
  if (denied) return denied

  const { leadId } = await req.json()
  if (!leadId) return NextResponse.json({ error: 'leadId is verplicht' }, { status: 400 })

  const [{ data: lead }, { data: member }] = await Promise.all([
    getSupabaseAdmin().from('leads').select('id, phone').eq('id', leadId).single(),
    getSupabaseAdmin().from('team_members').select('id, setter_id, mobile_phone').eq('id', user!.teamMemberId).single(),
  ])

  if (!lead?.phone) return NextResponse.json({ error: 'Lead heeft geen telefoonnummer' }, { status: 400 })
  if (!member?.mobile_phone) {
    return NextResponse.json({ error: 'Stel eerst je mobiele nummer in bij Belvoorkeuren' }, { status: 400 })
  }

  const call = await withApiLog(
    { direction: 'OUTBOUND', source: 'twilio', action: 'create_call' },
    async () => getTwilioClient().calls.create({
      to: member.mobile_phone,
      from: twilioCallerId(),
      url: appUrl('/api/twilio/voice'),
      method: 'POST',
    }),
  )

  // Twilio geeft geen custom params door bij REST-calls; /voice zoekt deze rij
  // op via CallSid (met retry voor de race met de webhook).
  await getSupabaseAdmin().from('triage_calls').insert({
    lead_id: lead.id,
    team_member_id: member.id,
    setter_id: member.setter_id,
    twilio_call_sid: call.sid,
    call_mode: 'mobile',
    status: 'initiated',
  })

  return NextResponse.json({ ok: true, callSid: call.sid })
}
