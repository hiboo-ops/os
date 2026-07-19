import { supabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/auth'

export async function GET() {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('calendly_events')
    .select('*')
    .eq('active', true)
    .order('name')
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN'])
  if (denied) return denied

  const body = await req.json()
  const { error, data } = await supabase.from('calendly_events').insert({
    name: body.name,
    url: body.url,
    description: body.description || null,
    default_source: body.default_source || null,
    search_leads_first: body.search_leads_first ?? true,
  }).select().single()
  if (error) return NextResponse.json({ error: 'Failed to create event' }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN'])
  if (denied) return denied

  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabase.from('calendly_events').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: 'Failed to update event' }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN'])
  if (denied) return denied

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabase.from('calendly_events').update({ active: false }).eq('id', id)
  if (error) return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 })
  return NextResponse.json({ success: true })
}
