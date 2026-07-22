import { NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/auth'
import { getFinanceOverview } from '@/lib/queries/accounts'

export async function GET() {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN', 'FINANCE'])
  if (denied) return denied

  try {
    const overview = await getFinanceOverview()
    return NextResponse.json(overview)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
