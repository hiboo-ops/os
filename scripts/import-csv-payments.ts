/**
 * CSV-importscript: nieuwe betaaldata → accounts → contracts → incoming_payments → payments
 *
 * Verwacht CSV met kolommen (precieze namen configureerbaar):
 *   name, email, phone, source, deal_value, payment_plan,
 *   installment_number, amount, due_date, status (PAID/OPEN/LATE),
 *   paid_date, provider, closer, setter
 *
 * Gebruik: npx tsx scripts/import-csv-payments.ts <pad-naar-csv>
 *
 * Vereist env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('Stel NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY in als env vars')
  process.exit(1)
}

const csvPath = process.argv[2]
if (!csvPath) {
  console.error('Gebruik: npx tsx scripts/import-csv-payments.ts <pad-naar-csv>')
  process.exit(1)
}

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.trim().split('\n')
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'))
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = values[i] || '' })
    return row
  })
}

async function findOrCreateAccount(row: Record<string, string>): Promise<string> {
  const email = row.email?.toLowerCase().trim()

  // Zoek bestaand account op email
  if (email) {
    const { data: existing } = await admin
      .from('accounts')
      .select('id')
      .ilike('email', email)
      .limit(1)
      .maybeSingle()

    if (existing) return existing.id
  }

  // Zoek closer_id en setter_id
  let closerId: string | null = null
  let setterId: string | null = null

  if (row.closer) {
    const { data: closer } = await admin
      .from('closers')
      .select('id')
      .ilike('name', `%${row.closer}%`)
      .limit(1)
      .maybeSingle()
    closerId = closer?.id || null
  }

  if (row.setter) {
    const { data: setter } = await admin
      .from('setters')
      .select('id')
      .ilike('name', `%${row.setter}%`)
      .limit(1)
      .maybeSingle()
    setterId = setter?.id || null
  }

  const { data: account, error } = await admin
    .from('accounts')
    .insert({
      name: row.name || 'Onbekend',
      email: email || null,
      phone: row.phone || null,
      source: row.source || null,
      closer_id: closerId,
      setter_id: setterId,
    })
    .select('id')
    .single()

  if (error) {
    // Unique constraint → probeer nogmaals op te halen
    if (error.code === '23505' && email) {
      const { data: existing } = await admin
        .from('accounts')
        .select('id')
        .ilike('email', email)
        .limit(1)
        .single()
      if (existing) return existing.id
    }
    throw new Error(`Account aanmaken mislukt voor ${row.name}: ${error.message}`)
  }

  return account.id
}

async function main() {
  console.log('=== CSV-import: betaaldata ===\n')

  const content = readFileSync(csvPath, 'utf-8')
  const rows = parseCSV(content)
  console.log(`CSV gelezen: ${rows.length} rijen`)

  // Groepeer per email (= per account)
  const byEmail = new Map<string, Record<string, string>[]>()
  for (const row of rows) {
    const key = row.email?.toLowerCase().trim() || `no-email-${Math.random()}`
    if (!byEmail.has(key)) byEmail.set(key, [])
    byEmail.get(key)!.push(row)
  }
  console.log(`Unieke accounts: ${byEmail.size}`)

  let accountsCreated = 0
  let contractsCreated = 0
  let incomingCreated = 0
  let paymentsCreated = 0

  for (const [, accountRows] of byEmail) {
    try {
      const accountId = await findOrCreateAccount(accountRows[0])
      accountsCreated++

      // Maak contract aan (1 per account in deze import)
      const dealValue = accountRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0)
      const { data: contract } = await admin
        .from('contracts')
        .insert({
          account_id: accountId,
          name: accountRows[0].name || 'Import contract',
          deal_value: dealValue,
          payment_plan: accountRows[0].payment_plan || null,
          type: 'NEW_DEAL',
          source: 'SALES',
        })
        .select('id')
        .single()

      if (!contract) continue
      contractsCreated++

      // Per rij: incoming_payment + eventueel payment
      for (const row of accountRows) {
        const amount = Number(row.amount) || 0
        const installmentNumber = Number(row.installment_number) || 1
        const isPaid = row.status?.toUpperCase() === 'PAID'

        const { data: ip } = await admin
          .from('incoming_payments')
          .insert({
            account_id: accountId,
            contract_id: contract.id,
            installment_number: installmentNumber,
            amount,
            due_date: row.due_date || null,
            status: isPaid ? 'PAID' : (row.status?.toUpperCase() === 'LATE' ? 'LATE' : 'SCHEDULED'),
          })
          .select('id')
          .single()

        if (!ip) continue
        incomingCreated++

        // Als betaald: payments-rij aanmaken
        if (isPaid) {
          const provider = row.provider?.toUpperCase()
          const validProvider = ['WHOP', 'STRIPE', 'BANK TRANSFER'].includes(provider || '')
            ? provider
            : null

          const { data: payment } = await admin
            .from('payments')
            .insert({
              account_id: accountId,
              incoming_payment_id: ip.id,
              payment_number: installmentNumber,
              amount,
              due_date: row.due_date || null,
              paid: true,
              paid_date: row.paid_date || new Date().toISOString().split('T')[0],
              status: 'PAID',
              provider: validProvider,
            })
            .select('id')
            .single()

          if (payment) {
            await admin
              .from('incoming_payments')
              .update({ payment_id: payment.id })
              .eq('id', ip.id)
            paymentsCreated++
          }
        }
      }

      // Herbereken LTV
      const { data: paidPayments } = await admin
        .from('payments')
        .select('amount')
        .eq('account_id', accountId)
        .eq('paid', true)

      const ltv = (paidPayments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0)
      await admin
        .from('accounts')
        .update({ ltv, updated_at: new Date().toISOString() })
        .eq('id', accountId)

    } catch (err) {
      console.error(`Fout bij ${accountRows[0].name}: ${err instanceof Error ? err.message : err}`)
    }
  }

  console.log(`\n=== Resultaat ===`)
  console.log(`Accounts:          ${accountsCreated}`)
  console.log(`Contracten:        ${contractsCreated}`)
  console.log(`Incoming payments: ${incomingCreated}`)
  console.log(`Payments:          ${paymentsCreated}`)
}

main().catch(console.error)
