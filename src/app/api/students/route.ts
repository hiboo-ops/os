import { supabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { studentId, ...updates } = body

  if (!studentId) {
    return NextResponse.json({ error: 'studentId required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('students')
    .update(updates)
    .eq('id', studentId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
