import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN', 'CLOSER'])
  if (denied) return denied

  const { id } = await ctx.params
  const admin = getSupabaseAdmin()

  try {
    const [leadResult, accountResult, contractResult] = await Promise.all([
      admin
        .from('leads')
        .select('id, quiz_answers, triage_notes')
        .eq('call_id', id)
        .maybeSingle(),
      admin
        .from('accounts')
        .select('id, status, ltv')
        .eq('call_id', id)
        .maybeSingle(),
      admin
        .from('contracts')
        .select('id, esign_status, contract_signed, contract_sent, contract_url, contract_pdf_url, deal_value, payment_plan')
        .eq('call_id', id)
        .order('created_at', { ascending: false })
        .maybeSingle(),
    ])

    let payments: unknown[] = []
    if (accountResult.data) {
      const { data } = await admin
        .from('incoming_payments')
        .select('*')
        .eq('account_id', accountResult.data.id)
        .order('due_date', { ascending: true })
      payments = data || []
    }

    return NextResponse.json({
      lead: leadResult.data || null,
      account: accountResult.data || null,
      payments,
      contract: contractResult.data || null,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
