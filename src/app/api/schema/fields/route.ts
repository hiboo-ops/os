import { NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

interface FieldOption {
  value: string
  label: string
}

interface FieldGroup {
  group: string
  fields: FieldOption[]
}

const COMPUTED_FIELDS: FieldOption[] = [
  { value: 'computed.deal_value', label: 'Deal-waarde' },
  { value: 'computed.first_payment_amount', label: 'Eerste betaling' },
  { value: 'computed.number_of_installments', label: 'Aantal termijnen' },
  { value: 'computed.installment_amount', label: 'Termijnbedrag' },
  { value: 'computed.payment_schedule', label: 'Betalingsschema (tabel)' },
  { value: 'computed.start_date', label: 'Startdatum' },
]

const TABLE_LABELS: Record<string, string> = {
  accounts: 'Account',
  contracts: 'Contract',
  incoming_payments: 'Termijn',
}

const TABLES = ['accounts', 'contracts', 'incoming_payments']

const EXCLUDED_COLUMNS = new Set([
  'id', 'created_at', 'updated_at',
  'esign_contract_id', 'esign_status', 'contract_pdf_url',
  'pay_token',
])

export async function GET() {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN'])
  if (denied) return denied

  const admin = getSupabaseAdmin()

  const { data: columns, error } = await admin.rpc('get_table_columns', {
    table_names: TABLES,
  })

  if (error || !columns) {
    return NextResponse.json({ error: 'Kan schema niet laden' }, { status: 500 })
  }

  const groups: FieldGroup[] = []

  for (const table of TABLES) {
    const tableCols = (columns as { table_name: string; column_name: string }[])
      .filter(c => c.table_name === table && !EXCLUDED_COLUMNS.has(c.column_name))
      .map(c => ({
        value: `${table}.${c.column_name}`,
        label: c.column_name,
      }))
      .sort((a, b) => a.label.localeCompare(b.label))

    if (tableCols.length > 0) {
      groups.push({
        group: TABLE_LABELS[table] || table,
        fields: tableCols,
      })
    }
  }

  groups.push({
    group: 'Berekend',
    fields: COMPUTED_FIELDS,
  })

  return NextResponse.json(groups)
}
