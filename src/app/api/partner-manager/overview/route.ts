import { NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/auth'
import { getPartnerManagerOverview } from '@/lib/queries/partner-manager'

export async function GET() {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN', 'PARTNER_MANAGER'])
  if (denied) return denied

  try {
    const data = await getPartnerManagerOverview()
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
