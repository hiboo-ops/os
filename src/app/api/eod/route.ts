import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireAuth } from '@/lib/auth'
import { getEodReport, upsertEodReport, listEodReports, type RoleType } from '@/lib/queries/eod'

const VALID_ROLES: RoleType[] = ['SETTER', 'CLOSER', 'PARTNER_MANAGER', 'FINANCE', 'CREATOR']

export async function GET(req: NextRequest) {
  const user = await getAuthUser()
  const denied = requireAuth(user)
  if (denied) return denied

  const params = req.nextUrl.searchParams
  const roleType = params.get('roleType') as RoleType | null
  const date = params.get('date')
  const memberId = params.get('memberId')

  // Enkele rapport ophalen
  if (roleType && date && memberId) {
    // Niet-admins mogen alleen eigen rapporten zien
    if (user!.role !== 'ADMIN' && memberId !== user!.teamMemberId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const report = await getEodReport(roleType, date, memberId)
    return NextResponse.json(report)
  }

  // Lijst ophalen (admin: alles, anderen: alleen eigen)
  const filters: Parameters<typeof listEodReports>[0] = {}
  if (roleType && VALID_ROLES.includes(roleType)) filters.roleType = roleType
  if (params.get('dateFrom')) filters.dateFrom = params.get('dateFrom')!
  if (params.get('dateTo')) filters.dateTo = params.get('dateTo')!

  if (user!.role === 'ADMIN') {
    if (memberId) filters.memberId = memberId
  } else {
    filters.memberId = user!.teamMemberId
  }

  const reports = await listEodReports(filters)
  return NextResponse.json(reports)
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  const denied = requireAuth(user)
  if (denied) return denied

  const body = await req.json()
  const { report_date, role_type, answers } = body

  if (!report_date || !role_type || !answers) {
    return NextResponse.json({ error: 'report_date, role_type en answers zijn verplicht' }, { status: 400 })
  }

  if (!VALID_ROLES.includes(role_type)) {
    return NextResponse.json({ error: 'Ongeldig role_type' }, { status: 400 })
  }

  const result = await upsertEodReport({
    report_date,
    role_type,
    team_member_id: user!.teamMemberId,
    submitted_name: user!.name,
    answers,
  })

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
