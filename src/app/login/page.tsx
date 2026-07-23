'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Ongeldige inloggegevens')
      setLoading(false)
      return
    }

    window.location.href = '/'
  }

  const inputCls = 'w-full h-[42px] px-3 text-sm font-body border border-divider bg-white text-ink placeholder:text-ink/30 focus:outline-none focus:ring-2 focus:ring-accent transition-shadow duration-[120ms]'
  const labelCls = 'block font-heading font-semibold uppercase text-[10px] tracking-[0.1em] text-ink/55 mb-1.5'

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left — form */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-[320px]">
          {/* Brand lockup */}
          <div className="flex items-center gap-2.5 mb-10">
            <div className="relative w-[30px] h-[30px] bg-accent flex items-center justify-center">
              <span className="text-white font-heading font-semibold text-[15px] leading-none">H</span>
              <i className="bp-corner bp-tl" style={{ color: 'rgba(255,255,255,0.7)' }} />
              <i className="bp-corner bp-tr" style={{ color: 'rgba(255,255,255,0.7)' }} />
              <i className="bp-corner bp-bl" style={{ color: 'rgba(255,255,255,0.7)' }} />
              <i className="bp-corner bp-br" style={{ color: 'rgba(255,255,255,0.7)' }} />
            </div>
            <div className="leading-none">
              <div className="font-heading font-semibold text-[17px] text-ink tracking-[0.01em]">HIBOO</div>
              <div className="font-body font-medium text-[8px] tracking-[0.22em] text-ink/45 mt-0.5">OPERATING SYSTEM</div>
            </div>
          </div>

          <h1 className="font-heading font-semibold uppercase text-[22px] tracking-[-0.01em] text-ink leading-none">Sign In</h1>
          <p className="font-body text-[13px] text-ink/50 mt-2 mb-8">Log in to continue</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className={labelCls}>Email</label>
              <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" placeholder="admin@hiboo.nl" className={inputCls} />
            </div>
            <div>
              <label htmlFor="password" className={labelCls}>Password</label>
              <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" placeholder="••••••••" className={inputCls} />
            </div>
            {error && (
              <div className="flex items-center gap-2 font-body text-[12.5px] text-[var(--color-danger)] bg-[#f7ecec] border border-[#e8cdcc] px-3 py-2.5">
                <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                {error}
              </div>
            )}
            <button type="submit" disabled={loading} className="w-full h-[42px] bg-accent text-white font-heading font-semibold uppercase text-[12px] tracking-[0.06em] hover:bg-accent-800 transition-colors duration-[120ms] disabled:opacity-40">
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>

      {/* Right — brand panel */}
      <div className="hidden lg:block w-[380px] bg-accent-900 relative overflow-hidden">
        <svg className="absolute inset-0 w-full h-full" style={{ color: 'rgba(255,255,255,0.14)' }} preserveAspectRatio="none">
          {Array.from({ length: 20 }).map((_, i) => <line key={`v${i}`} x1={i * 40} y1="0" x2={i * 40} y2="100%" stroke="currentColor" strokeWidth="1" />)}
          {Array.from({ length: 26 }).map((_, i) => <line key={`h${i}`} x1="0" y1={i * 40} x2="100%" y2={i * 40} stroke="currentColor" strokeWidth="1" />)}
          <polyline points="20,520 90,470 160,500 230,410 300,440 360,360" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
        </svg>
        <div className="absolute bottom-12 left-10 right-10">
          <div className="font-heading font-semibold uppercase text-[26px] leading-[1.1] tracking-[-0.01em] text-white">The Operating System<br />For High-Ticket<br />Coaching.</div>
          <div className="font-body text-[12px] text-white/50 mt-4 tracking-[0.04em]">HIBOO · OPS INTELLIGENCE</div>
        </div>
      </div>
    </div>
  )
}
