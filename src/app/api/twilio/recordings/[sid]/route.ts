import { NextRequest } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/auth'

// Geauthenticeerde audio-proxy: de Twilio recording-URL is nooit publiek;
// de audiospeler in de UI gebruikt altijd /api/twilio/recordings/{sid}.
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ sid: string }> }
) {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN', 'SETTER', 'CLOSER', 'COACH'])
  if (denied) return denied

  const { sid } = await ctx.params
  if (!/^RE[a-zA-Z0-9]+$/.test(sid)) {
    return new Response('Invalid recording sid', { status: 400 })
  }

  const auth = Buffer.from(
    `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
  ).toString('base64')

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Recordings/${sid}.mp3`,
    { headers: { Authorization: `Basic ${auth}` } }
  )

  if (!res.ok) return new Response('Recording not found', { status: 404 })

  return new Response(res.body, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
