import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/auth'
import { withApiLog } from '@/lib/api-log'

/**
 * Registers Calendly webhook subscription using server-side PAT from env var.
 * POST /api/webhooks/calendly/setup (ADMIN only)
 */

const CALENDLY_API = 'https://api.calendly.com'

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN'])
  if (denied) return denied

  const token = process.env.CALENDLY_PAT
  if (!token) {
    return NextResponse.json({ error: 'CALENDLY_PAT env var not configured' }, { status: 500 })
  }

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  }

  // 1. Get current user to find organization URI
  const userRes = await withApiLog(
    { direction: 'OUTBOUND', source: 'calendly', action: 'get_user' },
    () => fetch(`${CALENDLY_API}/users/me`, { headers }),
  )
  if (!userRes.ok) {
    const err = await userRes.text()
    return NextResponse.json({ error: `Calendly auth failed: ${err}` }, { status: 400 })
  }
  const userData = await userRes.json()
  const orgUri = userData.resource?.current_organization
  const userName = userData.resource?.name || null
  if (!orgUri) {
    return NextResponse.json({ error: 'Could not find organization URI' }, { status: 400 })
  }

  // 2. Determine webhook callback URL
  const host = req.headers.get('host') || 'hiboo-os.vercel.app'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const callbackUrl = `${protocol}://${host}/api/webhooks/calendly`

  // 3. Check if webhook already exists
  const listRes = await withApiLog(
    { direction: 'OUTBOUND', source: 'calendly', action: 'list_webhooks' },
    () => fetch(`${CALENDLY_API}/webhook_subscriptions?organization=${encodeURIComponent(orgUri)}&scope=organization`, { headers }),
  )
  if (listRes.ok) {
    const listData = await listRes.json()
    const existing = listData.collection?.find((w: Record<string, unknown>) => w.callback_url === callbackUrl)
    if (existing) {
      return NextResponse.json({
        success: true,
        message: 'Webhook already connected',
        user: userName,
        callbackUrl,
      })
    }
  }

  // 4. Create webhook subscription
  const createRes = await withApiLog(
    { direction: 'OUTBOUND', source: 'calendly', action: 'create_webhook' },
    () => fetch(`${CALENDLY_API}/webhook_subscriptions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        url: callbackUrl,
        events: ['invitee.created', 'invitee.canceled'],
        organization: orgUri,
        scope: 'organization',
      }),
    }),
  )

  if (!createRes.ok) {
    const err = await createRes.text()
    return NextResponse.json({ error: `Failed to create webhook: ${err}` }, { status: 400 })
  }

  return NextResponse.json({
    success: true,
    message: 'Webhook connected successfully',
    user: userName,
    callbackUrl,
  })
}

// GET: check connection status (ADMIN only)
export async function GET() {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN'])
  if (denied) return denied

  const token = process.env.CALENDLY_PAT
  if (!token) {
    return NextResponse.json({ connected: false, error: 'CALENDLY_PAT not configured' })
  }

  const headers = { 'Authorization': `Bearer ${token}` }

  const userRes = await fetch(`${CALENDLY_API}/users/me`, { headers })
  if (!userRes.ok) {
    return NextResponse.json({ connected: false, error: 'Invalid token' })
  }

  const userData = await userRes.json()
  const orgUri = userData.resource?.current_organization

  // Check for existing webhooks
  const listRes = await fetch(`${CALENDLY_API}/webhook_subscriptions?organization=${encodeURIComponent(orgUri)}&scope=organization`, { headers })
  const listData = listRes.ok ? await listRes.json() : { collection: [] }
  const webhooks = listData.collection || []

  return NextResponse.json({
    connected: true,
    user: userData.resource?.name,
    email: userData.resource?.email,
    webhooksActive: webhooks.length,
  })
}
