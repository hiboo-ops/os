interface KpiCardProps {
  label: string
  value: string | number
  caption?: string
  captionColor?: 'default' | 'green' | 'amber' | 'red'
}

const captionColors = {
  default: 'text-slate-400',
  green: 'text-emerald-600',
  amber: 'text-amber-600',
  red: 'text-red-600',
}

export function KpiCard({ label, value, caption, captionColor = 'default' }: KpiCardProps) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{label}</div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      {caption && (
        <div className={`text-xs mt-1 ${captionColors[captionColor]}`}>{caption}</div>
      )}
    </div>
  )
}
