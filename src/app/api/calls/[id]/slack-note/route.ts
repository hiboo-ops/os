import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { sendToPurpose } from '@/lib/slack'

const NOTE_LABELS: Record<string, string> = {
  setter: 'Setter notes',
  pre_call: 'Pre-call notes',
  closing: 'Closing notes',
  triage: 'Triage notes',
}

/**
 * POST /api/calls/[id]/slack-note
 * Pusht een notitie van de deal-detail naar Slack (purpose 'sales_notes').
 * Zonder geconfigureerde webhook is het een stille no-op — Slack breekt nooit een request.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN', 'CLOSER'])
  if (denied) return denied

  const { id } = await ctx.params
  const body = await req.json()
  const { note_type, text } = body as { note_type: string; text: string }

  if (!note_type || !NOTE_LABELS[note_type]) {
    return NextResponse.json({ error: 'Ongeldig note_type' }, { status: 400 })
  }
  if (!text || !text.trim()) {
    return NextResponse.json({ error: 'text is verplicht' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()
  const { data: call } = await admin
    .from('calls')
    .select('name, closer:closers(name)')
    .eq('id', id)
    .maybeSingle()

  const name = call?.name || 'Onbekend'
  const closerRel = call?.closer as { name?: string } | { name?: string }[] | null
  const closer = Array.isArray(closerRel) ? closerRel[0]?.name : closerRel?.name
  const header = `*${NOTE_LABELS[note_type]} — ${name}*${closer ? ` (${closer})` : ''}`
  const message = `${header}\n${text.trim()}`

  await sendToPurpose('sales_notes', message)

  return NextResponse.json({ ok: true })
}
