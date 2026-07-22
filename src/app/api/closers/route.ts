import { NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

// Lijst met closers voor dropdowns (server-side; anon-grant op closers is onbetrouwbaar).
export async function GET() {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN', 'CLOSER', 'SETTER', 'FINANCE'])
  if (denied) return denied

  const admin = getSupabaseAdmin()
  const { data, error } = await admin.from('closers').select('id, name').order('name')
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data || [])
}
