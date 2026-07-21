import { supabase } from '@/lib/supabase'

/**
 * EOD answers JSONB conventie:
 *
 * De `answers` kolom slaat een object op per sectie → veld:
 *
 * {
 *   "activiteit": {
 *     "nieuwe_outbounds": number,
 *     "follow_ups": number,
 *     "oude_leads_opgepakt": number,
 *     "nieuwe_volgers_ads": number,
 *     "ads_volgers_bericht": number
 *   },
 *   "conversies": {
 *     "inbound_gesprekken": number,
 *     "replies_outbound": number,
 *     "positieve_reacties": number,
 *     "leads_gekwalificeerd": number
 *   },
 *   "calls": {
 *     "calls_voorgesteld": number,
 *     "calendly_links_gestuurd": number,
 *     "calls_geboekt_inbound": number,
 *     "calls_geboekt_outbound": number
 *   },
 *   "crm": {
 *     "crm_bijgewerkt": "ja" | "nee",
 *     "taken_afgevinkt": "ja" | "nee",
 *     "toelichting": string
 *   },
 *   "reflectie": {
 *     "wat_ging_goed": string,
 *     "hulp_nodig": string,
 *     "grootste_les": string
 *   }
 * }
 *
 * Andere rollen (CLOSER, FINANCE, PARTNER_MANAGER, CREATOR) volgen
 * dezelfde structuur met hun eigen sectie-keys.
 */

export type RoleType = 'SETTER' | 'CLOSER' | 'PARTNER_MANAGER' | 'FINANCE' | 'CREATOR'

export interface EodReport {
  id: string
  report_date: string
  role_type: RoleType
  team_member_id: string
  creator_id: string | null
  submitted_name: string
  answers: Record<string, Record<string, unknown>>
  created_at: string
  updated_at: string
}

export async function getEodReport(
  roleType: RoleType,
  date: string,
  memberId: string
): Promise<EodReport | null> {
  const { data } = await supabase
    .from('eod_reports')
    .select('*')
    .eq('role_type', roleType)
    .eq('report_date', date)
    .eq('team_member_id', memberId)
    .single()

  return (data as unknown as EodReport) ?? null
}

export async function upsertEodReport(report: {
  report_date: string
  role_type: RoleType
  team_member_id: string
  submitted_name: string
  answers: Record<string, Record<string, unknown>>
  creator_id?: string | null
}): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('eod_reports')
    .upsert(
      {
        ...report,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'team_member_id,role_type,report_date' }
    )

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export interface EodListFilters {
  roleType?: RoleType
  dateFrom?: string
  dateTo?: string
  memberId?: string
}

export async function listEodReports(filters: EodListFilters): Promise<EodReport[]> {
  let query = supabase
    .from('eod_reports')
    .select('*')
    .order('report_date', { ascending: false })

  if (filters.roleType) query = query.eq('role_type', filters.roleType)
  if (filters.dateFrom) query = query.gte('report_date', filters.dateFrom)
  if (filters.dateTo) query = query.lte('report_date', filters.dateTo)
  if (filters.memberId) query = query.eq('team_member_id', filters.memberId)

  const { data } = await query
  return (data as unknown as EodReport[]) || []
}
