import { supabase } from '@/lib/supabase'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/auth'
import { sendSlackNotification } from '@/lib/slack'

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN', 'SETTER'])
  if (denied) return denied

  const body = await req.json()

  // ── ATTRIBUTION LINK MATCHING ──
  try {
    const slug = body.utm_campaign || body.utm_source || body.slug
    if (slug) {
      const admin = getSupabaseAdmin()
      const { data: attrLinks } = await admin
        .from('attribution_links')
        .select('source, creator_id, creators(id, name)')
        .eq('slug', slug)
        .eq('active', true)
        .limit(1)

      if (attrLinks && attrLinks.length > 0) {
        const attr = attrLinks[0] as Record<string, unknown>
        const creator = attr.creators as { id: string; name: string } | null
        if (creator) {
          body.creator_id = creator.id
          body.creator_name = creator.name
        }
        if (attr.source && !body.source) {
          body.source = attr.source as string
        }
      }
    }
  } catch (attrErr) {
    console.error('[Leads] Attribution matching mislukt:', attrErr)
  }

  const { error, data } = await supabase.from('leads').insert(body).select().single()
  if (error) return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 })

  try {
    const naam = data.name || 'Onbekend'
    const bron = data.source || 'Onbekend'
    await sendSlackNotification(`Nieuwe lead: ${naam} (${bron})`, [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*Nieuwe lead*\n*Naam:* ${naam}\n*Bron:* ${bron}` },
      },
    ])
  } catch { /* Slack mag nooit crashen */ }

  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN', 'SETTER'])
  if (denied) return denied

  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase.from('leads').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 })
  return NextResponse.json({ success: true })
}
