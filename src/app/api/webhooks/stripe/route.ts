import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { updateAccountLtv } from '@/lib/queries/accounts'

/**
 * Stripe webhook skeleton.
 * Gated op STRIPE_WEBHOOK_SECRET — retourneert 501 als niet geconfigureerd.
 * Matching-logica op metadata.incoming_payment_id is nu al gebouwd;
 * de echte Stripe SDK-integratie (signature verificatie, event parsing)
 * komt via de Integrations-tab (andere terminal).
 */
export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json(
      { error: 'Stripe webhook niet geconfigureerd' },
      { status: 501 },
    )
  }

  const body = await req.text()
  const admin = getSupabaseAdmin()

  // Log het webhook-event
  await admin.from('webhook_logs').insert({
    source: 'stripe',
    event: 'raw',
    payload: { body: body.slice(0, 5000) },
  })

  // TODO: Stripe signature verificatie met webhookSecret
  // const sig = req.headers.get('stripe-signature')
  // const event = stripe.webhooks.constructEvent(body, sig, webhookSecret)

  let event: { type: string; data: { object: Record<string, unknown> } }
  try {
    event = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Verwerk checkout.session.completed of payment_intent.succeeded
  if (
    event.type === 'checkout.session.completed' ||
    event.type === 'payment_intent.succeeded'
  ) {
    const metadata = (event.data.object.metadata || {}) as Record<string, string>
    const incomingPaymentId = metadata.incoming_payment_id

    if (!incomingPaymentId) {
      // Geen incoming_payment_id in metadata — niet van ons systeem
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
        provider: 'STRIPE',
        provider_reference: String(event.data.object.id || ''),
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
