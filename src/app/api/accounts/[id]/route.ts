import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/auth'
import { getAccountById, getContractsForAccount, getPaymentsForAccount } from '@/lib/queries/accounts'
import { getActivitiesForAccount } from '@/lib/queries/collections'

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN', 'FINANCE'])
  if (denied) return denied

  const { id } = await ctx.params

  try {
    const [account, contracts, payments, activities] = await Promise.all([
      getAccountById(id),
      getContractsForAccount(id),
      getPaymentsForAccount(id),
      getActivitiesForAccount(id),
    ])
    return NextResponse.json({ account, contracts, payments, activities })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
