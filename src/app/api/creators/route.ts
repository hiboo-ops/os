import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

const ROLES = ['ADMIN', 'PARTNER_MANAGER'] as const

const EDITABLE_FIELDS = [
  'name', 'last_name', 'email', 'phone', 'socials', 'status', 'calendly_link',
  'quiz_utm', 'quiz_clicks', 'cac', 'setup_fee', 'start_date', 'birth_date',
  'kvk', 'company_name', 'contract_status', 'contract_signed_date',
  'contract_end_date', 'contract_url',
] as const

const CREATE_FIELDS = ['name', 'last_name', 'email', 'phone', 'company_name', 'status'] as const

// GET: lijst met creators (voor dropdowns + overzicht).
export async function GET() {
  const user = await getAuthUser()
  const denied = requireRole(user, [...ROLES])
  if (denied) return denied

  const { data, error } = await getSupabaseAdmin()
    .from('creators')
    .select('id, name, status')
    .order('name')
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data || [])
}

// POST: nieuwe partner/creator aanmaken.
export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  const denied = requireRole(user, [...ROLES])
  if (denied) return denied

  const body = await req.json()
  if (!body.name || !String(body.name).trim()) {
    return NextResponse.json({ error: 'Naam is verplicht' }, { status: 400 })
  }

  const insert: Record<string, unknown> = { status: 'ACTIVE' }
  for (const key of CREATE_FIELDS) {
    if (key in body && body[key] !== '') insert[key] = body[key]
  }

  const { data, error } = await getSupabaseAdmin()
    .from('creators')
    .insert(insert)
    .select('id, name, status')
    .single()
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}

// PATCH: bestaande creator bijwerken.
export async function PATCH(req: NextRequest) {
  const user = await getAuthUser()
  const denied = requireRole(user, [...ROLES])
  if (denied) return denied

  const body = await req.json()
  const { id, ...rest } = body

  if (!id) {
    return NextResponse.json({ error: 'id is verplicht' }, { status: 400 })
  }

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

// DELETE: creator verwijderen (?id=...). Ontkoppelt eerst attributie + Calendly-defaults
// zodat FK-verwijzingen de verwijdering niet blokkeren.
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser()
  const denied = requireRole(user, [...ROLES])
  if (denied) return denied

  const id = req.nextUrl.searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'id is verplicht' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()
  // Losse verwijzingen ontkoppelen (best-effort; negeer als tabel/kolom ontbreekt)
  await admin.from('attribution_links').update({ creator_id: null }).eq('creator_id', id)
  await admin.from('calendly_events').update({ default_creator_id: null }).eq('default_creator_id', id)
  await admin.from('leads').update({ creator_id: null }).eq('creator_id', id)
  await admin.from('clients').update({ creator_id: null }).eq('creator_id', id)

  const { error } = await admin.from('creators').delete().eq('id', id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
