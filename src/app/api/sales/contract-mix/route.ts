import { NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

// Per contract: call_id + termijn-count + deal_value (PIF/Split + order value).
// Plus cashByCall: echte betaalde bedragen per call via payments→accounts→call.
// Client koppelt op call_id aan de (al closer-gescoopte) gefilterde calls.
export async function GET() {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN', 'CLOSER', 'SETTER'])
  if (denied) return denied

  const admin = getSupabaseAdmin()

  const [contractsRes, accountsRes, paymentsRes] = await Promise.all([
    admin
      .from('contracts')
      .select('call_id, deal_value, incoming_payments(count)'),
    admin
      .from('accounts')
      .select('id, call_id')
      .eq('is_legacy', false),
    admin
      .from('payments')
      .select('account_id, amount')
      .eq('paid', true)
      .eq('legacy', false),
  ])

  if (contractsRes.error) {
    return NextResponse.json({ error: contractsRes.error.message }, { status: 500 })
  }

  // Contracts: per-contract rows with count + deal_value
  const contracts = (contractsRes.data || []).map((r: unknown) => {
    const row = r as {
      call_id: string | null
      deal_value: number | null
      incoming_payments?: { count: number }[]
    }
    return {
      call_id: row.call_id,
      count: row.incoming_payments?.[0]?.count ?? 0,
      deal_value: row.deal_value ?? 0,
    }
  })

  // Build account_id → call_id map
  const accountToCall: Record<string, string> = {}
  for (const acc of (accountsRes.data || []) as { id: string; call_id: string | null }[]) {
    if (acc.call_id) accountToCall[acc.id] = acc.call_id
  }

  // Sum paid payments per call_id
  const cashByCall: Record<string, number> = {}
  for (const p of (paymentsRes.data || []) as { account_id: string | null; amount: number | null }[]) {
    if (!p.account_id || !p.amount) continue
    const callId = accountToCall[p.account_id]
    if (callId) {
      cashByCall[callId] = (cashByCall[callId] || 0) + p.amount
    }
  }

  return NextResponse.json({ contracts, cashByCall })
}
