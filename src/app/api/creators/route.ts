import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

const EDITABLE_FIELDS = [
  'name', 'last_name', 'email', 'phone', 'socials', 'status', 'calendly_link',
  'quiz_utm', 'quiz_clicks', 'cac', 'setup_fee', 'start_date', 'birth_date',
  'kvk', 'company_name', 'contract_status', 'contract_signed_date',
  'contract_end_date', 'contract_url',
] as const

export async function PATCH(req: NextRequest) {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN'])
  if (denied) return denied

  const body = await req.json()
  const { id, ...rest } = body

  if (!id) {
    return NextResponse.json({ error: 'id is verplicht' }, { status: 400 })
  }

  // Alleen toegestane velden doorlaten
  const updates: Record<string, unknown> = {}
  for (const key of EDITABLE_FIELDS) {
    if (key in rest) updates[key] = rest[key]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Geen geldige velden om bij te werken' }, { status: 400 })
  }

  const { error } = await getSupabaseAdmin().from('creators').update(updates).eq('id', id)
  if (error) {
    return NextResponse.json({ error: 'Bijwerken mislukt' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
