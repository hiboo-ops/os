import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN'])
  if (denied) return denied

  const { data } = await supabase
    .from('attribution_links')
    .select('*, creators(name)')
    .order('created_at', { ascending: false })
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN'])
  if (denied) return denied

  const body = await req.json()
  const { error, data } = await getSupabaseAdmin()
    .from('attribution_links')
    .insert({
      creator_id: body.creator_id,
      platform: body.platform || null,
      slug: body.slug,
      url: body.url || null,
      source: body.source || null,
    })
    .select('*, creators(name)')
    .single()
  if (error) return NextResponse.json({ error: 'Failed to create attribution link' }, { status: 500 })
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
    .from('attribution_links')
    .update(updates)
    .eq('id', id)
  if (error) return NextResponse.json({ error: 'Failed to update attribution link' }, { status: 500 })
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
    .from('attribution_links')
    .delete()
    .eq('id', id)
  if (error) return NextResponse.json({ error: 'Failed to delete attribution link' }, { status: 500 })
  return NextResponse.json({ success: true })
}
