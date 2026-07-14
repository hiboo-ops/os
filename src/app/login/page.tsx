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

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-10">
          <div className="w-8 h-8 rounded-md bg-accent-700 flex items-center justify-center">
            <span className="text-white font-bold text-sm">H</span>
          </div>
          <span className="font-semibold text-gray-900 text-lg">Hiboo</span>
        </div>

        <h1 className="text-lg font-semibold text-gray-900 text-center mb-1">Inloggen</h1>
        <p className="text-sm text-gray-500 text-center mb-8">Log in om verder te gaan</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="admin@hiboo.nl"
              className="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-accent-600 focus:border-transparent transition-shadow duration-[120ms]"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">Wachtwoord</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-accent-600 focus:border-transparent transition-shadow duration-[120ms]"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.75} />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 bg-accent-700 text-white rounded-lg text-sm font-medium hover:bg-accent-800 transition-colors duration-[120ms] disabled:opacity-40"
          >
            {loading ? 'Bezig...' : 'Inloggen'}
          </button>
        </form>
      </div>
    </div>
  )
}
