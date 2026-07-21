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
    const today = new Date().toISOString().split('T')[0]

    const { data: reports, error } = await supabase
      .from('eod_reports')
      .select('role_type, submitted_name, answers')
      .eq('report_date', today)

    if (error) {
      logApiEvent({ direction: 'CRON', source: 'internal', action: 'eod-summary', status: 'FAILED', duration_ms: Date.now() - start, error: error.message })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!reports || reports.length === 0) {
      await sendToPurpose('eod', `EOD Samenvatting ${today}: geen rapporten ingediend.`)
      logApiEvent({ direction: 'CRON', source: 'internal', action: 'eod-summary', status: 'SUCCESS', duration_ms: Date.now() - start })
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

    logApiEvent({ direction: 'CRON', source: 'internal', action: 'eod-summary', status: 'SUCCESS', duration_ms: Date.now() - start })
    return NextResponse.json({ message: `Samenvatting verstuurd (${reports.length} rapporten)` })
  } catch (err) {
    logApiEvent({ direction: 'CRON', source: 'internal', action: 'eod-summary', status: 'FAILED', duration_ms: Date.now() - start, error: err instanceof Error ? err.message : String(err) })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
