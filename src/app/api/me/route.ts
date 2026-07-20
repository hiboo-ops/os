import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('team_members')
    .select('call_mode, mobile_phone')
    .eq('id', user.teamMemberId)
    .single()

  return NextResponse.json({
    name: user.name,
    email: user.email,
    role: user.role,
    teamMemberId: user.teamMemberId,
    call_mode: member?.call_mode || 'browser',
    mobile_phone: member?.mobile_phone || null,
  })
}

export async function PATCH(req: Request) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const updates: Record<string, unknown> = {}
  if (body.call_mode === 'browser' || body.call_mode === 'mobile') updates.call_mode = body.call_mode
  if ('mobile_phone' in body) updates.mobile_phone = body.mobile_phone || null

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { error } = await supabase
    .from('team_members')
    .update(updates)
    .eq('id', user.teamMemberId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
