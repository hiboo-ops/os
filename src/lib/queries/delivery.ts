import { supabase } from '@/lib/supabase'

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
