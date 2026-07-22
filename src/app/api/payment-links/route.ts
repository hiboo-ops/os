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
  const { call_id, amount, provider, is_deposit, manual_url } = body as {
    call_id: string
    amount: number
    provider: PayProvider
    is_deposit?: boolean
    manual_url?: string
  }

  if (!call_id || !amount || amount <= 0) {
    return NextResponse.json(
      { error: 'call_id en amount (> 0) zijn verplicht' },
      { status: 400 },
    )
  }

  if (!provider || !['WHOP', 'MANUAL'].includes(provider)) {
    return NextResponse.json(
      { error: 'provider moet WHOP of MANUAL zijn' },
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

  // 3. Bepaal de link: MANUAL = geplakte url; WHOP = genereer via API (gated).
  let url: string | null = null
  let resolvedProvider: string = provider
  if (provider === 'MANUAL') {
    url = manual_url?.trim() || null
  } else {
    const linkResult = await generatePayLink(provider, ip.id, ip.pay_token, amount, call.email)
    url = linkResult.url
    resolvedProvider = linkResult.provider
  }

  // 4. Sla de link op de incoming_payment op (in whop_link, ons weergaveveld)
  if (url) {
    await admin
      .from('incoming_payments')
      .update({ whop_link: url, updated_at: new Date().toISOString() })
      .eq('id', ip.id)
  }

  return NextResponse.json({
    account_id: account.id,
    incoming_payment_id: ip.id,
    pay_token: ip.pay_token,
    provider: resolvedProvider,
    url,
    is_deposit: !!is_deposit,
  }, { status: 201 })
}

/**
 * PATCH /api/payment-links
 * Betaallink op een bestaande incoming_payment zetten:
 *  - { incoming_payment_id, url }      → handmatige link plakken/overschrijven
 *  - { incoming_payment_id, generate } → automatisch Whop-link genereren (gated)
 * Closer-toegankelijk, alleen het link-veld.
 */
export async function PATCH(req: NextRequest) {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN', 'CLOSER', 'FINANCE'])
  if (denied) return denied

  const { incoming_payment_id, url, generate, amount } = await req.json() as {
    incoming_payment_id?: string
    url?: string
    generate?: boolean
    amount?: number
  }

  if (!incoming_payment_id) {
    return NextResponse.json({ error: 'incoming_payment_id is verplicht' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  // Optioneel het bedrag bijwerken (bijv. deposit-bedrag aangepast vóór genereren).
  if (amount != null && Number(amount) > 0) {
    await admin
      .from('incoming_payments')
      .update({ amount: Number(amount), updated_at: new Date().toISOString() })
      .eq('id', incoming_payment_id)
  }

  let newUrl: string | null = url?.trim() || null
  let provider = 'MANUAL'

  if (generate) {
    const { data: ip } = await admin
      .from('incoming_payments')
      .select('id, amount, pay_token')
      .eq('id', incoming_payment_id)
      .single()
    if (!ip) {
      return NextResponse.json({ error: 'Termijn niet gevonden' }, { status: 404 })
    }
    const result = await generatePayLink('WHOP', ip.id, ip.pay_token, Number(ip.amount))
    newUrl = result.url
    provider = result.provider
    if (!newUrl) {
      return NextResponse.json(
        { error: 'Whop-link kon niet worden gegenereerd (keys ontbreken of API-fout)', provider },
        { status: 502 },
      )
    }
  }

  const { error } = await admin
    .from('incoming_payments')
    .update({ whop_link: newUrl, updated_at: new Date().toISOString() })
    .eq('id', incoming_payment_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, url: newUrl, provider })
}
