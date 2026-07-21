import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sendToPurpose } from '@/lib/slack'
import { logApiEvent } from '@/lib/api-log'

export async function GET(req: NextRequest) {
  const start = Date.now()
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  try {
    const now = new Date().toISOString()

    const { data: leads, error } = await supabase
      .from('leads')
      .select('id, name, source, sla_deadline')
      .lt('sla_deadline', now)
      .eq('sla_met', false)
      .limit(50)

    if (error) {
      logApiEvent({ direction: 'CRON', source: 'internal', action: 'sla-check', status: 'FAILED', duration_ms: Date.now() - start, error: error.message })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!leads || leads.length === 0) {
      logApiEvent({ direction: 'CRON', source: 'internal', action: 'sla-check', status: 'SUCCESS', duration_ms: Date.now() - start })
      return NextResponse.json({ message: 'Geen SLA-overtredingen' })
    }

    const lijstItems = leads.map(
      (l) => `- *${l.name || 'Onbekend'}* (${l.source || '?'}) — deadline: ${l.sla_deadline}`
    )

    await sendToPurpose(
      'sla',
      `SLA-alert: ${leads.length} lead(s) met verstreken deadline`,
      [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*SLA-alert — ${leads.length} lead(s) met verstreken deadline*\n\n${lijstItems.join('\n')}`,
          },
        },
      ]
    )

    logApiEvent({ direction: 'CRON', source: 'internal', action: 'sla-check', status: 'SUCCESS', duration_ms: Date.now() - start })
    return NextResponse.json({ message: `${leads.length} SLA-alert(s) verstuurd` })
  } catch (err) {
    logApiEvent({ direction: 'CRON', source: 'internal', action: 'sla-check', status: 'FAILED', duration_ms: Date.now() - start, error: err instanceof Error ? err.message : String(err) })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
