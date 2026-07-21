import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireAuth, requireRole } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  const user = await getAuthUser()
  const denied = requireAuth(user)
  if (denied) return denied

  const { data } = await supabase
    .from('sources')
    .select('*')
    .order('name')
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN'])
  if (denied) return denied

  const body = await req.json()
  const { error, data } = await getSupabaseAdmin()
    .from('sources')
    .insert({ name: body.name })
    .select()
    .single()
  if (error) return NextResponse.json({ error: 'Failed to create source' }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN'])
  if (denied) return denied

  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await getSupabaseAdmin()
    .from('sources')
    .update(updates)
    .eq('id', id)
  if (error) return NextResponse.json({ error: 'Failed to update source' }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN'])
  if (denied) return denied

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await getSupabaseAdmin()
    .from('sources')
    .update({ active: false })
    .eq('id', id)
  if (error) return NextResponse.json({ error: 'Failed to delete source' }, { status: 500 })
  return NextResponse.json({ success: true })
}
