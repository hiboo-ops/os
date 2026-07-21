import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/auth'
import { getAccountsList, createAccount, findAccountByEmail } from '@/lib/queries/accounts'

export async function GET(req: NextRequest) {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN', 'FINANCE'])
  if (denied) return denied

  const { searchParams } = req.nextUrl
  const page = Number(searchParams.get('page') || '1')
  const pageSize = Number(searchParams.get('pageSize') || '50')
  const search = searchParams.get('search') || undefined
  const status = searchParams.get('status') || undefined

  try {
    const result = await getAccountsList({ page, pageSize, search, status })
    return NextResponse.json(result)
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
  const { name, email, phone, source, creator_id, setter_id, closer_id, coach_id, lead_id, call_id, client_id } = body

  if (!name) {
    return NextResponse.json({ error: 'name is verplicht' }, { status: 400 })
  }

  // Dedup: check of account met dit email al bestaat
  if (email) {
    const existing = await findAccountByEmail(email)
    if (existing) {
      return NextResponse.json(
        { error: 'Account met dit e-mailadres bestaat al', existing },
        { status: 409 },
      )
    }
  }

  try {
    const account = await createAccount({
      name,
      email,
      phone,
      source,
      creator_id,
      setter_id,
      closer_id,
      coach_id,
      lead_id,
      call_id,
      client_id,
    })
    return NextResponse.json(account, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
