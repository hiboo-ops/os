import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN'])
  if (denied) return denied

  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('packages')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN'])
  if (denied) return denied

  const body = await req.json()
  const { name, price, description, esign_template_id, active } = body as {
    name: string
    price: number
    description?: string
    esign_template_id?: string
    active?: boolean
  }

  if (!name || price == null) {
    return NextResponse.json({ error: 'Naam en prijs zijn verplicht' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('packages')
    .insert({
      name,
      price,
      description: description || null,
      esign_template_id: esign_template_id || null,
      active: active ?? true,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN'])
  if (denied) return denied

  const body = await req.json()
  const { id, ...updates } = body as {
    id: string
    name?: string
    price?: number
    description?: string
    esign_template_id?: string
    active?: boolean
  }

  if (!id) {
    return NextResponse.json({ error: 'id is verplicht' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('packages')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN'])
  if (denied) return denied

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id is verplicht' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()
  const { error } = await admin
    .from('packages')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
