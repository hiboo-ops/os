import { supabase } from '@/lib/supabase'

export interface TriageCall {
  id: string
  lead_id: string
  team_member_id: string | null
  setter_id: string | null
  twilio_call_sid: string | null
  call_mode: string
  status: string
  outcome: string | null
  started_at: string | null
  ended_at: string | null
  duration_seconds: number | null
  recording_sid: string | null
  recording_duration_seconds: number | null
  transcript: string | null
  summary: string | null
  transcription_status: string | null
  created_at: string
}

export async function getTriageCallsForLead(leadId: string): Promise<TriageCall[]> {
  const { data, error } = await supabase
    .from('triage_calls')
    .select('id, lead_id, team_member_id, setter_id, twilio_call_sid, call_mode, status, outcome, started_at, ended_at, duration_seconds, recording_sid, recording_duration_seconds, transcript, summary, transcription_status, created_at')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })

  if (error) return []
  return (data || []) as TriageCall[]
}
