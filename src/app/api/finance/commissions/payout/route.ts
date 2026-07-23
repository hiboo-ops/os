import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/auth'
import { markCommissionPaid } from '@/lib/queries/commissions'
import { sendSlackDm } from '@/lib/slack'
import { eur } from '@/lib/format'

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN', 'FINANCE'])
  if (denied) return denied

  const body = await req.json()
  const { commission_id } = body

  if (!commission_id) {
    return NextResponse.json({ error: 'commission_id is verplicht' }, { status: 400 })
  }

  try {
    const result = await markCommissionPaid(commission_id, user!.teamMemberId)

    if (!result.success) {
      return NextResponse.json({ error: 'Commissie niet gevonden' }, { status: 404 })
    }

    // Send Slack DM to the person (fire-and-forget)
    if (result.slackUserId && result.name) {
      sendSlackDm(
        result.slackUserId,
        `Hey ${result.name}! Je commissie van ${eur(result.amount)} is zojuist uitbetaald. Check je rekening!`,
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
