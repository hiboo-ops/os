import { type HTMLAttributes } from 'react'

interface BlueprintProps extends HTMLAttributes<HTMLDivElement> {
  /** tinted accent fill (e.g. alert bars) */
  tint?: boolean
  /** left status spine color (any css color / var) */
  spine?: string
  /** hide the corner registration marks */
  noMarks?: boolean
}

/**
 * The signature "blueprint" frame: a hairline-bordered, square, transparent
 * line-drawing surface with a small "+" registration mark inset at each corner.
 */
export function Blueprint({ tint, spine, noMarks, className = '', children, style, ...props }: BlueprintProps) {
  return (
    <div
      className={`relative border border-divider ${tint ? 'bg-accent-100' : 'bg-white'} ${className}`}
      style={{ ...(spine ? { boxShadow: `inset 3px 0 0 ${spine}` } : {}), ...style }}
      {...props}
    >
      {!noMarks && (
        <>
          <i className="bp-corner bp-tl" />
          <i className="bp-corner bp-tr" />
          <i className="bp-corner bp-bl" />
          <i className="bp-corner bp-br" />
        </>
      )}
      {children}
    </div>
  )
}
