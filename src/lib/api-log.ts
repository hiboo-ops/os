import { getSupabaseAdmin } from '@/lib/supabase-admin'

export interface ApiEventInput {
  direction: 'INBOUND' | 'OUTBOUND' | 'INTERNAL' | 'CRON'
  source: string
  action?: string
  event_type?: string
  status?: 'SUCCESS' | 'FAILED' | 'PENDING' | 'RETRYING' | 'SKIPPED'
  http_status?: number
  duration_ms?: number
  idempotency_key?: string
  error?: string
  payload?: Record<string, unknown>
  retry_count?: number
  related_type?: string
  related_id?: string
}

/**
 * Fire-and-forget logging — gooit NOOIT, mag een request NOOIT breken.
 */
export async function logApiEvent(event: ApiEventInput): Promise<void> {
  try {
    const supabase = getSupabaseAdmin()
    await supabase.from('api_events').insert({
      direction: event.direction,
      source: event.source,
      action: event.action || null,
      event_type: event.event_type || null,
      status: event.status || 'SUCCESS',
      http_status: event.http_status || null,
      duration_ms: event.duration_ms || null,
      idempotency_key: event.idempotency_key || null,
      error: event.error || null,
      payload: event.payload || null,
      retry_count: event.retry_count || 0,
      related_type: event.related_type || null,
      related_id: event.related_id || null,
    })
  } catch (err) {
    console.error('[api-log] Logging mislukt:', err)
  }
}

/**
 * Wrapt een async functie: meet duur, logt SUCCESS/FAILED + duration_ms.
 * Geeft het resultaat terug — de caller merkt geen verschil.
 */
export async function withApiLog<T>(
  meta: Omit<ApiEventInput, 'status' | 'duration_ms' | 'error'>,
  fn: () => Promise<T>,
): Promise<T> {
  const start = Date.now()
  try {
    const result = await fn()
    const duration_ms = Date.now() - start
    // Fire-and-forget — niet await-en om de response niet te vertragen
    logApiEvent({ ...meta, status: 'SUCCESS', duration_ms })
    return result
  } catch (err) {
    const duration_ms = Date.now() - start
    logApiEvent({
      ...meta,
      status: 'FAILED',
      duration_ms,
      error: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}
