import { NextRequest, NextResponse } from 'next/server'

/**
 * One-time setup: registers Calendly webhook subscription using a PAT.
 *
 * Call this once with your PAT:
 * POST /api/webhooks/calendly/setup
 * Body: { "token": "your-calendly-pat" }
 *
 * It will:
 * 1. Get your Calendly organization URI
 * 2. Create a webhook subscription for invitee.created + invitee.canceled
 */

const CALENDLY_API = 'https://api.calendly.com'

export async function POST(req: NextRequest) {
  const { token } = await req.json()
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  }

  // 1. Get current user to find organization URI
  const userRes = await fetch(`${CALENDLY_API}/users/me`, { headers })
  if (!userRes.ok) {
    const err = await userRes.text()
    return NextResponse.json({ error: `Failed to get user: ${err}` }, { status: 400 })
  }
  const userData = await userRes.json()
  const orgUri = userData.resource?.current_organization
  if (!orgUri) {
    return NextResponse.json({ error: 'Could not find organization URI' }, { status: 400 })
  }

  // 2. Determine webhook callback URL
  const host = req.headers.get('host') || 'hiboo-os.vercel.app'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const callbackUrl = `${protocol}://${host}/api/webhooks/calendly`

  // 3. Check if webhook already exists
  const listRes = await fetch(`${CALENDLY_API}/webhook_subscriptions?organization=${encodeURIComponent(orgUri)}&scope=organization`, { headers })
  if (listRes.ok) {
    const listData = await listRes.json()
    const existing = listData.collection?.find((w: Record<string, unknown>) => w.callback_url === callbackUrl)
    if (existing) {
      return NextResponse.json({
        success: true,
        message: 'Webhook already exists',
        webhook: existing,
      })
    }
  }

  // 4. Create webhook subscription
  const createRes = await fetch(`${CALENDLY_API}/webhook_subscriptions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      url: callbackUrl,
      events: ['invitee.created', 'invitee.canceled'],
      organization: orgUri,
      scope: 'organization',
    }),
  })

  if (!createRes.ok) {
    const err = await createRes.text()
    return NextResponse.json({ error: `Failed to create webhook: ${err}` }, { status: 400 })
  }

  const webhook = await createRes.json()

  return NextResponse.json({
    success: true,
    message: 'Webhook created successfully',
    callbackUrl,
    webhook: webhook.resource,
  })
}
