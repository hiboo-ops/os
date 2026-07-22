import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/auth'
import { logCollectionActivity, type ActivityType } from '@/lib/queries/collections'

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN', 'FINANCE'])
  if (denied) return denied

  const body = await req.json()
  const { incoming_payment_id, account_id, type, note, outcome, promise_date } = body as {
    incoming_payment_id: string
    account_id: string
    type: ActivityType
    note?: string
    outcome?: string
    promise_date?: string
  }

  if (!incoming_payment_id || !account_id || !type) {
    return NextResponse.json(
      { error: 'incoming_payment_id, account_id en type zijn verplicht' },
      { status: 400 },
    )
  }

  const validTypes: ActivityType[] = [
    'REMINDER', 'CONTACT', 'NOTE', 'PROMISE', 'DISPUTE', 'PAYMENT_LINK', 'PAID',
  ]
  if (!validTypes.includes(type)) {
    return NextResponse.json(
      { error: `type moet een van ${validTypes.join(', ')} zijn` },
      { status: 400 },
    )
  }

  const activity = await logCollectionActivity({
    incoming_payment_id,
    account_id,
    type,
    note,
    outcome,
    promise_date,
    created_by: user!.id,
  })

  return NextResponse.json(activity, { status: 201 })
}
