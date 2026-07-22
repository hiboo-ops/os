import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

// Eigen dashboard van een creator: leads, order value, cash, EOD-metrics.
// CREATOR ziet zijn eigen creator_id; ADMIN/PARTNER_MANAGER mag ?creator_id meegeven.
export async function GET(req: NextRequest) {
  const user = await getAuthUser()
  const denied = requireRole(user, ['CREATOR', 'ADMIN', 'PARTNER_MANAGER'])
  if (denied) return denied

  const paramId = req.nextUrl.searchParams.get('creator_id')
  const creatorId = user!.role === 'CREATOR' ? user!.creatorId : (paramId || null)

  const empty = {
    creatorId,
    leads: 0, accounts: 0, orderValue: 0, cashCollected: 0,
    eod: { reports: 0, tiktokPosts: 0, igPosts: 0, storiesPosted: 0 },
  }
  if (!creatorId) return NextResponse.json(empty)

  const admin = getSupabaseAdmin()

  // Leads via creator-attributie
  const { count: leadsCount } = await admin
    .from('leads').select('id', { count: 'exact', head: true }).eq('creator_id', creatorId)

  // Accounts van deze creator → order value (contracts) + cash (payments)
  const { data: accs } = await admin.from('accounts').select('id').eq('creator_id', creatorId)
  const accountIds = (accs || []).map(a => a.id)

  let orderValue = 0, cashCollected = 0
  if (accountIds.length > 0) {
    const { data: cts } = await admin.from('contracts').select('deal_value').in('account_id', accountIds)
    orderValue = (cts || []).reduce((s, c) => s + (Number(c.deal_value) || 0), 0)
    const { data: pays } = await admin.from('payments').select('amount').eq('paid', true).in('account_id', accountIds)
    cashCollected = (pays || []).reduce((s, p) => s + (Number(p.amount) || 0), 0)
  }

  // EOD-metrics: creator-rapporten van dit teamlid
  let reports = 0, tiktokPosts = 0, igPosts = 0, storiesPosted = 0
  if (user!.teamMemberId) {
    const { data: eod } = await admin
      .from('eod_reports').select('answers')
      .eq('role_type', 'CREATOR').eq('team_member_id', user!.teamMemberId)
    for (const r of (eod || []) as { answers: Record<string, Record<string, unknown>> }[]) {
      reports++
      tiktokPosts += Number(r.answers?.tiktok?.aantal_posts) || 0
      igPosts += Number(r.answers?.instagram_main?.aantal_posts) || 0
      if (r.answers?.instagram_stories?.story_gepost === 'ja') storiesPosted++
    }
  }

  return NextResponse.json({
    creatorId,
    leads: leadsCount || 0,
    accounts: accountIds.length,
    orderValue,
    cashCollected,
    eod: { reports, tiktokPosts, igPosts, storiesPosted },
  })
}
