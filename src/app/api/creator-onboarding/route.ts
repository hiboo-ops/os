import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

// POST: publieke inzending van het partner-onboardingformulier (GEEN auth).
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ongeldige invoer' }, { status: 400 })
  }

  const answers = (body.answers && typeof body.answers === 'object') ? body.answers as Record<string, unknown> : {}
  const person = (answers.person || {}) as Record<string, unknown>

  const first_name = String((body.first_name ?? person.first_name) || '').trim()
  const email = String((body.email ?? person.email) || '').trim()

  if (!first_name || !email) {
    return NextResponse.json({ error: 'Voornaam en e-mailadres zijn verplicht' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()
  const { error } = await admin.from('creator_onboarding').insert({
    status: 'NEW',
    first_name,
    last_name: String((body.last_name ?? person.last_name) || '').trim() || null,
    email,
    phone: String((body.phone ?? person.phone) || '').trim() || null,
    answers,
    signature: body.signature ? String(body.signature) : null,
    signed_date: body.signed_date ? String(body.signed_date) : null,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true }, { status: 201 })
}

// GET: inzendingen bekijken (ADMIN/PARTNER_MANAGER).
export async function GET() {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN', 'PARTNER_MANAGER'])
  if (denied) return denied

  const { data, error } = await getSupabaseAdmin()
    .from('creator_onboarding')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data || [])
}

// PATCH: status bijwerken / koppelen aan creator (ADMIN/PARTNER_MANAGER).
export async function PATCH(req: NextRequest) {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN', 'PARTNER_MANAGER'])
  if (denied) return denied

  const { id, status, creator_id } = await req.json() as { id?: string; status?: string; creator_id?: string }
  if (!id) return NextResponse.json({ error: 'id is verplicht' }, { status: 400 })

  const updates: Record<string, unknown> = {}
  if (status) updates.status = status
  if (creator_id !== undefined) updates.creator_id = creator_id || null
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Niets om bij te werken' }, { status: 400 })
  }

  const { error } = await getSupabaseAdmin().from('creator_onboarding').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
