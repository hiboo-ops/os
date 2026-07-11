import { supabase } from '@/lib/supabase'

export const revalidate = 30

async function getStats() {
  const [clients, leads, deals, payments] = await Promise.all([
    supabase.from('clients').select('id', { count: 'exact', head: true }),
    supabase.from('leads').select('id', { count: 'exact', head: true }),
    supabase.from('deals').select('id', { count: 'exact', head: true }),
    supabase.from('payments').select('id', { count: 'exact', head: true }),
  ])

  return {
    totalClients: clients.count ?? 0,
    totalLeads: leads.count ?? 0,
    totalDeals: deals.count ?? 0,
    totalPayments: payments.count ?? 0,
  }
}

export default async function DashboardPage() {
  const stats = await getStats()

  const cards = [
    { label: 'CLIENTS', value: stats.totalClients },
    { label: 'LEADS', value: stats.totalLeads },
    { label: 'DEALS', value: stats.totalDeals },
    { label: 'PAYMENTS', value: stats.totalPayments },
  ]

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900 mb-6">Dashboard</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{card.label}</div>
            <div className="text-2xl font-bold text-slate-900">{card.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
