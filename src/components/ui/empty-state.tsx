import { type LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {Icon && <Icon className="w-10 h-10 text-gray-300 mb-4" strokeWidth={1.5} />}
      <h3 className="text-sm font-semibold text-gray-900 mb-1">{title}</h3>
      {description && <p className="text-sm text-gray-500 max-w-sm">{description}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 inline-flex items-center gap-2 px-4 h-9 bg-accent-700 text-white rounded-lg text-sm font-medium hover:bg-accent-800 transition-colors duration-[120ms]"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
