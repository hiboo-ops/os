import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { createEsignContract } from '@/lib/esignatures'

interface ScheduleItem {
  amount: number
  due_date: string
}

/**
 * POST /api/finance-contracts
 * Maakt een contract aan met betalingsschema + koppelt first payment +
 * maakt incoming_payments #2..n + roept esignatures.io aan.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN', 'CLOSER'])
  if (denied) return denied

  const body = await req.json()
  const {
    call_id,
    account_id,
    deal_value,
    first_payment_id,
    number_of_installments,
    schedule,
    signer_name,
    signer_email,
    signer_mobile,
    package_id,
  } = body as {
    call_id: string
    account_id: string
    deal_value: number
    first_payment_id: string
    number_of_installments: number
    schedule: ScheduleItem[]
    signer_name: string
    signer_email: string
    signer_mobile?: string
    package_id?: string
  }

  if (!call_id || !account_id || !deal_value || !first_payment_id) {
    return NextResponse.json(
      { error: 'call_id, account_id, deal_value en first_payment_id zijn verplicht' },
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

  // Haal first payment op voor bedrag
  const { data: firstPayment } = await admin
    .from('incoming_payments')
    .select('*')
    .eq('id', first_payment_id)
    .single()

  if (!firstPayment) {
    return NextResponse.json({ error: 'First payment niet gevonden' }, { status: 404 })
  }

  // Idempotency: als deze first payment al aan een contract hangt, niet opnieuw aanmaken
  if (firstPayment.contract_id) {
    return NextResponse.json(
      { contract_id: firstPayment.contract_id, already_exists: true },
      { status: 200 },
    )
  }

  // 0. Pakket opzoeken voor esign template_id
  let esignTemplateId: string | undefined
  if (package_id) {
    const { data: pkg } = await admin
      .from('packages')
      .select('esign_template_id')
      .eq('id', package_id)
      .single()
    if (pkg?.esign_template_id) {
      esignTemplateId = pkg.esign_template_id
    }
  }

  // 1. Contract aanmaken
  const paymentPlanSummary = `${number_of_installments} termijnen`
  const { data: contract, error: contractErr } = await admin
    .from('contracts')
    .insert({
      account_id,
      call_id,
      name: signer_name || 'Contract',
      deal_value,
      payment_plan: paymentPlanSummary,
      type: 'NEW_DEAL',
      source: 'SALES',
      esign_status: 'PENDING',
      ...(package_id ? { package_id } : {}),
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
    account_id,
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

  const esignResult = await createEsignContract({
    title: `Contract ${signer_name} — €${deal_value}`,
    templateId: esignTemplateId,
    signer: {
      name: signer_name,
      email: signer_email,
      mobile: signer_mobile,
    },
    placeholderFields: {
      client_name: signer_name,
      client_email: signer_email,
      deal_value: `€${deal_value}`,
      first_payment_amount: `€${firstPayment.amount}`,
      number_of_installments: String(number_of_installments),
      installment_amount: `€${installmentAmount}`,
      payment_schedule: paymentScheduleMarkdown,
      start_date: schedule[0]?.due_date || new Date().toISOString().split('T')[0],
    },
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
    installments_created: installments.length,
    esign_status: esignResult?.esign_status || 'PENDING_CONFIG',
    esign_contract_id: esignResult?.esign_contract_id || null,
  }, { status: 201 })
}
