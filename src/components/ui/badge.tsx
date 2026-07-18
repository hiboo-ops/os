const styles: Record<string, string> = {
  // Status — desaturated, professional
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ONBOARDING: 'bg-sky-50 text-sky-700 border-sky-200',
  PAUSED: 'bg-amber-50 text-amber-700 border-amber-200',
  COMPLETED: 'bg-violet-50 text-violet-700 border-violet-200',
  CHURNED: 'bg-red-50 text-red-700 border-red-200',
  BLOCKED: 'bg-gray-100 text-gray-600 border-gray-200',
  BACKFILL: 'bg-violet-50 text-violet-600 border-violet-200',
  'ATHENA CIRCLE': 'bg-indigo-50 text-indigo-600 border-indigo-200',
  'HIBOO': 'bg-gray-900 text-white border-gray-900',
  'SALES-PARTNER': 'bg-sky-50 text-sky-700 border-sky-200',
  'SALES-QUIZ': 'bg-cyan-50 text-cyan-700 border-cyan-200',

  // Upsell
  'N/A': 'bg-gray-50 text-gray-500 border-gray-200',
  'READY FOR UPSELL': 'bg-amber-50 text-amber-700 border-amber-200',
  'IN CONVERSATION': 'bg-orange-50 text-orange-700 border-orange-200',
  RENEWED: 'bg-emerald-50 text-emerald-700 border-emerald-200',

  // Kanban
  'ON TRACK': 'bg-blue-50 text-blue-700 border-blue-200',
  'NEEDS ATTENTION': 'bg-amber-50 text-amber-700 border-amber-200',
  STOPPED: 'bg-red-50 text-red-700 border-red-200',

  // Homework
  'NOT STARTED': 'bg-gray-50 text-gray-500 border-gray-200',
  'IN PROGRESS': 'bg-blue-50 text-blue-700 border-blue-200',
  DONE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  OVERDUE: 'bg-red-50 text-red-700 border-red-200',

  // Payment
  PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  OPEN: 'bg-blue-50 text-blue-700 border-blue-200',
  LEGACY: 'bg-gray-50 text-gray-500 border-gray-200',

  // Deal
  'FIRST DEAL': 'bg-blue-50 text-blue-700 border-blue-200',
  UPSELL: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  RENEWAL: 'bg-violet-50 text-violet-700 border-violet-200',
  'CLOSED WON': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'CLOSED LOST': 'bg-red-50 text-red-700 border-red-200',

  // Homework status
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  SUBMITTED: 'bg-amber-50 text-amber-700 border-amber-200',
  REDO: 'bg-red-50 text-red-700 border-red-200',
  NOT_SUBMITTED: 'bg-gray-50 text-gray-500 border-gray-200',

  // Team
  INACTIVE: 'bg-gray-50 text-gray-500 border-gray-200',

  // Lead triage stages
  LEAD: 'bg-blue-50 text-blue-700 border-blue-200',
  'ATTEMPT 1': 'bg-amber-50 text-amber-700 border-amber-200',
  'ATTEMPT 2': 'bg-orange-50 text-orange-700 border-orange-200',
  'ATTEMPT 3': 'bg-rose-50 text-rose-700 border-rose-200',
  'ATTEMPT 4': 'bg-red-50 text-red-700 border-red-200',
  'TO SETTER': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'NOT QUALIFIED': 'bg-gray-50 text-gray-500 border-gray-200',
  ATHENA: 'bg-indigo-50 text-indigo-600 border-indigo-200',

  // Sales pipeline / Call results
  NEW: 'bg-gray-50 text-gray-700 border-gray-200',
  RESCHEDULE: 'bg-amber-50 text-amber-700 border-amber-200',
  CONTACTED: 'bg-sky-50 text-sky-700 border-sky-200',
  'PRE CALL': 'bg-blue-50 text-blue-700 border-blue-200',
  'OFFER ACCEPTED': 'bg-violet-50 text-violet-700 border-violet-200',
  'FOLLOW UP': 'bg-orange-50 text-orange-700 border-orange-200',
  LTFU: 'bg-rose-50 text-rose-700 border-rose-200',
  DEAL: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'NO SHOW': 'bg-red-50 text-red-700 border-red-200',
  'NO DEAL': 'bg-red-50 text-red-600 border-red-200',
  BROKE: 'bg-gray-50 text-gray-600 border-gray-200',
  CANCEL: 'bg-gray-50 text-gray-500 border-gray-200',

  // Verdienmodel
  'HIGH TICKET CLOSING': 'bg-violet-50 text-violet-700 border-violet-200',
  HIGH_TICKET_CLOSING: 'bg-violet-50 text-violet-700 border-violet-200',
  VA: 'bg-sky-50 text-sky-700 border-sky-200',
  'VIRTUAL ASSISTANT': 'bg-sky-50 text-sky-700 border-sky-200',
  APPOINTMENT_SETTING: 'bg-amber-50 text-amber-700 border-amber-200',
  'APPOINTMENT SETTING': 'bg-amber-50 text-amber-700 border-amber-200',
}

interface BadgeProps {
  status: string
  className?: string
  size?: 'sm' | 'md'
}

export function Badge({ status, className = '', size = 'sm' }: BadgeProps) {
  const style = styles[status] ?? 'bg-gray-50 text-gray-600 border-gray-200'
  const sizeClass = size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1'

  return (
    <span className={`inline-flex items-center font-medium rounded-md border leading-none ${style} ${sizeClass} ${className}`}>
      {status}
    </span>
  )
}

// Backwards compatible export
export { Badge as StatusBadge }
