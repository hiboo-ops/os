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
  closerId: string | null
  setterId: string | null
  coachId: string | null
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
        setAll() {},
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: member } = await supabase
    .from('team_members')
    .select('id, name, role, closer_id, setter_id, coach_id')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (!member) return null

  return {
    id: user.id,
    email: user.email || '',
    name: member.name,
    role: (member as unknown as Record<string, unknown>).role as UserRole,
    teamMemberId: member.id,
    closerId: (member as unknown as Record<string, unknown>).closer_id as string | null,
    setterId: (member as unknown as Record<string, unknown>).setter_id as string | null,
    coachId: (member as unknown as Record<string, unknown>).coach_id as string | null,
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
