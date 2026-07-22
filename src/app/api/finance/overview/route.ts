import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/auth'
import {
  getFinanceKpis,
  getMonthlyBreakdown,
  getAgingBucketsAll,
  getCashForecastAll,
  getAttributionData,
  type Period,
  type AttributionDimension,
} from '@/lib/queries/finance-overview'

const VALID_PERIODS = new Set(['all', 'year', 'quarter', 'month'])
const VALID_DIMENSIONS = new Set(['closer', 'setter', 'source'])

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN', 'FINANCE'])
  if (denied) return denied

  try {
    const params = request.nextUrl.searchParams
    const period = VALID_PERIODS.has(params.get('period') || '')
      ? (params.get('period') as Period)
      : 'all'
    const includeLegacy = params.get('legacy') !== 'active'
    const attribution = VALID_DIMENSIONS.has(params.get('attribution') || '')
      ? (params.get('attribution') as AttributionDimension)
      : 'closer'

    const [kpis, monthly, aging, forecast, attributionData] = await Promise.all([
      getFinanceKpis(period, includeLegacy),
      getMonthlyBreakdown(includeLegacy),
      getAgingBucketsAll(includeLegacy),
      getCashForecastAll(includeLegacy),
      getAttributionData(attribution, period, includeLegacy),
    ])

    return NextResponse.json({ kpis, monthly, aging, forecast, attribution: attributionData })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
