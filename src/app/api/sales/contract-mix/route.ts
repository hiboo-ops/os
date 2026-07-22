import { NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

// Per contract: call_id + aantal termijnen (voor PIF vs Split op de closing overview).
// Client koppelt op call_id aan de (al closer-gescoopte) gefilterde calls.
export async function GET() {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN', 'CLOSER', 'SETTER'])
  if (denied) return denied

  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('contracts')
    .select('call_id, incoming_payments(count)')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (data || []).map((r: unknown) => {
    const row = r as { call_id: string | null; incoming_payments?: { count: number }[] }
    return { call_id: row.call_id, count: row.incoming_payments?.[0]?.count ?? 0 }
  })
  return NextResponse.json(rows)
}
