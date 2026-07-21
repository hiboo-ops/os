'use client'

import { type ReactNode } from 'react'

interface EodSectionProps {
  title: string
  children: ReactNode
}

export function EodSection({ title, children }: EodSectionProps) {
  return (
    <div className="border-b border-gray-100 pb-6 mb-6 last:border-0 last:pb-0 last:mb-0">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
    </div>
  )
}
