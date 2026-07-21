import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sendToPurpose } from '@/lib/slack'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const today = new Date().toISOString().split('T')[0]

  const { data: reports, error } = await supabase
    .from('eod_reports')
    .select('role_type, submitted_name, answers')
    .eq('report_date', today)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!reports || reports.length === 0) {
    await sendToPurpose('eod', `EOD Samenvatting ${today}: geen rapporten ingediend.`)
    return NextResponse.json({ message: 'Geen rapporten, melding verstuurd' })
  }

  // Groepeer per role_type
  const perRole: Record<string, typeof reports> = {}
  for (const r of reports) {
    const role = r.role_type || 'Onbekend'
    if (!perRole[role]) perRole[role] = []
    perRole[role].push(r)
  }

  const blocks: Record<string, unknown>[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `EOD Samenvatting — ${today}` },
    },
  ]

  for (const [role, items] of Object.entries(perRole)) {
    const namen = items.map((i) => i.submitted_name || 'Anoniem').join(', ')
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${role}* (${items.length} rapport${items.length === 1 ? '' : 'en'})\nIngediend door: ${namen}`,
      },
    })

    // Toon samenvatting van answers per rapport
    for (const item of items) {
      const answers = item.answers as Record<string, unknown> | null
      if (answers && typeof answers === 'object') {
        const lines = Object.entries(answers)
          .map(([k, v]) => `  _${k}:_ ${v}`)
          .slice(0, 10)
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${item.submitted_name || 'Anoniem'}*\n${lines.join('\n')}`,
          },
        })
      }
    }

    blocks.push({ type: 'divider' })
  }

  await sendToPurpose(
    'eod',
    `EOD Samenvatting ${today} — ${reports.length} rapport(en)`,
    blocks
  )

  return NextResponse.json({ message: `Samenvatting verstuurd (${reports.length} rapporten)` })
}
