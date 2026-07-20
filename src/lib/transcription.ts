import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

const MIN_DURATION_SECONDS = 10

interface SummaryResult {
  samenvatting: string
  uitkomst: string | null
  actiepunten: string[]
}

async function logError(step: string, error: unknown, callSid: string) {
  await getSupabaseAdmin().from('webhook_logs').insert({
    source: 'twilio-error',
    event: step,
    payload: { callSid, error: error instanceof Error ? error.message : String(error) },
  })
}

async function downloadRecording(recordingUrl: string): Promise<Blob> {
  const auth = Buffer.from(
    `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
  ).toString('base64')
  const res = await fetch(`${recordingUrl}.mp3`, {
    headers: { Authorization: `Basic ${auth}` },
  })
  if (!res.ok) throw new Error(`Opname downloaden mislukt: ${res.status}`)
  return await res.blob()
}

async function transcribeWithWhisper(audio: Blob): Promise<string> {
  const form = new FormData()
  form.append('file', audio, 'recording.mp3')
  form.append('model', 'whisper-1')
  form.append('language', 'nl')
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  })
  if (!res.ok) throw new Error(`Whisper mislukt: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return data.text || ''
}

async function summarizeWithClaude(transcript: string, leadName: string): Promise<SummaryResult> {
  const anthropic = new Anthropic()
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    system:
      'Je bent een assistent voor een Nederlands sales-triageteam. Je vat telefoongesprekken met leads kort en zakelijk samen in het Nederlands. Antwoord uitsluitend met geldige JSON, zonder markdown.',
    messages: [
      {
        role: 'user',
        content:
          `Transcript van een triagegesprek met lead "${leadName}":\n\n${transcript}\n\n` +
          `Geef JSON in dit formaat: {"samenvatting": "3-5 zinnen over het gesprek", ` +
          `"uitkomst": een van "FOLLOW UP" | "CLOSING CALL BOOKED" | "LOST - NO INTEREST" | "LOST - BROKE" | "VOICEMAIL" | "ONDUIDELIJK", ` +
          `"actiepunten": ["korte actiepunten voor de setter"]}`,
      },
    ],
  })

  const block = response.content[0]
  const text = block.type === 'text' ? block.text : ''
  try {
    const parsed = JSON.parse(text)
    return {
      samenvatting: parsed.samenvatting || text,
      uitkomst: parsed.uitkomst || null,
      actiepunten: Array.isArray(parsed.actiepunten) ? parsed.actiepunten : [],
    }
  } catch {
    return { samenvatting: text, uitkomst: null, actiepunten: [] }
  }
}

// Volledige pipeline: mp3 downloaden → Whisper (nl) → Claude-samenvatting → opslaan.
// Draait via waitUntil vanuit de recording-webhook.
export async function transcribeAndSummarize(
  triageCallId: string,
  recordingUrl: string,
  durationSeconds: number
): Promise<void> {
  if (durationSeconds < MIN_DURATION_SECONDS) {
    await getSupabaseAdmin()
      .from('triage_calls')
      .update({ transcription_status: 'done' })
      .eq('id', triageCallId)
    return
  }

  try {
    const { data: call } = await getSupabaseAdmin()
      .from('triage_calls')
      .select('id, lead_id, leads:lead_id(name)')
      .eq('id', triageCallId)
      .single()
    const leadName = (call?.leads as unknown as { name: string } | null)?.name || 'onbekend'

    const audio = await downloadRecording(recordingUrl)
    const transcript = await transcribeWithWhisper(audio)

    if (!transcript.trim()) {
      await getSupabaseAdmin()
        .from('triage_calls')
        .update({ transcript: null, transcription_status: 'done' })
        .eq('id', triageCallId)
      return
    }

    const summary = await summarizeWithClaude(transcript, leadName)
    const summaryText = [
      summary.samenvatting,
      summary.uitkomst ? `Uitkomst: ${summary.uitkomst}` : null,
      summary.actiepunten.length ? `Actiepunten:\n- ${summary.actiepunten.join('\n- ')}` : null,
    ].filter(Boolean).join('\n\n')

    await getSupabaseAdmin()
      .from('triage_calls')
      .update({ transcript, summary: summaryText, transcription_status: 'done' })
      .eq('id', triageCallId)
  } catch (error) {
    await getSupabaseAdmin()
      .from('triage_calls')
      .update({ transcription_status: 'failed' })
      .eq('id', triageCallId)
    await logError('transcription', error, triageCallId)
  }
}
