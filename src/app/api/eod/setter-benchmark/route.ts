import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/auth'
import { getSetterTeamBenchmark } from '@/lib/queries/eod'

// Geeft alleen geaggregeerde team-gemiddelden (setters) terug — nooit
// individuele rapporten. Zo kan een setter zich met het team vergelijken
// zonder andermans data te zien.
export async function GET(req: NextRequest) {
  const user = await getAuthUser()
  const denied = requireRole(user, ['SETTER', 'ADMIN'])
  if (denied) return denied

  const params = req.nextUrl.searchParams
  const dateFrom = params.get('dateFrom')
  const dateTo = params.get('dateTo')

  if (!dateFrom || !dateTo) {
    return NextResponse.json({ error: 'dateFrom en dateTo zijn verplicht' }, { status: 400 })
  }

  const benchmark = await getSetterTeamBenchmark(dateFrom, dateTo)
  return NextResponse.json(benchmark)
}
