import { type ReactNode } from 'react'

type TagVariant = 'accent' | 'neutral' | 'outline' | 'danger'

const variants: Record<TagVariant, string> = {
  accent: 'bg-accent-100 text-accent-800 border border-transparent',
  neutral: 'bg-neutral-100 text-neutral-600 border border-transparent',
  outline: 'bg-transparent text-neutral-600 border border-divider',
  danger: 'bg-[#f7ecec] text-[var(--color-danger)] border border-transparent',
}

/** Square, condensed, uppercase chrome tag. */
export function Tag({ children, variant = 'neutral', className = '' }: { children: ReactNode; variant?: TagVariant; className?: string }) {
  return (
    <span
      className={`inline-flex items-center font-heading font-semibold uppercase px-1.5 py-0.5 text-[9.5px] leading-none tracking-[0.06em] ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  )
}
