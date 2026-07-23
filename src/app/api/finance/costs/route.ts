import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/auth'
import { getCosts } from '@/lib/queries/commissions'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN', 'FINANCE'])
  if (denied) return denied

  try {
    const costs = await getCosts()
    return NextResponse.json({ costs })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN', 'FINANCE'])
  if (denied) return denied

  const body = await req.json()
  const { title, amount, category, date, notes } = body

  if (!title || amount == null || !category || !date) {
    return NextResponse.json(
      { error: 'title, amount, category en date zijn verplicht' },
      { status: 400 },
    )
  }

  const admin = getSupabaseAdmin()

  const { data, error } = await admin
    .from('costs')
    .insert({ title, amount, category, date, notes: notes || null })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ cost: data }, { status: 201 })
}
