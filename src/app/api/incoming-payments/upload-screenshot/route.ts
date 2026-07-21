import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

/**
 * Upload screenshot voor manuele overschrijving.
 * POST multipart/form-data met:
 *   - file: het screenshot-bestand
 *   - incoming_payment_id: de termijn die handmatig betaald is
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN', 'FINANCE'])
  if (denied) return denied

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const incomingPaymentId = formData.get('incoming_payment_id') as string | null

  if (!file || !incomingPaymentId) {
    return NextResponse.json(
      { error: 'file en incoming_payment_id zijn verplicht' },
      { status: 400 },
    )
  }

  const admin = getSupabaseAdmin()

  // Check of incoming_payment bestaat en nog niet betaald is
  const { data: ip } = await admin
    .from('incoming_payments')
    .select('id, status, account_id')
    .eq('id', incomingPaymentId)
    .single()

  if (!ip) {
    return NextResponse.json({ error: 'Termijn niet gevonden' }, { status: 404 })
  }
  if (ip.status === 'PAID') {
    return NextResponse.json({ error: 'Termijn is al betaald' }, { status: 409 })
  }

  // Upload naar Supabase Storage
  const ext = file.name.split('.').pop() || 'png'
  const path = `${ip.account_id}/${incomingPaymentId}.${ext}`
  const arrayBuffer = await file.arrayBuffer()

  const { error: uploadErr } = await admin.storage
    .from('payment-screenshots')
    .upload(path, arrayBuffer, {
      contentType: file.type || 'image/png',
      upsert: true,
    })

  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 })
  }

  // Genereer signed URL (7 dagen geldig)
  const { data: urlData } = await admin.storage
    .from('payment-screenshots')
    .createSignedUrl(path, 60 * 60 * 24 * 7)

  const screenshotUrl = urlData?.signedUrl || path

  // Update incoming_payment: markeer als manueel, screenshot + PENDING verificatie
  const { error: updateErr } = await admin
    .from('incoming_payments')
    .update({
      is_manual: true,
      screenshot_url: screenshotUrl,
      verification_status: 'PENDING',
      updated_at: new Date().toISOString(),
    })
    .eq('id', incomingPaymentId)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    screenshot_url: screenshotUrl,
  })
}
