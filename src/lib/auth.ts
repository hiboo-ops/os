import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export type UserRole = 'ADMIN' | 'CLOSER' | 'SETTER' | 'COACH' | 'FINANCE'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: UserRole
  teamMemberId: string
}

export async function getAuthUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {
          // Read-only in API routes
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Lookup team member
  const { data: member } = await supabase
    .from('team_members')
    .select('id, name, role')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (!member) return null

  return {
    id: user.id,
    email: user.email || '',
    name: member.name,
    role: member.role as UserRole,
    teamMemberId: member.id,
  }
}

export function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

export function requireAuth(user: AuthUser | null): NextResponse | null {
  if (!user) return unauthorized()
  return null
}

export function requireRole(user: AuthUser | null, roles: UserRole[]): NextResponse | null {
  if (!user) return unauthorized()
  if (!roles.includes(user.role)) return forbidden()
  return null
}
