import { supabase } from '@/lib/supabase'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

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

// ── Team-benchmark (setters) ──
// Geeft UITSLUITEND geaggregeerde gemiddelden per setter-dag terug — nooit
// individuele rapporten/namen. Server-side (admin-client) zodat een setter een
// veilige teamvergelijking krijgt zonder andermans data te zien.

export interface SetterBenchmark {
  reportCount: number
  setterCount: number
  perDayAvg: {
    nieuwe_outbounds: number
    follow_ups: number
    replies_outbound: number
    positieve_reacties: number
    leads_gekwalificeerd: number
    calls_geboekt: number
    calendly_links_gestuurd: number
  }
}

const numVal = (v: unknown) => Number(v) || 0

export async function getSetterTeamBenchmark(
  dateFrom: string,
  dateTo: string
): Promise<SetterBenchmark> {
  const admin = getSupabaseAdmin()
  const { data } = await admin
    .from('eod_reports')
    .select('team_member_id, answers')
    .eq('role_type', 'SETTER')
    .gte('report_date', dateFrom)
    .lte('report_date', dateTo)

  const rows = (data as unknown as { team_member_id: string; answers: Record<string, Record<string, unknown>> }[]) || []
  const reportCount = rows.length
  const setterCount = new Set(rows.map(r => r.team_member_id)).size

  const sum = {
    nieuwe_outbounds: 0,
    follow_ups: 0,
    replies_outbound: 0,
    positieve_reacties: 0,
    leads_gekwalificeerd: 0,
    calls_geboekt: 0,
    calendly_links_gestuurd: 0,
  }

  for (const r of rows) {
    const a = r.answers || {}
    sum.nieuwe_outbounds += numVal(a.activiteit?.nieuwe_outbounds)
    sum.follow_ups += numVal(a.activiteit?.follow_ups)
    sum.replies_outbound += numVal(a.conversies?.replies_outbound)
    sum.positieve_reacties += numVal(a.conversies?.positieve_reacties)
    sum.leads_gekwalificeerd += numVal(a.conversies?.leads_gekwalificeerd)
    sum.calls_geboekt += numVal(a.calls?.calls_geboekt_inbound) + numVal(a.calls?.calls_geboekt_outbound)
    sum.calendly_links_gestuurd += numVal(a.calls?.calendly_links_gestuurd)
  }

  const avg = (total: number) => (reportCount > 0 ? Math.round((total / reportCount) * 10) / 10 : 0)

  return {
    reportCount,
    setterCount,
    perDayAvg: {
      nieuwe_outbounds: avg(sum.nieuwe_outbounds),
      follow_ups: avg(sum.follow_ups),
      replies_outbound: avg(sum.replies_outbound),
      positieve_reacties: avg(sum.positieve_reacties),
      leads_gekwalificeerd: avg(sum.leads_gekwalificeerd),
      calls_geboekt: avg(sum.calls_geboekt),
      calendly_links_gestuurd: avg(sum.calendly_links_gestuurd),
    },
  }
}
