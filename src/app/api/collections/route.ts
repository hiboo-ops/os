import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/auth'
import {
  getCollectionKpis,
  getAgingBuckets,
  getCashForecast,
  getExpectedVsCollected,
  getCollectionWorklist,
} from '@/lib/queries/collections'

export async function GET(req: NextRequest) {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN', 'FINANCE'])
  if (denied) return denied

  const { searchParams } = req.nextUrl
  const type = searchParams.get('type') || 'legacy'
  const isLegacy = type === 'legacy'
  const cursor = searchParams.get('cursor') || undefined
  const statusFilter = searchParams.get('status') || undefined

  const [kpis, aging, forecast, expectedVsCollected, worklist] = await Promise.all([
    getCollectionKpis(isLegacy),
    getAgingBuckets(isLegacy),
    getCashForecast(isLegacy),
    getExpectedVsCollected(isLegacy),
    getCollectionWorklist(isLegacy, { cursor, statusFilter }),
  ])

  return NextResponse.json({
    kpis,
    aging,
    forecast,
    expectedVsCollected,
    worklist,
  })
}
