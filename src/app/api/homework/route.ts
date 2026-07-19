import { supabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/auth'

export async function PATCH(req: NextRequest) {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN', 'COACH'])
  if (denied) return denied

  const { assignmentId, status } = await req.json()
  if (!assignmentId || !status) {
    return NextResponse.json({ error: 'assignmentId and status required' }, { status: 400 })
  }

  const updates: Record<string, unknown> = { status }
  if (status === 'APPROVED' || status === 'REDO') {
    updates.reviewed_at = new Date().toISOString()
  }

  const { error } = await supabase.from('homework_assignments').update(updates).eq('id', assignmentId)
  if (error) return NextResponse.json({ error: 'Failed to update homework' }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  const denied = requireRole(user, ['ADMIN', 'COACH'])
  if (denied) return denied

  const { studentId } = await req.json()
  if (!studentId) {
    return NextResponse.json({ error: 'studentId required' }, { status: 400 })
  }

  const assignments = Array.from({ length: 10 }, (_, i) => ({
    student_id: studentId,
    assignment_number: i + 1,
    status: 'NOT_SUBMITTED',
  }))

  const { error } = await supabase.from('homework_assignments').insert(assignments)
  if (error) return NextResponse.json({ error: 'Failed to create assignments' }, { status: 500 })
  return NextResponse.json({ success: true })
}
