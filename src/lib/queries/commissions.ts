import { getSupabaseAdmin } from '@/lib/supabase-admin'

// ── TYPES ──

export interface CommissionRow {
  id: string
  paymentId: string
  teamMemberId: string | null
  teamMemberName: string | null
  role: string
  percentage: number
  amount: number
  status: string       // CALCULATED | PAID OUT | REVERSED
  date: string
  paidAt: string | null
  paidBy: string | null
}

export interface CommissionOverview {
  commissions: CommissionRow[]
  totalCalculated: number
  totalPaidOut: number
  totalOpen: number
}

export interface CostRow {
  id: string
  title: string
  amount: number
  category: string
  date: string
  notes: string | null
}

// Role mapping: account field → commission_role enum
const ROLE_FIELD_MAP: { role: string; accountField: string }[] = [
  { role: 'CLOSER', accountField: 'closer_id' },
  { role: 'SETTER', accountField: 'setter_id' },
  { role: 'AFFILIATE/CREATOR', accountField: 'creator_id' },
]

/**
 * Auto-calculate commissions for a payment.
 * Called after a payment is confirmed (Whop webhook or manual verification).
 * Idempotent: skips if commissions already exist for this payment_id + role.
 */
export async function calculateCommissionsForPayment(paymentId: string, accountId: string): Promise<void> {
  const admin = getSupabaseAdmin()

  // 1. Get commission rules
  const { data: rules } = await admin
    .from('commission_rules')
    .select('role, percentage')
    .eq('active', true)

  if (!rules || rules.length === 0) return

  // 2. Get account to find team member linkages
  const { data: account } = await admin
    .from('accounts')
    .select('closer_id, setter_id, creator_id')
    .eq('id', accountId)
    .single()

  if (!account) return

  // 3. Get payment amount
  const { data: payment } = await admin
    .from('payments')
    .select('amount')
    .eq('id', paymentId)
    .single()

  if (!payment) return
  const paymentAmount = (payment as { amount: number | null }).amount || 0

  // 4. Check existing commissions for idempotency
  const { data: existing } = await admin
    .from('commissions')
    .select('role')
    .eq('payment_id', paymentId)

  const existingRoles = new Set((existing || []).map((e: { role: string }) => e.role))

  // 5. Calculate and insert commissions
  const acc = account as unknown as Record<string, string | null>

  for (const rule of rules as { role: string; percentage: number }[]) {
    if (existingRoles.has(rule.role)) continue

    // Find the team member for this role
    const mapping = ROLE_FIELD_MAP.find(m => m.role === rule.role)
    let teamMemberId: string | null = null

    if (mapping) {
      const personId = acc[mapping.accountField]
      if (!personId) continue // No person assigned for this role

      // Look up team_member by closer_id / setter_id / creator_id
      const { data: tm } = await admin
        .from('team_members')
        .select('id')
        .eq(mapping.accountField, personId)
        .eq('active', true)
        .limit(1)
        .single()

      teamMemberId = tm ? (tm as { id: string }).id : null
    }
    // MANAGER and COACH/COMMUNITY don't have direct account linkage — skip for now

    if (!teamMemberId && (rule.role === 'CLOSER' || rule.role === 'SETTER' || rule.role === 'AFFILIATE/CREATOR')) continue

    const commissionAmount = Math.round(paymentAmount * (rule.percentage / 100) * 100) / 100

    await admin.from('commissions').insert({
      payment_id: paymentId,
      team_member_id: teamMemberId,
      role: rule.role,
      percentage: rule.percentage,
      amount: commissionAmount,
      status: 'CALCULATED',
      date: new Date().toISOString().split('T')[0],
    })
  }
}

/**
 * Get all commissions grouped for the finance overview.
 */
export async function getCommissionOverview(): Promise<CommissionOverview> {
  const admin = getSupabaseAdmin()

  const { data: rows } = await admin
    .from('commissions')
    .select('id, payment_id, team_member_id, role, percentage, amount, status, date, paid_at, paid_by')
    .order('date', { ascending: false })

  const commissions: CommissionRow[] = []
  let totalCalculated = 0
  let totalPaidOut = 0

  // Get team member names
  const { data: members } = await admin.from('team_members').select('id, name')
  const memberMap = Object.fromEntries((members || []).map((m: { id: string; name: string }) => [m.id, m.name]))

  for (const row of (rows || []) as unknown as {
    id: string; payment_id: string; team_member_id: string | null
    role: string; percentage: number; amount: number; status: string
    date: string; paid_at: string | null; paid_by: string | null
  }[]) {
    commissions.push({
      id: row.id,
      paymentId: row.payment_id,
      teamMemberId: row.team_member_id,
      teamMemberName: row.team_member_id ? (memberMap[row.team_member_id] || null) : null,
      role: row.role,
      percentage: row.percentage,
      amount: row.amount,
      status: row.status,
      date: row.date,
      paidAt: row.paid_at,
      paidBy: row.paid_by,
    })

    if (row.status === 'CALCULATED') totalCalculated += row.amount
    if (row.status === 'PAID OUT') totalPaidOut += row.amount
  }

  return {
    commissions,
    totalCalculated,
    totalPaidOut,
    totalOpen: totalCalculated, // open = still CALCULATED (not yet paid out)
  }
}

/**
 * Mark a commission as PAID OUT. Returns the team_member's slack_user_id if available.
 */
export async function markCommissionPaid(
  commissionId: string,
  paidByTeamMemberId: string,
): Promise<{ success: boolean; slackUserId: string | null; name: string | null; amount: number }> {
  const admin = getSupabaseAdmin()

  // Get commission
  const { data: commission } = await admin
    .from('commissions')
    .select('id, team_member_id, amount, status')
    .eq('id', commissionId)
    .single()

  if (!commission) return { success: false, slackUserId: null, name: null, amount: 0 }
  const c = commission as { id: string; team_member_id: string | null; amount: number; status: string }

  if (c.status === 'PAID OUT') return { success: true, slackUserId: null, name: null, amount: c.amount }

  // Update status
  await admin
    .from('commissions')
    .update({
      status: 'PAID OUT',
      paid_at: new Date().toISOString(),
      paid_by: paidByTeamMemberId,
    })
    .eq('id', commissionId)

  // Get team member for Slack DM
  let slackUserId: string | null = null
  let name: string | null = null
  if (c.team_member_id) {
    const { data: tm } = await admin
      .from('team_members')
      .select('name, slack_user_id')
      .eq('id', c.team_member_id)
      .single()

    if (tm) {
      const member = tm as { name: string; slack_user_id: string | null }
      slackUserId = member.slack_user_id
      name = member.name
    }
  }

  return { success: true, slackUserId, name, amount: c.amount }
}

/**
 * Get all costs.
 */
export async function getCosts(): Promise<CostRow[]> {
  const admin = getSupabaseAdmin()
  const { data } = await admin
    .from('costs')
    .select('id, title, amount, category, date, notes')
    .order('date', { ascending: false })

  return (data || []) as unknown as CostRow[]
}
