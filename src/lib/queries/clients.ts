import { supabase } from '@/lib/supabase'

export async function getClientList() {
  const { data } = await supabase
    .from('clients')
    .select('id, name, email, phone, status, program, source, start_date, tcv, upsell_status')
    .order('name')

  return data || []
}

export async function getClientById(id: string) {
  const { data } = await supabase
    .from('clients')
    .select(`
      *,
      coach:coaches(id, name, email),
      closer:closers(id, name),
      creator:creators(id, name, calendly_link)
    `)
    .eq('id', id)
    .single()

  return data as ClientFull | null
}

export async function getStudentForClient(clientId: string) {
  const { data } = await supabase
    .from('students')
    .select(`
      *,
      coach:coaches(id, name, email)
    `)
    .eq('client_id', clientId)
    .single()

  return data
}

export async function getPaymentsForClient(clientId: string) {
  const { data } = await supabase
    .from('payments')
    .select('*')
    .eq('client_id', clientId)
    .order('payment_number')

  return data || []
}

export async function getDealsForClient(clientId: string) {
  const { data } = await supabase
    .from('deals')
    .select('*, closer:closers(name), setter:setters(name)')
    .eq('client_id', clientId)
    .order('date', { ascending: false })

  return data || []
}

export async function getFeedbackForClient(clientId: string) {
  const { data } = await supabase
    .from('feedback')
    .select('*')
    .eq('client_id', clientId)
    .order('date', { ascending: false })

  return data || []
}

export async function getCheckInsForClient(clientId: string) {
  const { data } = await supabase
    .from('check_ins')
    .select('*, coach:coaches(name)')
    .eq('student_id', clientId)
    .order('date', { ascending: false })

  return data || []
}

export async function getHomeworkForClient(studentId: string) {
  const { data } = await supabase
    .from('homework_assignments')
    .select('*')
    .eq('student_id', studentId)
    .order('assignment_number')

  return data || []
}

export async function updateClientNotes(clientId: string, notes: string) {
  const { error } = await supabase
    .from('clients')
    .update({ flags_notes: notes })
    .eq('id', clientId)

  return !error
}

export interface ClientFull {
  id: string
  name: string
  email: string | null
  phone: string | null
  status: string
  source: string | null
  program: string | null
  start_date: string | null
  tcv: number | null
  upsell_status: string
  client_satisfaction: number | null
  churn_date: string | null
  churn_reason: string | null
  payment_provider: string | null
  flags_notes: string | null
  created_at: string
  coach: { id: string; name: string; email: string } | null
  closer: { id: string; name: string } | null
  creator: { id: string; name: string; calendly_link: string | null } | null
}
