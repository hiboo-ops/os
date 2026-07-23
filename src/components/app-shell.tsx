'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Sidebar } from '@/components/sidebar'

// Paden die een CREATOR (partner-login) mag zien — verder niets.
const CREATOR_ALLOWED = ['/creator-dashboard', '/eod/creator']

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [role, setRole] = useState<string | null>(null)

  // Publieke pagina's zonder app-shell (sidebar)
  const noShell = pathname === '/login' || pathname.startsWith('/partner-onboarding')

  useEffect(() => {
    if (noShell) return
    fetch('/api/me').then(r => r.json()).then(d => setRole(d?.role ?? null)).catch(() => {})
  }, [noShell])

  // Rol-guard: een CREATOR mag alleen zijn eigen dashboard/EOD zien.
  const creatorBlocked = role === 'CREATOR' && !CREATOR_ALLOWED.some(p => pathname.startsWith(p))
  useEffect(() => {
    if (creatorBlocked) router.replace('/creator-dashboard')
  }, [creatorBlocked, router])

  if (noShell) return <>{children}</>

  return (
    <>
      <Sidebar />
      <main className="md:ml-60 min-h-screen pt-14 md:pt-0">
        <div className="px-6 lg:px-8 py-6 lg:py-8">
          {creatorBlocked ? null : children}
        </div>
      </main>
    </>
  )
}
