import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN'])
  if (denied) return denied

  const { data } = await supabase
    .from('slack_integrations')
    .select('*')
    .order('name')
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN'])
  if (denied) return denied

  const body = await req.json()

  // Test mode: send a test message to the integration's webhook
  if (body.test && body.id) {
    const { data: integration } = await supabase
      .from('slack_integrations')
      .select('webhook_url, name')
      .eq('id', body.id)
      .single()

    if (!integration?.webhook_url) {
      return NextResponse.json({ error: 'Integration niet gevonden of geen webhook_url' }, { status: 404 })
    }

    try {
      const res = await fetch(integration.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `Testbericht vanuit Hiboo Admin voor integratie "${integration.name}"`,
        }),
      })

      if (!res.ok) {
        return NextResponse.json({ error: 'Slack webhook returned error', status: res.status }, { status: 502 })
      }

      return NextResponse.json({ success: true, message: 'Testbericht verzonden' })
    } catch {
      return NextResponse.json({ error: 'Kon geen verbinding maken met Slack webhook' }, { status: 502 })
    }
  }

  // Normal create
  const { error, data } = await getSupabaseAdmin()
    .from('slack_integrations')
    .insert({
      name: body.name,
      webhook_url: body.webhook_url,
      channel: body.channel || null,
      purpose: body.purpose,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: 'Failed to create integration' }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN'])
  if (denied) return denied

  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await getSupabaseAdmin()
    .from('slack_integrations')
    .update(updates)
    .eq('id', id)
  if (error) return NextResponse.json({ error: 'Failed to update integration' }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN'])
  if (denied) return denied

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await getSupabaseAdmin()
    .from('slack_integrations')
    .delete()
    .eq('id', id)
  if (error) return NextResponse.json({ error: 'Failed to delete integration' }, { status: 500 })
  return NextResponse.json({ success: true })
}
