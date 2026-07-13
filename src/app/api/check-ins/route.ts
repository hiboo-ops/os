import { supabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { student_id, coach_id, notes, type } = body

  if (!student_id) {
    return NextResponse.json({ error: 'student_id required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('check_ins')
    .insert({ student_id, coach_id: coach_id || null, notes: notes || '', type: type || 'MANUAL', date: new Date().toISOString().split('T')[0] })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
