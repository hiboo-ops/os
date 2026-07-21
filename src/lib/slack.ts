const WEBHOOK_NOTIFICATIONS = process.env.SLACK_WEBHOOK_NOTIFICATIONS
const WEBHOOK_EOD = process.env.SLACK_WEBHOOK_EOD

async function postToSlack(webhookUrl: string | undefined, body: Record<string, unknown>): Promise<void> {
  if (!webhookUrl) return
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

export async function sendSlackNotification(text: string, blocks?: Record<string, unknown>[]): Promise<void> {
  await postToSlack(WEBHOOK_NOTIFICATIONS, { text, ...(blocks ? { blocks } : {}) })
}

export async function sendSlackEodSummary(text: string, blocks?: Record<string, unknown>[]): Promise<void> {
  await postToSlack(WEBHOOK_EOD, { text, ...(blocks ? { blocks } : {}) })
}
