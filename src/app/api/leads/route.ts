import { supabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN', 'SETTER'])
  if (denied) return denied

  const body = await req.json()
  const { error, data } = await supabase.from('leads').insert(body).select().single()
  if (error) return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN', 'SETTER'])
  if (denied) return denied

  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase.from('leads').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 })
  return NextResponse.json({ success: true })
}
