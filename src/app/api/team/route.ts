import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN'])
  if (denied) return denied

  const { data } = await supabase
    .from('team_members')
    .select('*')
    .order('name')
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN'])
  if (denied) return denied

  const body = await req.json()
  const { name, email, password, role } = body

  if (!name || !email || !password || !role) {
    return NextResponse.json({ error: 'name, email, password en role zijn verplicht' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  // Create auth user
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError || !authData.user) {
    return NextResponse.json(
      { error: authError?.message || 'Aanmaken gebruiker mislukt' },
      { status: 500 },
    )
  }

  // Insert team member
  const { error: memberError, data: memberData } = await admin
    .from('team_members')
    .insert({
      user_id: authData.user.id,
      email,
      name,
      role,
    })
    .select()
    .single()

  if (memberError) {
    return NextResponse.json(
      { error: 'Gebruiker aangemaakt maar teamlid opslaan mislukt' },
      { status: 500 },
    )
  }

  return NextResponse.json(memberData)
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN'])
  if (denied) return denied

  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // Only allow specific fields
  const allowed = ['name', 'role', 'active', 'closer_id', 'setter_id', 'coach_id']
  const filtered: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in updates) filtered[key] = updates[key]
  }

  if (Object.keys(filtered).length === 0) {
    return NextResponse.json({ error: 'Geen geldige velden om bij te werken' }, { status: 400 })
  }

  const { error } = await getSupabaseAdmin()
    .from('team_members')
    .update(filtered)
    .eq('id', id)
  if (error) return NextResponse.json({ error: 'Bijwerken teamlid mislukt' }, { status: 500 })
  return NextResponse.json({ success: true })
}
