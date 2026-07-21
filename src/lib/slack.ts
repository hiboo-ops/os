import { getSupabaseAdmin } from '@/lib/supabase-admin'

const WEBHOOK_NOTIFICATIONS = process.env.SLACK_WEBHOOK_NOTIFICATIONS
const WEBHOOK_EOD = process.env.SLACK_WEBHOOK_EOD

/** Env-var fallbacks per purpose (backward compatible) */
const ENV_FALLBACKS: Record<string, string | undefined> = {
  notifications: WEBHOOK_NOTIFICATIONS,
  eod: WEBHOOK_EOD,
}

async function postToSlack(webhookUrl: string, body: Record<string, unknown>): Promise<void> {
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (err) {
    console.error('[Slack] Bericht versturen mislukt:', err)
  }
}

/**
 * Stuur een Slack-bericht naar alle actieve webhooks voor een bepaald doel.
 * Valt terug op env vars voor 'notifications' en 'eod' als er geen DB-integraties zijn.
 * Slack mag NOOIT een request breken — alles zit in try/catch.
 */
export async function sendToPurpose(
  purpose: string,
  text: string,
  blocks?: Record<string, unknown>[],
): Promise<void> {
  try {
    const body: Record<string, unknown> = { text, ...(blocks ? { blocks } : {}) }
    const urls: string[] = []

    // Haal actieve webhooks op uit de database
    try {
      const supabase = getSupabaseAdmin()
      const { data } = await supabase
        .from('slack_integrations')
        .select('webhook_url')
        .eq('purpose', purpose)
        .eq('active', true)

      if (data && data.length > 0) {
        for (const row of data) {
          if (row.webhook_url) urls.push(row.webhook_url)
        }
      }
    } catch (dbErr) {
      console.error('[Slack] DB-lookup mislukt, val terug op env vars:', dbErr)
    }

    // Fallback naar env var als er geen DB-resultaten zijn
    if (urls.length === 0) {
      const fallback = ENV_FALLBACKS[purpose]
      if (fallback) urls.push(fallback)
    }

    // Post naar alle gevonden webhooks
    await Promise.allSettled(urls.map((url) => postToSlack(url, body)))
  } catch (err) {
    console.error(`[Slack] sendToPurpose('${purpose}') mislukt:`, err)
  }
}

export async function sendSlackNotification(text: string, blocks?: Record<string, unknown>[]): Promise<void> {
  await sendToPurpose('notifications', text, blocks)
}

export async function sendSlackEodSummary(text: string, blocks?: Record<string, unknown>[]): Promise<void> {
  await sendToPurpose('eod', text, blocks)
}
