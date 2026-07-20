import { waitUntil } from '@vercel/functions'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { validateTwilioRequest, twimlResponse, emptyTwiml } from '@/lib/twilio'
import { transcribeAndSummarize } from '@/lib/transcription'

export const maxDuration = 300

// Recording-callback: opname opslaan, direct 200 antwoorden en de
// transcriptie/samenvatting-pipeline op de achtergrond starten.
export async function POST(req: Request) {
  const body = await validateTwilioRequest(req, '/api/twilio/recording')
  if (!body) return new Response('Forbidden', { status: 403 })

  const callSid = body.get('CallSid')
  const recordingSid = body.get('RecordingSid')
  const recordingUrl = body.get('RecordingUrl')
  const duration = Number(body.get('RecordingDuration') || 0)

  if (!callSid || !recordingSid || !recordingUrl) return twimlResponse(emptyTwiml)

  // CallSid van de recording-callback is de parent leg van de <Dial>.
  const { data: call } = await getSupabaseAdmin()
    .from('triage_calls')
    .select('id')
    .or(`twilio_call_sid.eq.${callSid},child_call_sid.eq.${callSid}`)
    .single()

  if (!call) return twimlResponse(emptyTwiml)

  await getSupabaseAdmin()
    .from('triage_calls')
    .update({
      recording_sid: recordingSid,
      recording_url: recordingUrl,
      recording_duration_seconds: duration,
      transcription_status: 'processing',
    })
    .eq('id', call.id)

  waitUntil(transcribeAndSummarize(call.id, recordingUrl, duration))

  return twimlResponse(emptyTwiml)
}
