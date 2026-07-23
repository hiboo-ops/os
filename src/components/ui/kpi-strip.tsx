import { type ReactNode } from 'react'
import { Blueprint } from './blueprint'

/** One blueprint frame holding a hairline-divided grid of KPI cells. */
export function KpiStrip({ cols, children }: { cols: number; children: ReactNode }) {
  return (
    <Blueprint className="overflow-hidden">
      <div className="grid -mr-px -mb-px" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {children}
      </div>
    </Blueprint>
  )
}

interface KpiCellProps {
  label: string
  value: string | number
  delta?: string          // e.g. "12%" or "3.1"
  deltaDir?: 'up' | 'down' | 'flat'
  caption?: string
  size?: 'lg' | 'sm'
  danger?: boolean        // value shown in danger color (late/overdue)
}

export function KpiCell({ label, value, delta, deltaDir = 'flat', caption, size = 'lg', danger }: KpiCellProps) {
  const deltaColor = deltaDir === 'up' ? 'text-accent-700' : deltaDir === 'down' ? 'text-[var(--color-danger)]' : 'text-ink/35'
  const arrow = deltaDir === 'up' ? '▲' : deltaDir === 'down' ? '▼' : '—'
  return (
    <div className="border-r border-b border-divider px-4 py-3.5">
      <div className="font-heading font-semibold uppercase text-[9.5px] tracking-[0.13em] text-ink/50">{label}</div>
      <div className="flex items-baseline gap-2 mt-1.5">
        <span className={`font-heading font-semibold tabular-nums leading-none ${size === 'lg' ? 'text-[30px]' : 'text-[24px]'} ${danger ? 'text-[var(--color-danger)]' : 'text-ink'}`}>{value}</span>
        {delta && (
          <span className={`inline-flex items-center gap-0.5 font-heading font-semibold text-[10px] tabular-nums ${deltaColor}`}>
            <span className="text-[8px]">{arrow}</span>{delta}
          </span>
        )}
      </div>
      {caption && <div className="font-body text-[11px] text-ink/45 mt-1">{caption}</div>}
    </div>
  )
}
