import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN'])
  if (denied) return denied

  const params = req.nextUrl.searchParams
  const source = params.get('source')
  const direction = params.get('direction')
  const status = params.get('status')
  const dateFrom = params.get('dateFrom')
  const dateTo = params.get('dateTo')
  const search = params.get('search')
  const cursor = params.get('cursor')
  const cursorId = params.get('cursorId')
  const limit = Math.min(Number(params.get('limit')) || 50, 100)
  const mode = params.get('mode')

  const supabase = getSupabaseAdmin()

  // ── KPI mode: return counts only (head:true) ──
  if (mode === 'kpis') {
    const now = new Date()
    const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
    const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const [total24, total7, failed24, success24] = await Promise.all([
      supabase.from('api_events').select('*', { count: 'exact', head: true }).gte('created_at', h24),
      supabase.from('api_events').select('*', { count: 'exact', head: true }).gte('created_at', d7),
      supabase.from('api_events').select('*', { count: 'exact', head: true }).gte('created_at', h24).eq('status', 'FAILED'),
      supabase.from('api_events').select('*', { count: 'exact', head: true }).gte('created_at', h24).eq('status', 'SUCCESS'),
    ])

    const t24 = total24.count || 0
    const s24 = success24.count || 0
    const rate = t24 > 0 ? Math.round((s24 / t24) * 100) : 100

    return NextResponse.json({
      total_24h: t24,
      total_7d: total7.count || 0,
      failed_24h: failed24.count || 0,
      success_rate: rate,
    })
  }

  // ── Paginated list with keyset pagination ──
  let query = supabase
    .from('api_events')
    .select('id, created_at, direction, source, action, event_type, status, http_status, duration_ms, retry_count, error')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1)

  if (source) query = query.eq('source', source)
  if (direction) query = query.eq('direction', direction)
  if (status) query = query.eq('status', status)
  if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00Z`)
  if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59Z`)
  if (search) query = query.or(`action.ilike.%${search}%,event_type.ilike.%${search}%,source.ilike.%${search}%,error.ilike.%${search}%`)

  if (cursor && cursorId) {
    query = query.or(`created_at.lt.${cursor},and(created_at.eq.${cursor},id.lt.${cursorId})`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = data || []
  const hasMore = rows.length > limit
  const items = hasMore ? rows.slice(0, limit) : rows

  return NextResponse.json({
    items,
    hasMore,
    nextCursor: hasMore && items.length > 0
      ? { cursor: items[items.length - 1].created_at, cursorId: items[items.length - 1].id }
      : null,
  })
}

// POST: get single event detail or retry
export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN'])
  if (denied) return denied

  const { id, retry } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const supabase = getSupabaseAdmin()

  if (retry) {
    const { data: evt } = await supabase.from('api_events').select('retry_count').eq('id', id).single()
    if (!evt) return NextResponse.json({ error: 'Event niet gevonden' }, { status: 404 })

    await supabase.from('api_events').update({
      retry_count: (evt.retry_count || 0) + 1,
      status: 'RETRYING',
      updated_at: new Date().toISOString(),
    }).eq('id', id)

    return NextResponse.json({ success: true })
  }

  const { data, error } = await supabase.from('api_events').select('*').eq('id', id).single()
  if (error || !data) return NextResponse.json({ error: 'Event niet gevonden' }, { status: 404 })
  return NextResponse.json(data)
}
