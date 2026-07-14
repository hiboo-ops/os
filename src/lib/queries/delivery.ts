import { supabase } from '@/lib/supabase'

// ── COACH WERKLIJST QUERIES ──

export async function getPendingHomework() {
  const { data } = await supabase
    .from('homework_assignments')
    .select(`
      id, assignment_number, status, submitted_at, google_docs_url,
      student:students(id, name, verdienmodel, client:clients(email))
    `)
    .eq('status', 'SUBMITTED')
    .order('submitted_at', { ascending: true })

  return (data || []) as unknown as PendingHomework[]
}

export async function getCheckInOverdue(daysThreshold: number = 14) {
  const { data: students } = await supabase
    .from('students')
    .select(`
      id, name, phase, verdienmodel, activity_status, last_check_in, coaching_hours,
      client:clients(id, name, email, start_date, status)
    `)
    .not('client', 'is', null)

  if (!students) return []

  const now = new Date()
  return (students as unknown as StudentWithRelations[])
    .filter(s => {
      if (s.client?.status === 'CHURNED') return false
      if (!s.last_check_in) return true // never checked in
      const last = new Date(s.last_check_in)
      const daysSince = Math.ceil((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))
      return daysSince >= daysThreshold
    })
    .map(s => {
      const daysSince = s.last_check_in
        ? Math.ceil((now.getTime() - new Date(s.last_check_in).getTime()) / (1000 * 60 * 60 * 24))
        : 999
      return { ...s, daysSinceContact: daysSince }
    })
    .sort((a, b) => b.daysSinceContact - a.daysSinceContact)
}

export async function getStudentsForWorkList() {
  const { data } = await supabase
    .from('students')
    .select(`
      id, name, phase, verdienmodel, activity_status, coaching_hours,
      kick_off_date, certification_date, last_check_in, coach_notes,
      typeform_homework_link, typeform_feedback_link, google_docs_link,
      coach:coaches(id, name),
      client:clients(id, name, email, start_date, program, status, upsell_status)
    `)
    .order('name')

  if (!data) return []

  // Count pending homework per student
  const { data: pendingHw } = await supabase
    .from('homework_assignments')
    .select('student_id')
    .eq('status', 'SUBMITTED')

  const pendingByStudent = new Set((pendingHw || []).map(h => h.student_id))

  // Count approved homework per student
  const { data: allHw } = await supabase
    .from('homework_assignments')
    .select('student_id, status')

  const hwStats: Record<string, { approved: number; total: number }> = {}
  ;(allHw || []).forEach(h => {
    if (!hwStats[h.student_id]) hwStats[h.student_id] = { approved: 0, total: 0 }
    hwStats[h.student_id].total++
    if (h.status === 'APPROVED') hwStats[h.student_id].approved++
  })

  // Get latest feedback per student
  const { data: feedback } = await supabase
    .from('feedback')
    .select('client_id, score')
    .order('date', { ascending: false })

  const scoreByClient: Record<string, number> = {}
  ;(feedback || []).forEach(f => {
    if (f.client_id && !scoreByClient[f.client_id]) scoreByClient[f.client_id] = f.score
  })

  // Get payment data per client
  const { data: allPayments } = await supabase
    .from('payments')
    .select('client_id, amount, paid, legacy')

  const paymentStats: Record<string, { totalPaid: number; totalValue: number; count: number; paidCount: number }> = {}
  ;(allPayments || []).forEach(p => {
    if (!p.client_id) return
    if (!paymentStats[p.client_id]) paymentStats[p.client_id] = { totalPaid: 0, totalValue: 0, count: 0, paidCount: 0 }
    paymentStats[p.client_id].totalValue += p.amount || 0
    paymentStats[p.client_id].count++
    if (p.paid) {
      paymentStats[p.client_id].totalPaid += p.amount || 0
      paymentStats[p.client_id].paidCount++
    }
  })

  const now = new Date()
  return (data as unknown as StudentWithRelations[]).map(s => {
    const daysSinceContact = s.last_check_in
      ? Math.ceil((now.getTime() - new Date(s.last_check_in).getTime()) / (1000 * 60 * 60 * 24))
      : 999
    const hw = hwStats[s.id] || { approved: 0, total: 0 }
    const payments = s.client?.id ? paymentStats[s.client.id] || null : null
    return {
      ...s,
      daysSinceContact,
      hwApproved: hw.approved,
      hwTotal: hw.total,
      hwPending: pendingByStudent.has(s.id),
      latestScore: s.client?.id ? scoreByClient[s.client.id] ?? null : null,
      totalPaid: payments?.totalPaid ?? 0,
      totalValue: payments?.totalValue ?? 0,
      paymentCount: payments?.count ?? 0,
      paidCount: payments?.paidCount ?? 0,
    }
  })
}

export interface PendingHomework {
  id: string
  assignment_number: number
  status: string
  submitted_at: string | null
  google_docs_url: string | null
  student: {
    id: string
    name: string
    verdienmodel: string | null
    client: { email: string } | null
  } | null
}

export interface WorkListStudent extends StudentWithRelations {
  daysSinceContact: number
  hwApproved: number
  hwTotal: number
  hwPending: boolean
  latestScore: number | null
  totalPaid: number
  totalValue: number
  paymentCount: number
  paidCount: number
}

export async function getDeliveryStats() {
  const { data: students } = await supabase
    .from('students')
    .select('id, phase, verdienmodel, coach_id, activity_status')

  const all = students || []
  return {
    total: all.length,
    phase1: all.filter(s => s.phase === 'PHASE_1').length,
    phase2: all.filter(s => s.phase === 'PHASE_2').length,
    phase3: all.filter(s => s.phase === 'PHASE_3').length,
    certified: all.filter(s => s.phase === 'CERTIFIED').length,
    completed: all.filter(s => s.phase === 'COMPLETED').length,
    needsAttention: all.filter(s => s.activity_status === 'RED').length,
    yellow: all.filter(s => s.activity_status === 'YELLOW').length,
    withVerdienmodel: all.filter(s => s.verdienmodel).length,
    withCoach: all.filter(s => s.coach_id).length,
    htc: all.filter(s => s.verdienmodel === 'HIGH_TICKET_CLOSING').length,
    va: all.filter(s => s.verdienmodel === 'VA').length,
    as: all.filter(s => s.verdienmodel === 'APPOINTMENT_SETTING').length,
  }
}

export async function getCoachesWithStats() {
  const { data: coaches } = await supabase
    .from('coaches')
    .select('id, name, email, status')
    .order('name')

  if (!coaches) return []

  const { data: students } = await supabase
    .from('students')
    .select('id, phase, verdienmodel, coach_id, activity_status, coaching_hours')

  const all = students || []

  return coaches.map(c => {
    const mine = all.filter(s => s.coach_id === c.id)
    return {
      ...c,
      studenten: mine.length,
      f1: mine.filter(s => s.phase === 'PHASE_1').length,
      f2: mine.filter(s => s.phase === 'PHASE_2').length,
      f3: mine.filter(s => s.phase === 'PHASE_3').length,
      certified: mine.filter(s => s.phase === 'CERTIFIED').length,
      completed: mine.filter(s => s.phase === 'COMPLETED').length,
      red: mine.filter(s => s.activity_status === 'RED').length,
      yellow: mine.filter(s => s.activity_status === 'YELLOW').length,
      uren: mine.reduce((sum, s) => sum + (s.coaching_hours || 0), 0),
    }
  })
}

export async function getStudentsForPhaseBoard(coachId?: string) {
  let query = supabase
    .from('students')
    .select(`
      id, name, phase, verdienmodel, activity_status, coaching_hours,
      kick_off_date, certification_date, last_check_in, next_check_in, coach_notes,
      typeform_homework_link, typeform_feedback_link, google_docs_link,
      coach:coaches(id, name),
      client:clients(id, name, email, start_date, program, status, upsell_status)
    `)
    .order('name')

  if (coachId) {
    query = query.eq('coach_id', coachId)
  }

  const { data } = await query
  return (data || []) as unknown as StudentWithRelations[]
}

export async function getHomeworkForStudent(studentId: string) {
  const { data } = await supabase
    .from('homework_assignments')
    .select('*')
    .eq('student_id', studentId)
    .order('assignment_number')

  return data || []
}

export async function getCheckInsForStudent(studentId: string) {
  const { data } = await supabase
    .from('check_ins')
    .select('*, coach:coaches(name)')
    .eq('student_id', studentId)
    .order('date', { ascending: false })

  return data || []
}

export async function getUpsellPipeline() {
  const { data } = await supabase
    .from('students')
    .select(`
      id, name, phase, verdienmodel, certification_date, activity_status,
      coach:coaches(id, name),
      client:clients(id, name, email, start_date, upsell_status)
    `)
    .not('client', 'is', null)

  const all = (data || []) as unknown as StudentWithRelations[]

  // Students whose trajectory ends within 30 days or already ended
  const now = new Date()
  return all
    .filter(s => {
      if (!s.client?.start_date) return false
      const start = new Date(s.client.start_date)
      const end = new Date(start)
      end.setMonth(end.getMonth() + 4)
      const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      return daysLeft <= 30
    })
    .map(s => {
      const start = new Date(s.client!.start_date!)
      const end = new Date(start)
      end.setMonth(end.getMonth() + 4)
      const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      const upsellStatus = s.client?.upsell_status || 'N/A'

      let pipelineStatus: 'COMING_UP' | 'IN_CONVERSATION' | 'RENEWED'
      if (upsellStatus === 'RENEWED') pipelineStatus = 'RENEWED'
      else if (upsellStatus === 'IN CONVERSATION') pipelineStatus = 'IN_CONVERSATION'
      else pipelineStatus = 'COMING_UP'

      return { ...s, daysLeft, pipelineStatus }
    })
    .sort((a, b) => a.daysLeft - b.daysLeft)
}

// Types
export interface StudentWithRelations {
  id: string
  name: string
  phase: string | null
  verdienmodel: string | null
  activity_status: string
  coaching_hours: number | null
  kick_off_date: string | null
  certification_date: string | null
  last_check_in: string | null
  next_check_in: string | null
  coach_notes: string | null
  typeform_homework_link: string | null
  typeform_feedback_link: string | null
  google_docs_link: string | null
  coach: { id: string; name: string } | null
  client: {
    id: string
    name: string
    email: string
    start_date: string | null
    program: string | null
    status: string
    upsell_status: string | null
  } | null
}
