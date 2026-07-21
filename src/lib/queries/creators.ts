import { supabase } from '@/lib/supabase'

export interface Creator {
  id: string
  name: string
  email: string | null
  socials: Record<string, string> | null
  status: string
  calendly_link: string | null
  quiz_utm: string | null
  cac: number | null
  setup_fee: number | null
  start_date: string | null
}

export async function getCreatorList() {
  const { data } = await supabase
    .from('creators')
    .select('id, name, email, socials, status, calendly_link, quiz_utm, cac, setup_fee, start_date')
    .order('name')

  return (data || []) as unknown as Creator[]
}

export async function getLeadCountsByCreator() {
  const { data } = await supabase
    .from('leads')
    .select('creator_id')

  if (!data) return {} as Record<string, number>

  const counts: Record<string, number> = {}
  for (const row of data) {
    const cid = (row as unknown as { creator_id: string | null }).creator_id
    if (cid) {
      counts[cid] = (counts[cid] || 0) + 1
    }
  }
  return counts
}
