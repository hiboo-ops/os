import twilio from 'twilio'
import { NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/auth'

export async function POST() {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN', 'SETTER'])
  if (denied) return denied

  const AccessToken = twilio.jwt.AccessToken
  const token = new AccessToken(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_API_KEY_SID!,
    process.env.TWILIO_API_KEY_SECRET!,
    { identity: user!.teamMemberId, ttl: 3600 }
  )
  token.addGrant(new AccessToken.VoiceGrant({
    outgoingApplicationSid: process.env.TWILIO_TWIML_APP_SID!,
    incomingAllow: false,
  }))

  return NextResponse.json({ token: token.toJwt(), identity: user!.teamMemberId })
}
