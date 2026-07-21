import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { updateAccountLtv } from '@/lib/queries/accounts'

export async function GET(req: NextRequest) {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN', 'FINANCE'])
  if (denied) return denied

  const admin = getSupabaseAdmin()
  const { searchParams } = req.nextUrl
  const accountId = searchParams.get('account_id')
  const status = searchParams.get('status')

  let query = admin
    .from('incoming_payments')
    .select(`
      *,
      account:accounts(id, name, email)
    `)
    .order('due_date', { ascending: true })

  if (accountId) query = query.eq('account_id', accountId)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN', 'FINANCE'])
  if (denied) return denied

  const body = await req.json()
  const { account_id, contract_id, installment_number, amount, due_date, stripe_link, whop_link } = body

  if (!account_id || amount == null) {
    return NextResponse.json({ error: 'account_id en amount zijn verplicht' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  const { data, error } = await admin
    .from('incoming_payments')
    .insert({
      account_id,
      contract_id: contract_id || null,
      installment_number: installment_number || 1,
      amount,
      due_date: due_date || null,
      stripe_link: stripe_link || null,
      whop_link: whop_link || null,
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
  const denied = requireRole(user, ['ADMIN', 'FINANCE'])
  if (denied) return denied

  const body = await req.json()
  const { id, ...updates } = body

  if (!id) {
    return NextResponse.json({ error: 'id is verplicht' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  const allowed = [
    'status', 'amount', 'due_date', 'stripe_link', 'whop_link',
    'is_manual', 'screenshot_url', 'verification_status', 'verified_by',
  ]
  const safeUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in updates) safeUpdates[key] = updates[key]
  }

  // Markeer als PAID: maak payments-rij aan (idempotent)
  if (safeUpdates.status === 'PAID') {
    // Haal incoming_payment op voor context
    const { data: ip } = await admin
      .from('incoming_payments')
      .select('*')
      .eq('id', id)
      .single()

    if (!ip) {
      return NextResponse.json({ error: 'Incoming payment niet gevonden' }, { status: 404 })
    }

    // Idempotent: als er al een payment_id is, skip
    if (!ip.payment_id) {
      // Maak payments-rij aan
      const { data: payment, error: payErr } = await admin
        .from('payments')
        .insert({
          client_id: null, // geen legacy client koppeling
          account_id: ip.account_id,
          incoming_payment_id: id,
          payment_number: ip.installment_number,
          amount: ip.amount,
          due_date: ip.due_date,
          paid: true,
          paid_date: new Date().toISOString().split('T')[0],
          status: 'PAID',
          provider: ip.is_manual ? 'BANK TRANSFER' : null,
        })
        .select()
        .single()

      if (payErr) {
        return NextResponse.json({ error: payErr.message }, { status: 500 })
      }

      safeUpdates.payment_id = payment.id
    }
  }

  const { error } = await admin
    .from('incoming_payments')
    .update(safeUpdates)
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Herbereken LTV als status → PAID
  if (safeUpdates.status === 'PAID') {
    const { data: ip } = await admin
      .from('incoming_payments')
      .select('account_id')
      .eq('id', id)
      .single()
    if (ip) await updateAccountLtv(ip.account_id)
  }

  return NextResponse.json({ success: true })
}
