import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { createEsignContract } from '@/lib/esignatures'
import { findAccountByEmail, createAccount, createIncomingPayment } from '@/lib/queries/accounts'

interface ScheduleItem {
  amount: number
  due_date: string
}

/**
 * POST /api/finance-contracts
 * Maakt een contract aan met betalingsschema.
 * Zelfvoorzienend: als er nog geen first_payment_id/account_id is (contract direct
 * vanaf een CLOSED-deal), matcht/maakt hij het account op de call-email en maakt
 * incoming_payment #1 (first deposit). Daarna: contract + incoming_payments #2..n
 * + esignatures.io.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN', 'CLOSER'])
  if (denied) return denied

  const body = await req.json()
  const {
    call_id,
    deal_value,
    number_of_installments,
    schedule,
    signer_name,
    signer_email,
    signer_mobile,
    package_id,
    address,
    postcode,
    city,
    first_deposit_amount,
    first_deposit_date,
  } = body as {
    call_id: string
    deal_value: number
    number_of_installments: number
    schedule: ScheduleItem[]
    signer_name: string
    signer_email: string
    signer_mobile?: string
    package_id?: string
    address?: string
    postcode?: string
    city?: string
    first_deposit_amount?: number
    first_deposit_date?: string
  }

  let account_id: string | undefined = body.account_id
  let first_payment_id: string | undefined = body.first_payment_id

  if (!call_id || !deal_value) {
    return NextResponse.json(
      { error: 'call_id en deal_value zijn verplicht' },
      { status: 400 },
    )
  }

  if (!schedule || schedule.length === 0) {
    return NextResponse.json(
      { error: 'schedule (termijnen) is verplicht' },
      { status: 400 },
    )
  }

  const admin = getSupabaseAdmin()

  // ── Bootstrap: account + first payment aanmaken als die er nog niet zijn ──
  if (!first_payment_id) {
    const { data: call } = await admin
      .from('calls')
      .select('*')
      .eq('id', call_id)
      .single()

    if (!call) {
      return NextResponse.json({ error: 'Call niet gevonden' }, { status: 404 })
    }

    // Account: gebruik meegegeven id, anders match/maak op email
    let account = account_id
      ? (await admin.from('accounts').select('*').eq('id', account_id).single()).data
      : (call.email ? await findAccountByEmail(call.email) : null)

    if (!account) {
      const { data: lead } = await admin
        .from('leads')
        .select('id, creator_id, source')
        .eq('call_id', call_id)
        .maybeSingle()

      account = await createAccount({
        name: call.name || signer_name || 'Onbekend',
        email: call.email || signer_email || null,
        phone: call.phone || null,
        source: lead?.source || call.source || null,
        creator_id: lead?.creator_id || null,
        setter_id: call.setter_id || null,
        closer_id: call.closer_id || null,
        lead_id: lead?.id || null,
        call_id,
      })
    }
    account_id = account.id as string

    // First deposit → incoming_payment #1
    const depositAmount = Number(first_deposit_amount) || 0
    if (depositAmount <= 0) {
      return NextResponse.json(
        { error: 'first_deposit_amount (> 0) is verplicht voor een nieuw contract' },
        { status: 400 },
      )
    }
    const ip1 = await createIncomingPayment({
      account_id: account_id as string,
      installment_number: 1,
      amount: depositAmount,
      due_date: first_deposit_date || new Date().toISOString().split('T')[0],
    })
    first_payment_id = ip1.id
  }

  // Haal first payment op voor bedrag
  const { data: firstPayment } = await admin
    .from('incoming_payments')
    .select('*')
    .eq('id', first_payment_id)
    .single()

  if (!firstPayment) {
    return NextResponse.json({ error: 'First payment niet gevonden' }, { status: 404 })
  }
  if (!account_id) account_id = firstPayment.account_id
  if (!account_id) {
    return NextResponse.json({ error: 'Account kon niet worden bepaald' }, { status: 500 })
  }
  const accountId: string = account_id

  // Idempotency: als deze first payment al aan een contract hangt, niet opnieuw aanmaken
  if (firstPayment.contract_id) {
    return NextResponse.json(
      { contract_id: firstPayment.contract_id, already_exists: true },
      { status: 200 },
    )
  }

  // 0. Pakket opzoeken voor esign template_id + placeholder mapping
  let esignTemplateId: string | undefined
  let placeholderMap: { placeholder_key: string; source_field: string }[] | null = null
  if (package_id) {
    const { data: pkg } = await admin
      .from('packages')
      .select('esign_template_id, esign_placeholder_map')
      .eq('id', package_id)
      .single()
    if (pkg?.esign_template_id) {
      esignTemplateId = pkg.esign_template_id
    }
    if (pkg?.esign_placeholder_map && Array.isArray(pkg.esign_placeholder_map)) {
      placeholderMap = pkg.esign_placeholder_map as unknown as { placeholder_key: string; source_field: string }[]
    }
  }

  // Account ophalen voor placeholder-resolving
  const { data: account } = await admin
    .from('accounts')
    .select('*')
    .eq('id', accountId)
    .single()

  // 1. Contract aanmaken
  const paymentPlanSummary = `${number_of_installments} termijnen`
  const { data: contract, error: contractErr } = await admin
    .from('contracts')
    .insert({
      account_id: accountId,
      call_id,
      name: signer_name || 'Contract',
      deal_value,
      payment_plan: paymentPlanSummary,
      type: 'NEW_DEAL',
      source: 'SALES',
      esign_status: 'PENDING',
      ...(package_id ? { package_id } : {}),
      ...(address ? { address } : {}),
      ...(postcode ? { postcode } : {}),
      ...(city ? { city } : {}),
    })
    .select()
    .single()

  if (contractErr || !contract) {
    return NextResponse.json(
      { error: contractErr?.message || 'Contract aanmaken mislukt' },
      { status: 500 },
    )
  }

  // 2. Koppel first payment aan contract
  await admin
    .from('incoming_payments')
    .update({
      contract_id: contract.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', first_payment_id)

  // 3. Maak incoming_payments #2..n per schema
  const installments = schedule.map((item, idx) => ({
    account_id: accountId,
    contract_id: contract.id,
    installment_number: idx + 2,
    amount: item.amount,
    due_date: item.due_date,
  }))

  if (installments.length > 0) {
    const { error: ipErr } = await admin
      .from('incoming_payments')
      .insert(installments)

    if (ipErr) {
      return NextResponse.json(
        { error: `Termijnen aanmaken mislukt: ${ipErr.message}` },
        { status: 500 },
      )
    }
  }

  // 4. esignatures.io (gated)
  const installmentAmount = schedule.length > 0 ? schedule[0].amount : 0
  const paymentScheduleMarkdown = schedule
    .map((item, idx) => `| ${idx + 2} | €${item.amount} | ${item.due_date} |`)
    .join('\n')

  // Berekende waarden voor placeholder-resolving
  const computedValues: Record<string, string> = {
    deal_value: `€${deal_value}`,
    first_payment_amount: `€${firstPayment.amount}`,
    number_of_installments: String(number_of_installments),
    installment_amount: `€${installmentAmount}`,
    payment_schedule: paymentScheduleMarkdown,
    start_date: schedule[0]?.due_date || new Date().toISOString().split('T')[0],
    address: address || '',
    postcode: postcode || '',
    city: city || '',
  }

  // Context-rijen voor source_field resolving
  const contextRows: Record<string, Record<string, unknown>> = {
    accounts: account || {},
    contracts: contract,
    incoming_payments: firstPayment,
  }

  let placeholderFields: Record<string, string>

  if (placeholderMap && placeholderMap.length > 0) {
    // Resolve elke mapping uit de package-configuratie
    placeholderFields = {}
    for (const { placeholder_key, source_field } of placeholderMap) {
      const [source, field] = source_field.split('.')
      if (source === 'computed') {
        placeholderFields[placeholder_key] = computedValues[field] ?? ''
      } else if (contextRows[source]) {
        const val = contextRows[source][field]
        placeholderFields[placeholder_key] = val != null ? String(val) : ''
      } else {
        placeholderFields[placeholder_key] = ''
      }
    }
  } else {
    // Fallback: standaard hardcoded set
    placeholderFields = {
      client_name: signer_name,
      client_email: signer_email,
      deal_value: computedValues.deal_value,
      first_payment_amount: computedValues.first_payment_amount,
      number_of_installments: computedValues.number_of_installments,
      installment_amount: computedValues.installment_amount,
      payment_schedule: computedValues.payment_schedule,
      start_date: computedValues.start_date,
      address: computedValues.address,
      postcode: computedValues.postcode,
      city: computedValues.city,
    }
  }

  const esignResult = await createEsignContract({
    title: `Contract ${signer_name} — €${deal_value}`,
    templateId: esignTemplateId,
    signer: {
      name: signer_name,
      email: signer_email,
      mobile: signer_mobile,
    },
    placeholderFields,
  })

  // Update contract met esign-info
  if (esignResult) {
    await admin
      .from('contracts')
      .update({
        esign_contract_id: esignResult.esign_contract_id,
        esign_status: esignResult.esign_status,
      })
      .eq('id', contract.id)
  } else {
    await admin
      .from('contracts')
      .update({ esign_status: 'PENDING_CONFIG' })
      .eq('id', contract.id)
  }

  return NextResponse.json({
    contract_id: contract.id,
    account_id: accountId,
    first_payment_id,
    installments_created: installments.length,
    esign_status: esignResult?.esign_status || 'PENDING_CONFIG',
    esign_contract_id: esignResult?.esign_contract_id || null,
  }, { status: 201 })
}
