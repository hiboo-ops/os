import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { updateAccountLtv } from '@/lib/queries/accounts'

/**
 * Whop webhook skeleton.
 * Gated op WHOP_WEBHOOK_SECRET — retourneert 501 als niet geconfigureerd.
 * Matching-logica op metadata.incoming_payment_id is nu al gebouwd;
 * de echte Whop SDK-integratie (signature verificatie, event parsing)
 * komt via de Integrations-tab (andere terminal).
 */
export async function POST(req: NextRequest) {
  const webhookSecret = process.env.WHOP_WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json(
      { error: 'Whop webhook niet geconfigureerd' },
      { status: 501 },
    )
  }

  const body = await req.text()
  const admin = getSupabaseAdmin()

  // Log het webhook-event
  await admin.from('webhook_logs').insert({
    source: 'whop',
    event: 'raw',
    payload: { body: body.slice(0, 5000) },
  })

  // TODO: Whop signature verificatie met webhookSecret

  let event: { action: string; data: Record<string, unknown> }
  try {
    event = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Verwerk payment.succeeded
  if (event.action === 'payment.succeeded') {
    const metadata = (event.data.metadata || {}) as Record<string, string>
    const incomingPaymentId = metadata.incoming_payment_id

    if (!incomingPaymentId) {
      return NextResponse.json({ received: true, matched: false })
    }

    // Haal incoming_payment op
    const { data: ip } = await admin
      .from('incoming_payments')
      .select('*')
      .eq('id', incomingPaymentId)
      .single()

    if (!ip) {
      return NextResponse.json({ error: 'incoming_payment niet gevonden' }, { status: 404 })
    }

    // Idempotent: als al PAID, skip
    if (ip.status === 'PAID' && ip.payment_id) {
      return NextResponse.json({ received: true, already_paid: true })
    }

    // Maak payments-rij
    const { data: payment, error: payErr } = await admin
      .from('payments')
      .insert({
        account_id: ip.account_id,
        incoming_payment_id: ip.id,
        payment_number: ip.installment_number,
        amount: ip.amount,
        due_date: ip.due_date,
        paid: true,
        paid_date: new Date().toISOString().split('T')[0],
        status: 'PAID',
        provider: 'WHOP',
        provider_reference: String(event.data.id || ''),
      })
      .select()
      .single()

    if (payErr) {
      return NextResponse.json({ error: payErr.message }, { status: 500 })
    }

    // Update incoming_payment
    await admin
      .from('incoming_payments')
      .update({
        status: 'PAID',
        payment_id: payment.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', incomingPaymentId)

    // Herbereken LTV
    await updateAccountLtv(ip.account_id)

    return NextResponse.json({ received: true, matched: true, payment_id: payment.id })
  }

  return NextResponse.json({ received: true })
}
