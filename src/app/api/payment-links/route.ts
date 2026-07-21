import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { findAccountByEmail, createAccount, createIncomingPayment } from '@/lib/queries/accounts'
import { generatePayLink, type PayProvider } from '@/lib/pay-links'

/**
 * POST /api/payment-links
 * Maakt een first payment link aan voor een call.
 * Match/maak account op call-email → incoming_payment #1 + pay_token + link.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN', 'CLOSER', 'FINANCE'])
  if (denied) return denied

  const body = await req.json()
  const { call_id, amount, provider, is_deposit } = body as {
    call_id: string
    amount: number
    provider: PayProvider
    is_deposit?: boolean
  }

  if (!call_id || !amount || amount <= 0) {
    return NextResponse.json(
      { error: 'call_id en amount (> 0) zijn verplicht' },
      { status: 400 },
    )
  }

  if (!provider || !['STRIPE', 'WHOP', 'MANUAL'].includes(provider)) {
    return NextResponse.json(
      { error: 'provider moet STRIPE, WHOP of MANUAL zijn' },
      { status: 400 },
    )
  }

  const admin = getSupabaseAdmin()

  // Haal call op
  const { data: call } = await admin
    .from('calls')
    .select('*, closer:closers(id, name), setter:setters(id, name)')
    .eq('id', call_id)
    .single()

  if (!call) {
    return NextResponse.json({ error: 'Call niet gevonden' }, { status: 404 })
  }

  // 1. Account: match op email of maak nieuw
  let account = call.email ? await findAccountByEmail(call.email) : null

  if (!account) {
    // Zoek gekoppelde lead voor attributie
    const { data: lead } = await admin
      .from('leads')
      .select('id, creator_id, source')
      .eq('call_id', call_id)
      .maybeSingle()

    account = await createAccount({
      name: call.name || 'Onbekend',
      email: call.email,
      phone: call.phone,
      source: lead?.source || call.source || null,
      creator_id: lead?.creator_id || null,
      setter_id: call.setter_id || null,
      closer_id: call.closer_id || null,
      lead_id: lead?.id || null,
      call_id,
    })
  }

  // 2. Maak incoming_payment #1
  const ip = await createIncomingPayment({
    account_id: account.id,
    installment_number: 1,
    amount,
    due_date: new Date().toISOString().split('T')[0],
  })

  // 3. Genereer betaallink (gated op provider keys)
  const linkResult = await generatePayLink(
    provider,
    ip.id,
    ip.pay_token,
    amount,
    call.email,
  )

  // 4. Update incoming_payment met link indien beschikbaar
  if (linkResult.url) {
    const linkField = provider === 'STRIPE' ? 'stripe_link' : 'whop_link'
    await admin
      .from('incoming_payments')
      .update({ [linkField]: linkResult.url, updated_at: new Date().toISOString() })
      .eq('id', ip.id)
  }

  return NextResponse.json({
    account_id: account.id,
    incoming_payment_id: ip.id,
    pay_token: ip.pay_token,
    provider: linkResult.provider,
    url: linkResult.url,
    is_deposit: !!is_deposit,
  }, { status: 201 })
}
