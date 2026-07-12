const badgeStyles: Record<string, string> = {
  // Kanban stages
  'ONBOARDING': 'bg-cyan-100 text-cyan-700',
  'ACTIVE': 'bg-emerald-100 text-emerald-700',
  'ON TRACK': 'bg-blue-100 text-blue-700',
  'NEEDS ATTENTION': 'bg-yellow-100 text-yellow-700',
  'PAUSED': 'bg-orange-100 text-orange-700',
  'COMPLETED': 'bg-purple-100 text-purple-700',
  'STOPPED': 'bg-red-100 text-red-700',
  // Upsell statuses
  'N/A': 'bg-slate-100 text-slate-500',
  'READY FOR UPSELL': 'bg-yellow-100 text-yellow-700',
  'IN CONVERSATION': 'bg-orange-100 text-orange-700',
  'RENEWED': 'bg-emerald-100 text-emerald-700',
  // Homework
  'NOT STARTED': 'bg-slate-100 text-slate-500',
  'IN PROGRESS': 'bg-blue-100 text-blue-700',
  'DONE': 'bg-emerald-100 text-emerald-700',
  'OVERDUE': 'bg-red-100 text-red-700',
  // Team status
  'INACTIVE': 'bg-slate-100 text-slate-500',
  // Client
  'BACKFILL': 'bg-purple-100 text-purple-700',
  'CHURNED': 'bg-red-100 text-red-700',
  'BLOCKED': 'bg-slate-200 text-slate-600',
}

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const style = badgeStyles[status] ?? 'bg-slate-100 text-slate-600'
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full ${style} ${className}`}>
      {status}
    </span>
  )
}
