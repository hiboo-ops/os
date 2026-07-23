import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { updateAccountLtv } from '@/lib/queries/accounts'
import { calculateCommissionsForPayment } from '@/lib/queries/commissions'

/**
 * Verificatie-acties voor manuele overschrijvingen.
 * POST { incoming_payment_id, action: 'VERIFIED' | 'REJECTED' }
 *
 * VERIFIED → maakt payments-rij aan, status=PAID
 * REJECTED → status terug naar SCHEDULED, screenshot_url gewist
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN', 'FINANCE'])
  if (denied) return denied

  const body = await req.json()
  const { incoming_payment_id, action } = body

  if (!incoming_payment_id || !action) {
    return NextResponse.json(
      { error: 'incoming_payment_id en action zijn verplicht' },
      { status: 400 },
    )
  }

  if (action !== 'VERIFIED' && action !== 'REJECTED') {
    return NextResponse.json(
      { error: 'action moet VERIFIED of REJECTED zijn' },
      { status: 400 },
    )
  }

  const admin = getSupabaseAdmin()

  // Haal incoming_payment op
  const { data: ip } = await admin
    .from('incoming_payments')
    .select('*')
    .eq('id', incoming_payment_id)
    .single()

  if (!ip) {
    return NextResponse.json({ error: 'Termijn niet gevonden' }, { status: 404 })
  }

  if (ip.verification_status !== 'PENDING') {
    return NextResponse.json(
      { error: 'Alleen PENDING-termijnen kunnen geverifieerd worden' },
      { status: 409 },
    )
  }

  const now = new Date().toISOString()

  if (action === 'VERIFIED') {
    // Maak payments-rij (idempotent check)
    if (!ip.payment_id) {
      const { data: payment, error: payErr } = await admin
        .from('payments')
        .insert({
          account_id: ip.account_id,
          incoming_payment_id: ip.id,
          payment_number: ip.installment_number,
          amount: ip.amount,
          due_date: ip.due_date,
          paid: true,
          paid_date: now.split('T')[0],
          status: 'PAID',
          provider: 'BANK TRANSFER',
        })
        .select()
        .single()

      if (payErr) {
        return NextResponse.json({ error: payErr.message }, { status: 500 })
      }

      // Update incoming_payment → PAID + verified
      await admin
        .from('incoming_payments')
        .update({
          status: 'PAID',
          payment_id: payment.id,
          verification_status: 'VERIFIED',
          verified_by: user!.teamMemberId,
          updated_at: now,
        })
        .eq('id', incoming_payment_id)

      // Herbereken LTV
      await updateAccountLtv(ip.account_id)

      // Auto-calculate commissions (fire-and-forget)
      calculateCommissionsForPayment(payment.id, ip.account_id).catch(() => {})

      return NextResponse.json({
        success: true,
        action: 'VERIFIED',
        payment_id: payment.id,
      })
    }

    // Al een payment_id — update alleen status
    await admin
      .from('incoming_payments')
      .update({
        status: 'PAID',
        verification_status: 'VERIFIED',
        verified_by: user!.teamMemberId,
        updated_at: now,
      })
      .eq('id', incoming_payment_id)

    return NextResponse.json({ success: true, action: 'VERIFIED' })
  }

  // REJECTED: terug naar open
  await admin
    .from('incoming_payments')
    .update({
      status: 'SCHEDULED',
      is_manual: false,
      screenshot_url: null,
      verification_status: 'REJECTED',
      verified_by: user!.teamMemberId,
      updated_at: now,
    })
    .eq('id', incoming_payment_id)

  return NextResponse.json({ success: true, action: 'REJECTED' })
}
