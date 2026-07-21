import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sendToPurpose } from '@/lib/slack'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const now = new Date().toISOString()

  const { data: leads, error } = await supabase
    .from('leads')
    .select('id, name, source, sla_deadline')
    .lt('sla_deadline', now)
    .eq('sla_met', false)
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!leads || leads.length === 0) {
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

  return NextResponse.json({ message: `${leads.length} SLA-alert(s) verstuurd` })
}
