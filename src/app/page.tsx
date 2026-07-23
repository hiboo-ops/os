import { redirect } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getAuthUser } from '@/lib/auth'
import type { UserRole } from '@/lib/auth'
import { KpiStrip, KpiCell } from '@/components/ui/kpi-strip'
import { ScreenHeader } from '@/components/ui/industry-ui'
import { eur } from '@/lib/format'

export const revalidate = 30

// Niet-admins landen op hun eigen startpagina i.p.v. het bedrijfsbrede dashboard.
const ROLE_HOME: Partial<Record<UserRole, string>> = {
  CLOSER: '/sales',
  SETTER: '/sales/pipeline',
  FINANCE: '/finance',
  PARTNER_MANAGER: '/partner-manager/crm',
  COACH: '/delivery',
  CREATOR: '/creator-dashboard',
}

async function getStats() {
  const [clients, leads, deals, payments] = await Promise.all([
    supabase.from('clients').select('id, status', { count: 'exact' }),
    supabase.from('leads').select('id', { count: 'exact', head: true }),
    supabase.from('deals').select('id', { count: 'exact', head: true }),
    supabase.from('payments').select('id, legacy, amount'),
  ])

  const activeClients = (clients.data || []).filter(c => c.status === 'ACTIVE').length
  const totalPaid = (payments.data || []).filter(p => !p.legacy).reduce((s, p) => s + (p.amount || 0), 0)

  return {
    totalClients: clients.count ?? 0,
    activeClients,
    totalLeads: leads.count ?? 0,
    totalDeals: deals.count ?? 0,
    totalPayments: payments.data?.length ?? 0,
    totalPaid,
  }
}

export default async function DashboardPage() {
  const user = await getAuthUser()
  if (user) {
    const home = ROLE_HOME[user.role]
    if (home) redirect(home)
  }

  const stats = await getStats()

  return (
    <div>
      <ScreenHeader eyebrow="OPERATIONS" title="Dashboard" />
      <KpiStrip cols={4}>
        <KpiCell label="Clients" value={stats.totalClients} caption={`${stats.activeClients} active`} />
        <KpiCell label="Leads" value={stats.totalLeads.toLocaleString('nl-NL')} />
        <KpiCell label="Deals" value={stats.totalDeals} />
        <KpiCell label="Payments" value={stats.totalPayments} caption={eur(stats.totalPaid)} />
      </KpiStrip>
    </div>
  )
}
