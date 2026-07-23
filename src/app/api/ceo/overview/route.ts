import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/auth'
import { getCeoDashboardData } from '@/lib/queries/ceo-dashboard'
import type { Period } from '@/lib/queries/finance-overview'

const VALID_PERIODS = new Set(['all', 'year', 'quarter', 'month'])

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN'])
  if (denied) return denied

  try {
    const params = request.nextUrl.searchParams
    const period = VALID_PERIODS.has(params.get('period') || '')
      ? (params.get('period') as Period)
      : 'all'

    const data = await getCeoDashboardData(period)
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
