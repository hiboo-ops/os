import { redirect } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getAuthUser } from '@/lib/auth'
import type { UserRole } from '@/lib/auth'
import { KpiCard } from '@/components/ui/card'
import { Users, Target, ClipboardCheck, CreditCard } from 'lucide-react'

export const revalidate = 30

// Niet-admins landen op hun eigen startpagina i.p.v. het bedrijfsbrede dashboard.
const ROLE_HOME: Partial<Record<UserRole, string>> = {
  CLOSER: '/sales',
  SETTER: '/sales/pipeline',
  FINANCE: '/finance',
  PARTNER_MANAGER: '/creators',
  COACH: '/delivery',
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
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Overzicht van Hiboo OS</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Clients" value={stats.totalClients} caption={`${stats.activeClients} actief`} captionColor="success" />
        <KpiCard label="Leads" value={stats.totalLeads} />
        <KpiCard label="Deals" value={stats.totalDeals} />
        <KpiCard label="Payments" value={stats.totalPayments} />
      </div>
    </div>
  )
}
