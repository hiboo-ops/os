import { NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/auth'

export async function GET() {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN'])
  if (denied) return denied

  const configured = !!(
    process.env.ESIGNATURES_SECRET_TOKEN &&
    process.env.ESIGNATURES_SECRET_TOKEN.length > 0
  )

  return NextResponse.json({ configured })
}
