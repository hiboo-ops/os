import { type HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  elevated?: boolean
}

export function Card({ elevated, className = '', children, ...props }: CardProps) {
  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 ${elevated ? 'shadow-sm' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`px-5 py-4 border-b border-gray-100 ${className}`} {...props}>
      {children}
    </div>
  )
}

export function CardContent({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`px-5 py-4 ${className}`} {...props}>
      {children}
    </div>
  )
}

interface KpiCardProps {
  label: string
  value: string | number
  caption?: string
  captionColor?: 'default' | 'success' | 'warning' | 'danger'
}

const captionColors = {
  default: 'text-gray-400',
  success: 'text-emerald-600',
  warning: 'text-amber-600',
  danger: 'text-red-600',
}

export function KpiCard({ label, value, caption, captionColor = 'default' }: KpiCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</div>
      <div className="text-2xl font-bold text-gray-900 tabular-nums">{value}</div>
      {caption && (
        <div className={`text-xs mt-1 ${captionColors[captionColor]}`}>{caption}</div>
      )}
    </div>
  )
}
