import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { KpiCard } from '@/components/kpi-card'
import { ClipboardCheck, Users, AlertTriangle, Award } from 'lucide-react'

export const revalidate = 30

async function getStats() {
  const [students, incomplete, coaches] = await Promise.all([
    supabase.from('students').select('id, phase, verdienmodel, coach_id, activity_status', { count: 'exact' }),
    supabase.from('students').select('id', { count: 'exact' }).or('coach_id.is.null,verdienmodel.is.null'),
    supabase.from('coaches').select('id', { count: 'exact' }),
  ])

  const data = students.data || []
  return {
    total: students.count ?? 0,
    incomplete: incomplete.count ?? 0,
    coaches: coaches.count ?? 0,
    withPhase: data.filter(s => s.phase && s.phase !== 'PHASE_1').length,
    red: data.filter(s => s.activity_status === 'RED').length,
  }
}

export default async function DeliveryPage() {
  const stats = await getStats()
  const pct = stats.total > 0 ? Math.round(((stats.total - stats.incomplete) / stats.total) * 100) : 0

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900 mb-6">Delivery & Coaching</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="STUDENTS" value={stats.total} />
        <KpiCard label="COACHES" value={stats.coaches} />
        <KpiCard label="BACKFILL NODIG" value={stats.incomplete} caption={`${pct}% compleet`} captionColor={pct > 80 ? 'green' : 'amber'} />
        <KpiCard label="NEEDS ATTENTION" value={stats.red} captionColor="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Link href="/delivery/backfill" className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 hover:shadow-md transition group">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
              <ClipboardCheck className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 group-hover:text-brand-600 transition">Student Backfill</h3>
              <p className="text-sm text-slate-500">{stats.incomplete} studenten missen coach of verdienmodel</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
}
