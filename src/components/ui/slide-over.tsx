'use client'

import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface SlideOverProps {
  open: boolean
  onClose: () => void
  title?: string
  subtitle?: string
  headerContent?: ReactNode
  children: ReactNode
  footer?: ReactNode
}

export function SlideOver({ open, onClose, title, subtitle, headerContent, children, footer }: SlideOverProps) {
  // Lock body scroll when open
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Escape key
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-[2px] transition-opacity duration-[240ms]"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-lg border-l border-gray-200 flex flex-col">
        {/* Header */}
        <div className="shrink-0 border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          {headerContent || (
            <div>
              {title && <h2 className="text-base font-semibold text-gray-900">{title}</h2>}
              {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
            </div>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors duration-[120ms]"
            aria-label="Sluiten"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="shrink-0 border-t border-gray-100 px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
