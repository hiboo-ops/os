import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import crypto from 'crypto'

/**
 * esignatures.io webhook.
 * Verifieer X-Signature-SHA256 (HMAC-SHA256 met secret token).
 * Op contract-signed → update contract status + pdf_url.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.ESIGNATURES_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: 'esignatures webhook niet geconfigureerd' },
      { status: 501 },
    )
  }

  const body = await req.text()
  const admin = getSupabaseAdmin()

  // Log webhook
  try {
    await admin.from('webhook_logs').insert({
      source: 'esignatures',
      event: 'raw',
      payload: { body: body.slice(0, 5000) },
    })
  } catch { /* logging mag niet falen */ }

  // Verifieer HMAC signature
  const signature = req.headers.get('X-Signature-SHA256') || req.headers.get('x-signature-sha256')
  if (!signature) {
    return NextResponse.json({ error: 'Geen signature header' }, { status: 401 })
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex')

  const sigBuf = Buffer.from(signature)
  const expBuf = Buffer.from(expectedSignature)
  // timingSafeEqual gooit bij ongelijke lengte — vang dat af als een nette 401
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return NextResponse.json({ error: 'Ongeldige signature' }, { status: 401 })
  }

  let event: {
    status: string
    data: {
      contract: {
        id: string
        status: string
        contract_pdf_url?: string
      }
    }
  }

  try {
    event = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Verwerk contract-signed
  if (event.status === 'contract-signed') {
    const esignContractId = event.data.contract.id
    const pdfUrl = event.data.contract.contract_pdf_url || null

    const { data: contract } = await admin
      .from('contracts')
      .select('id')
      .eq('esign_contract_id', esignContractId)
      .maybeSingle()

    if (!contract) {
      return NextResponse.json({ received: true, matched: false })
    }

    await admin
      .from('contracts')
      .update({
        esign_status: 'SIGNED',
        contract_signed: true,
        contract_pdf_url: pdfUrl,
      })
      .eq('id', contract.id)

    return NextResponse.json({ received: true, matched: true, contract_id: contract.id })
  }

  return NextResponse.json({ received: true })
}
