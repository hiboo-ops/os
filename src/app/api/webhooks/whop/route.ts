import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { updateAccountLtv } from '@/lib/queries/accounts'

/**
 * Whop webhook.
 * Gated op WHOP_WEBHOOK_SECRET — retourneert 501 als niet geconfigureerd.
 * Verifieert de signature volgens de Standard Webhooks-spec (headers
 * webhook-id/webhook-timestamp/webhook-signature) en matcht op
 * metadata.incoming_payment_id.
 */

// Verifieer de Standard-Webhooks-handtekening: HMAC-SHA256 over "{id}.{ts}.{body}".
function verifyWhopSignature(
  secret: string,
  id: string | null,
  timestamp: string | null,
  body: string,
  signatureHeader: string | null,
): boolean {
  if (!id || !timestamp || !signatureHeader) return false
  const secretBytes = Buffer.from(secret.startsWith('whsec_') ? secret.slice(6) : secret, 'base64')
  const signedContent = `${id}.${timestamp}.${body}`
  const expected = crypto.createHmac('sha256', secretBytes).update(signedContent).digest('base64')
  // Header kan meerdere space-gescheiden "v1,<sig>"-waarden bevatten.
  const sigs = signatureHeader.split(' ').map(s => s.includes(',') ? s.split(',')[1] : s).filter(Boolean)
  return sigs.some(sig => {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    return a.length === b.length && crypto.timingSafeEqual(a, b)
  })
}

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

  // Signature-verificatie (Standard Webhooks)
  const valid = verifyWhopSignature(
    webhookSecret,
    req.headers.get('webhook-id'),
    req.headers.get('webhook-timestamp'),
    body,
    req.headers.get('webhook-signature'),
  )
  if (!valid) {
    return NextResponse.json({ error: 'Ongeldige signature' }, { status: 401 })
  }

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
