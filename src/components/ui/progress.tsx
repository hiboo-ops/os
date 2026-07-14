interface ProgressProps {
  value: number
  max?: number
  color?: 'default' | 'success' | 'warning' | 'danger'
  size?: 'sm' | 'md'
  className?: string
}

const colors = {
  default: 'bg-accent-600',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
}

export function Progress({ value, max = 100, color = 'default', size = 'sm', className = '' }: ProgressProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div className={`w-full bg-gray-100 rounded-full overflow-hidden ${size === 'sm' ? 'h-1.5' : 'h-2.5'} ${className}`}>
      <div
        className={`${colors[color]} h-full rounded-full transition-all duration-300 ease-out`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

interface PhaseIndicatorProps {
  current: number // 0-indexed: 0=Phase1, 1=Phase2, 2=Phase3, 3=Completed
  labels?: string[]
  className?: string
}

export function PhaseIndicator({ current, labels = ['Leren', 'Opdrachten', 'Werk', 'Klaar'], className = '' }: PhaseIndicatorProps) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {labels.map((label, i) => {
        const active = current >= i
        const isCurrent = current === i
        return (
          <div key={i} className="contents">
            {i > 0 && <div className={`flex-1 h-px ${active ? 'bg-accent-600' : 'bg-gray-200'}`} />}
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold transition-colors
                ${active ? 'bg-accent-700 text-white' : 'bg-gray-100 text-gray-400'}
                ${isCurrent ? 'ring-2 ring-accent-200' : ''}`}>
                {active && i < current ? '✓' : i + 1}
              </div>
              <span className={`text-[10px] mt-1 ${active ? 'text-accent-700 font-medium' : 'text-gray-400'}`}>{label}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
