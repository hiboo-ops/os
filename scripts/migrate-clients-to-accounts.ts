/**
 * Migratiescript: clients → accounts + legacy payments → payments.account_id
 *
 * Dit script:
 * 1. Leest alle bestaande clients (903)
 * 2. Maakt een account aan per client (dedupe op email)
 * 3. Koppelt accounts.client_id naar de client
 * 4. Koppelt bestaande payments.account_id naar het account (via client_id)
 * 5. Laat legacy=true op payments staan (uitgesloten van omzet)
 *
 * Gebruik: npx tsx scripts/migrate-clients-to-accounts.ts
 *
 * Vereist env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('Stel NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY in als env vars')
  process.exit(1)
}

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function main() {
  console.log('=== Migratie: clients → accounts ===\n')

  // 1. Haal alle clients op
  const { data: clients, error: clientErr } = await admin
    .from('clients')
    .select('id, name, email, phone, status, source, coach_id, closer_id, creator_id')
    .order('name')

  if (clientErr) {
    console.error('Fout bij ophalen clients:', clientErr.message)
    process.exit(1)
  }

  console.log(`Gevonden: ${clients.length} clients`)

  // 2. Check welke accounts er al bestaan (idempotent)
  const { data: existingAccounts } = await admin
    .from('accounts')
    .select('id, email, client_id')

  const existingByClientId = new Map<string, string>()
  const existingByEmail = new Map<string, string>()
  for (const acc of existingAccounts || []) {
    if (acc.client_id) existingByClientId.set(acc.client_id, acc.id)
    if (acc.email) existingByEmail.set(acc.email.toLowerCase(), acc.id)
  }

  let created = 0
  let skipped = 0
  let dupeEmail = 0
  const clientToAccount = new Map<string, string>()

  for (const client of clients) {
    // Al gemigreerd via client_id?
    if (existingByClientId.has(client.id)) {
      clientToAccount.set(client.id, existingByClientId.get(client.id)!)
      skipped++
      continue
    }

    // Dedupe op email: als er al een account is met dit email, koppel
    const email = client.email?.toLowerCase().trim() || null
    if (email && existingByEmail.has(email)) {
      const existingId = existingByEmail.get(email)!
      // Update bestaande account met client_id als die nog niet gezet is
      await admin
        .from('accounts')
        .update({ client_id: client.id })
        .eq('id', existingId)
        .is('client_id', null)
      clientToAccount.set(client.id, existingId)
      dupeEmail++
      continue
    }

    // Nieuw account aanmaken
    const { data: account, error: accErr } = await admin
      .from('accounts')
      .insert({
        name: client.name,
        email: email,
        phone: client.phone || null,
        status: client.status || 'ACTIVE',
        source: client.source || null,
        coach_id: client.coach_id || null,
        closer_id: client.closer_id || null,
        creator_id: client.creator_id || null,
        client_id: client.id,
      })
      .select('id')
      .single()

    if (accErr) {
      // Unique constraint op email? → probeer alsnog te koppelen
      if (accErr.code === '23505' && email) {
        const { data: existing } = await admin
          .from('accounts')
          .select('id')
          .ilike('email', email)
          .limit(1)
          .single()
        if (existing) {
          await admin
            .from('accounts')
            .update({ client_id: client.id })
            .eq('id', existing.id)
            .is('client_id', null)
          clientToAccount.set(client.id, existing.id)
          dupeEmail++
          continue
        }
      }
      console.error(`  Fout bij client ${client.name}: ${accErr.message}`)
      continue
    }

    clientToAccount.set(client.id, account.id)
    if (email) existingByEmail.set(email, account.id)
    created++
  }

  console.log(`\nAccounts: ${created} aangemaakt, ${skipped} overgeslagen, ${dupeEmail} email-dupes gekoppeld`)

  // 3. Koppel bestaande payments aan accounts
  const { data: payments } = await admin
    .from('payments')
    .select('id, client_id, account_id')
    .is('account_id', null)

  let linked = 0
  let noAccount = 0

  for (const payment of payments || []) {
    if (!payment.client_id) continue

    const accountId = clientToAccount.get(payment.client_id)
    if (accountId) {
      await admin
        .from('payments')
        .update({ account_id: accountId })
        .eq('id', payment.id)
      linked++
    } else {
      noAccount++
    }
  }

  console.log(`Payments: ${linked} gekoppeld aan account, ${noAccount} zonder account`)

  // 4. Herbereken LTV voor alle accounts met betalingen
  console.log('\nLTV herberekenen...')
  const { data: accountsWithPayments } = await admin
    .from('payments')
    .select('account_id')
    .not('account_id', 'is', null)
    .eq('paid', true)

  const uniqueAccountIds = [...new Set((accountsWithPayments || []).map(p => p.account_id))]

  for (const accountId of uniqueAccountIds) {
    const { data: acctPayments } = await admin
      .from('payments')
      .select('amount')
      .eq('account_id', accountId)
      .eq('paid', true)

    const ltv = (acctPayments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
    await admin
      .from('accounts')
      .update({ ltv, updated_at: new Date().toISOString() })
      .eq('id', accountId)
  }

  console.log(`LTV herberekend voor ${uniqueAccountIds.length} accounts`)

  // Samenvatting
  console.log('\n=== Samenvatting ===')
  const { count: totalAccounts } = await admin
    .from('accounts')
    .select('*', { count: 'exact', head: true })
  const { count: linkedPayments } = await admin
    .from('payments')
    .select('*', { count: 'exact', head: true })
    .not('account_id', 'is', null)
  const { count: totalPayments } = await admin
    .from('payments')
    .select('*', { count: 'exact', head: true })

  console.log(`Accounts totaal: ${totalAccounts}`)
  console.log(`Payments totaal: ${totalPayments} (${linkedPayments} met account_id)`)
}

main().catch(console.error)
