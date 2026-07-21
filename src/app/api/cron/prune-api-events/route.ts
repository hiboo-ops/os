import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { logApiEvent } from '@/lib/api-log'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const start = Date.now()
  const supabase = getSupabaseAdmin()

  try {
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()

    // Verwijder SUCCESS ouder dan 30 dagen
    const { count: successDeleted } = await supabase
      .from('api_events')
      .delete({ count: 'exact' })
      .eq('status', 'SUCCESS')
      .lt('created_at', thirtyDaysAgo)

    // Verwijder FAILED ouder dan 90 dagen
    const { count: failedDeleted } = await supabase
      .from('api_events')
      .delete({ count: 'exact' })
      .eq('status', 'FAILED')
      .lt('created_at', ninetyDaysAgo)

    const duration_ms = Date.now() - start

    await logApiEvent({
      direction: 'CRON',
      source: 'internal',
      action: 'prune-api-events',
      status: 'SUCCESS',
      duration_ms,
      payload: {
        success_deleted: successDeleted || 0,
        failed_deleted: failedDeleted || 0,
      },
    })

    return NextResponse.json({
      message: `Opgeschoond: ${successDeleted || 0} SUCCESS (>30d), ${failedDeleted || 0} FAILED (>90d)`,
      duration_ms,
    })
  } catch (err) {
    await logApiEvent({
      direction: 'CRON',
      source: 'internal',
      action: 'prune-api-events',
      status: 'FAILED',
      duration_ms: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    })

    return NextResponse.json({ error: 'Prune mislukt' }, { status: 500 })
  }
}
