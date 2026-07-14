type AvatarSize = 'sm' | 'md' | 'lg'
type StatusColor = 'green' | 'yellow' | 'red' | null

const sizeClasses: Record<AvatarSize, { container: string; text: string; dot: string; dotRing: string }> = {
  sm: { container: 'w-7 h-7', text: 'text-[10px]', dot: 'w-2.5 h-2.5 -bottom-0.5 -right-0.5', dotRing: 'ring-[1.5px]' },
  md: { container: 'w-9 h-9', text: 'text-xs', dot: 'w-3 h-3 -bottom-0.5 -right-0.5', dotRing: 'ring-2' },
  lg: { container: 'w-12 h-12', text: 'text-sm', dot: 'w-3.5 h-3.5 -bottom-0.5 -right-0.5', dotRing: 'ring-2' },
}

const dotColors: Record<string, string> = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-400',
  red: 'bg-red-500',
}

interface AvatarProps {
  name: string
  size?: AvatarSize
  status?: StatusColor
  className?: string
}

export function Avatar({ name, size = 'md', status, className = '' }: AvatarProps) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const s = sizeClasses[size]

  return (
    <div className={`relative shrink-0 ${className}`}>
      <div className={`${s.container} rounded-full bg-gray-200 flex items-center justify-center ${s.text} font-semibold text-gray-600`}>
        {initials}
      </div>
      {status && (
        <div className={`absolute ${s.dot} rounded-full ${dotColors[status]} ${s.dotRing} ring-white`} />
      )}
    </div>
  )
}
