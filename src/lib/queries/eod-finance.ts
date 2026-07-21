import { supabase } from '@/lib/supabase'

// Standalone finance-EOD helpers.
// Uses the shared `eod_reports` table with JSONB `answers` column.
// Convention: { [section]: { [field]: value } }

export interface FinanceEodAnswers {
  cash: {
    totaal_geincasseerd: number | null
    stripe_mollie_psp: number | null
    bankoverschrijvingen: number | null
    contant_overige: number | null
    nieuwe_betaalplannen: number | null
    toekomstige_termijnen: number | null
  }
  mislukt: {
    aantal_failed: number | null
    bedrag_failed: number | null
    reden: string[]
    herpogingen_gepland: number | null
    klanten_gecontact: number | null
    bedrag_hersteld: number | null
    klanten_1_termijn: number | null
    klanten_2plus_termijn: number | null
    openstaand_risico: number | null
  }
  refunds: {
    aantal_refunds: number | null
    bedrag_refunds: number | null
    reden_refunds: string
    aantal_chargebacks: number | null
    bedrag_chargebacks: number | null
    opmerkingen: string
    klanten_stopgezet: number | null
    gemiste_contractwaarde: number | null
  }
  administratie: {
    betalingen_verwerkt: boolean | null
    finance_taken_afgevinkt: boolean | null
    openstaande_afwijkingen: string
  }
  support: {
    speciale_afspraken: number | null
    uitzonderingen: string
  }
  reflectie: {
    wat_ging_goed: string
    waar_loop_je_vast: string
    verbeteridee: string
  }
}

export function emptyAnswers(): FinanceEodAnswers {
  return {
    cash: {
      totaal_geincasseerd: null,
      stripe_mollie_psp: null,
      bankoverschrijvingen: null,
      contant_overige: null,
      nieuwe_betaalplannen: null,
      toekomstige_termijnen: null,
    },
    mislukt: {
      aantal_failed: null,
      bedrag_failed: null,
      reden: [],
      herpogingen_gepland: null,
      klanten_gecontact: null,
      bedrag_hersteld: null,
      klanten_1_termijn: null,
      klanten_2plus_termijn: null,
      openstaand_risico: null,
    },
    refunds: {
      aantal_refunds: null,
      bedrag_refunds: null,
      reden_refunds: '',
      aantal_chargebacks: null,
      bedrag_chargebacks: null,
      opmerkingen: '',
      klanten_stopgezet: null,
      gemiste_contractwaarde: null,
    },
    administratie: {
      betalingen_verwerkt: null,
      finance_taken_afgevinkt: null,
      openstaande_afwijkingen: '',
    },
    support: {
      speciale_afspraken: null,
      uitzonderingen: '',
    },
    reflectie: {
      wat_ging_goed: '',
      waar_loop_je_vast: '',
      verbeteridee: '',
    },
  }
}

export async function upsertFinanceEod(
  teamMemberId: string,
  submittedName: string,
  answers: FinanceEodAnswers,
  reportDate?: string,
) {
  const date = reportDate || new Date().toISOString().split('T')[0]

  const { error } = await supabase
    .from('eod_reports')
    .upsert(
      {
        report_date: date,
        role_type: 'finance',
        team_member_id: teamMemberId,
        creator_id: teamMemberId,
        submitted_name: submittedName,
        answers,
      },
      { onConflict: 'report_date,role_type,team_member_id' },
    )

  if (error) throw error
}

export async function getFinanceEod(teamMemberId: string, reportDate: string) {
  const { data } = await supabase
    .from('eod_reports')
    .select('*')
    .eq('report_date', reportDate)
    .eq('role_type', 'finance')
    .eq('team_member_id', teamMemberId)
    .maybeSingle()

  return data as { answers: FinanceEodAnswers } | null
}

export async function getLatestFinanceEod() {
  const { data } = await supabase
    .from('eod_reports')
    .select('*')
    .eq('role_type', 'finance')
    .order('report_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data as { report_date: string; submitted_name: string; answers: FinanceEodAnswers } | null
}
