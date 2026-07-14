'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLogin = pathname === '/login'

  if (isLogin) return <>{children}</>

  return (
    <>
      <Sidebar />
      <main className="md:ml-60 min-h-screen pt-14 md:pt-0">
        <div className="px-6 lg:px-8 py-6 lg:py-8">
          {children}
        </div>
      </main>
    </>
  )
}
