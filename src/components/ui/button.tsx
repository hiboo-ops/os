import { forwardRef, type ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent-700 text-white hover:bg-accent-800 active:bg-accent-900',
  secondary: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 active:bg-gray-100',
  ghost: 'text-gray-600 hover:bg-gray-100 active:bg-gray-200',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className = '', disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled}
      className={`inline-flex items-center justify-center font-medium rounded-lg transition-colors duration-[120ms] ease-out
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600
        disabled:opacity-40 disabled:pointer-events-none
        ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
)
Button.displayName = 'Button'
