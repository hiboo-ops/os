import { supabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN', 'CLOSER'])
  if (denied) return denied

  const body = await req.json()

  const {
    call_id,
    name,
    package_id,
    deal_value,
    payment_plan,
    address,
    postcode,
    city,
    first_deposit_amount,
    first_deposit_date,
    installment_2_amount,
    installment_2_date,
    installment_3_amount,
    installment_3_date,
    installment_4_amount,
    installment_4_date,
    installment_5_amount,
    installment_5_date,
    installment_6_amount,
    installment_6_date,
  } = body

  if (!call_id) {
    return NextResponse.json({ error: 'call_id is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('contracts')
    .insert({
      call_id,
      name: name || null,
      package_id: package_id || null,
      deal_value: deal_value != null ? deal_value : null,
      payment_plan: payment_plan || null,
      address: address || null,
      postcode: postcode || null,
      city: city || null,
      first_deposit_amount: first_deposit_amount != null ? first_deposit_amount : null,
      first_deposit_date: first_deposit_date || null,
      installment_2_amount: installment_2_amount != null ? installment_2_amount : null,
      installment_2_date: installment_2_date || null,
      installment_3_amount: installment_3_amount != null ? installment_3_amount : null,
      installment_3_date: installment_3_date || null,
      installment_4_amount: installment_4_amount != null ? installment_4_amount : null,
      installment_4_date: installment_4_date || null,
      installment_5_amount: installment_5_amount != null ? installment_5_amount : null,
      installment_5_date: installment_5_date || null,
      installment_6_amount: installment_6_amount != null ? installment_6_amount : null,
      installment_6_date: installment_6_date || null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
