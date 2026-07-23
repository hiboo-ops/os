import { type ReactNode } from 'react'
import { Blueprint } from './blueprint'

/** Blueprint panel with an uppercase title header + optional right-side action. */
export function Panel({ title, action, children, className = '', bodyClass = 'p-4' }: {
  title?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClass?: string
}) {
  return (
    <Blueprint className={className}>
      {title && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-divider">
          <h3 className="font-heading font-semibold uppercase text-[12.5px] tracking-[0.08em] text-ink">{title}</h3>
          {action}
        </div>
      )}
      <div className={bodyClass}>{children}</div>
    </Blueprint>
  )
}

/** Square segmented control — active segment = accent fill, white text. */
export function SegmentedControl<T extends string>({ options, value, onChange, size = 'md' }: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  size?: 'sm' | 'md'
}) {
  const h = size === 'sm' ? 'h-8 text-[10.5px] px-2.5' : 'h-9 text-[11px] px-3'
  return (
    <div className="inline-flex border border-divider">
      {options.map((o, i) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`${h} font-heading font-semibold uppercase tracking-[0.05em] transition-colors duration-[120ms] ${i > 0 ? 'border-l border-divider' : ''} ${
            value === o.value ? 'bg-accent text-white' : 'text-ink/55 hover:bg-accent-100 hover:text-accent-800'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Eyebrow + screen title header block (Industry topbar language). */
export function ScreenHeader({ eyebrow, title, right }: { eyebrow?: string; title: string; right?: ReactNode }) {
  return (
    <div className="flex items-end justify-between mb-6">
      <div>
        {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
        <h1 className="font-heading font-semibold uppercase text-[20px] tracking-[-0.01em] text-ink leading-none">{title}</h1>
      </div>
      {right && <div className="flex items-center gap-3">{right}</div>}
    </div>
  )
}
