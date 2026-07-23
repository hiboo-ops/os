'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3, Users, Target, DollarSign, GraduationCap,
  Megaphone, ClipboardCheck, Menu, X, LayoutDashboard,
  Columns3, ListChecks, FileEdit, ChevronDown, BookOpen,
  Phone, Kanban, CalendarDays, Handshake, Calendar,
  ClipboardList, Inbox, Coins
} from 'lucide-react'
import { useState, useEffect } from 'react'

type UserRole = 'ADMIN' | 'CLOSER' | 'SETTER' | 'COACH' | 'FINANCE' | 'PARTNER_MANAGER' | 'CREATOR'

interface NavItem {
  href: string
  label: string
  icon: typeof BarChart3
  roles?: UserRole[] // if undefined, visible to all
  children?: NavItem[]
}

const nav: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: BarChart3, roles: ['ADMIN'] },
  { href: '/clients', label: 'Clients', icon: Users, roles: ['ADMIN'] },
  {
    href: '/leads', label: 'Leads', icon: Target, roles: ['ADMIN'],
    children: [
      { href: '/leads', label: 'Board', icon: Kanban },
      { href: '/leads/analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    href: '/sales', label: 'Sales', icon: Phone, roles: ['ADMIN', 'CLOSER'],
    children: [
      { href: '/sales', label: 'Overview', icon: LayoutDashboard, roles: ['ADMIN', 'CLOSER'] },
      { href: '/sales/pipeline', label: 'Pipeline', icon: Kanban, roles: ['ADMIN', 'CLOSER'] },
      { href: '/sales/today', label: 'Today', icon: CalendarDays, roles: ['ADMIN', 'CLOSER'] },
    ],
  },
  {
    href: '/sales/pipeline', label: 'Setting', icon: ListChecks, roles: ['ADMIN', 'SETTER'],
    children: [
      { href: '/sales/pipeline', label: 'Booked calls', icon: Kanban },
      { href: '/eod/setter/dashboard', label: 'EOD dashboard', icon: BarChart3 },
      { href: '/eod/setter', label: 'EOD invullen', icon: ClipboardList },
    ],
  },
  {
    href: '/finance', label: 'Finance', icon: DollarSign, roles: ['ADMIN', 'FINANCE'],
    children: [
      { href: '/finance', label: 'Overzicht', icon: LayoutDashboard, roles: ['ADMIN', 'FINANCE'] },
      { href: '/finance/collections', label: 'Collections', icon: Inbox, roles: ['ADMIN', 'FINANCE'] },
      { href: '/finance/accounts', label: 'Accounts', icon: Users, roles: ['ADMIN', 'FINANCE'] },
      { href: '/finance/team-costs', label: 'Team Costs', icon: Coins, roles: ['ADMIN', 'FINANCE'] },
      { href: '/finance/verificatie', label: 'Verificatie', icon: ClipboardCheck, roles: ['ADMIN'] },
      { href: '/eod/finance', label: 'EOD', icon: ClipboardList, roles: ['ADMIN', 'FINANCE'] },
    ],
  },
  { href: '/creators', label: 'Creators', icon: Megaphone, roles: ['ADMIN', 'PARTNER_MANAGER'] },
  {
    href: '/partner-manager', label: 'Partner Manager', icon: Handshake, roles: ['ADMIN', 'PARTNER_MANAGER'],
    children: [
      { href: '/partner-manager', label: 'Overview', icon: LayoutDashboard },
      { href: '/creators', label: 'Creators', icon: Megaphone },
      { href: '/partner-manager/crm', label: 'CRM', icon: Columns3 },
      { href: '/eod/partner-manager', label: 'EOD', icon: ClipboardList },
    ],
  },
  // Creator zelf-login: eigen dashboard + EOD
  { href: '/creator-dashboard', label: 'Mijn dashboard', icon: LayoutDashboard, roles: ['CREATOR'] },
  { href: '/eod/creator', label: 'EOD', icon: ClipboardList, roles: ['CREATOR'] },
  {
    href: '/delivery', label: 'Delivery', icon: GraduationCap, roles: ['ADMIN', 'COACH'],
    children: [
      { href: '/delivery', label: 'Overview', icon: LayoutDashboard },
      { href: '/delivery/crm', label: 'CRM', icon: Columns3 },
      { href: '/delivery/werklijst', label: 'Werklijst', icon: ListChecks },
      { href: '/delivery/course-only', label: 'Course Only', icon: BookOpen },
      { href: '/delivery/backfill', label: 'Backfill', icon: FileEdit },
    ],
  },
  { href: '/eod', label: 'EOD Overzicht', icon: ClipboardCheck, roles: ['ADMIN'] },
  { href: '/admin', label: 'Admin', icon: ClipboardCheck, roles: ['ADMIN'] },
]

export function Sidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    '/delivery': pathname.startsWith('/delivery'),
    '/sales': pathname.startsWith('/sales'),
    '/sales/pipeline': pathname.startsWith('/sales/pipeline') || pathname.startsWith('/eod/setter'),
    '/leads': pathname.startsWith('/leads'),
    '/finance': pathname.startsWith('/finance') || pathname === '/eod/finance',
    '/partner-manager': pathname.startsWith('/partner-manager') || pathname.startsWith('/creators') || pathname === '/eod/partner-manager',
  })
  const [userRole, setUserRole] = useState<UserRole | null>(null)

  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(data => {
      if (data.role) setUserRole(data.role)
    }).catch(() => setUserRole('ADMIN')) // fallback
  }, [])

  const toggleExpanded = (href: string) => setExpanded(prev => ({ ...prev, [href]: !prev[href] }))

  const visibleNav = nav.filter(item => !item.roles || !userRole || item.roles.includes(userRole))

  const navItemCls = 'w-full flex items-center gap-2.5 px-3 py-2 font-heading font-semibold uppercase text-[12.5px] tracking-[0.05em] transition-colors duration-[120ms]'

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-divider flex items-center px-4 z-40">
        <button onClick={() => setOpen(true)} className="p-2 -ml-2 hover:bg-accent-100 transition-colors duration-[120ms]">
          <Menu className="w-5 h-5 text-ink/60" />
        </button>
        <span className="ml-2 font-heading font-semibold uppercase tracking-[0.05em] text-ink">Hiboo OS</span>
      </div>

      {/* Mobile overlay */}
      {open && <div className="md:hidden fixed inset-0 bg-black/20 z-40" onClick={() => setOpen(false)} />}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full w-[236px] bg-white border-r border-divider flex flex-col z-50 transition-transform duration-200 md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Brand block */}
        <div className="flex items-center justify-between h-[66px] px-5 border-b border-divider">
          <div className="flex items-center gap-2.5">
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
          <button onClick={() => setOpen(false)} className="md:hidden p-1 hover:bg-accent-100">
            <X className="w-4 h-4 text-ink/40" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {visibleNav.map((item) => {
            const Icon = item.icon
            const hasChildren = 'children' in item && item.children
            const active = hasChildren ? pathname.startsWith(item.href) : pathname === item.href

            if (hasChildren) {
              return (
                <div key={item.href}>
                  <button
                    onClick={() => toggleExpanded(item.href)}
                    className={`${navItemCls} ${active ? 'text-accent-800' : 'text-ink/55 hover:bg-accent-100 hover:text-accent-800'}`}
                  >
                    <Icon className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                    <span className="flex-1 text-left">{item.label}</span>
                    <ChevronDown className={`w-3.5 h-3.5 text-ink/35 transition-transform duration-[160ms] ${expanded[item.href] ? 'rotate-180' : ''}`} />
                  </button>
                  {expanded[item.href] && (
                    <div className="ml-[19px] mt-0.5 space-y-0.5 border-l border-divider pl-2">
                      {item.children!.filter(c => !c.roles || !userRole || c.roles.includes(userRole)).map((child) => {
                        const ChildIcon = child.icon
                        const childActive = pathname === child.href
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={() => setOpen(false)}
                            style={childActive ? { boxShadow: 'inset 2px 0 0 var(--color-accent)' } : undefined}
                            className={`flex items-center gap-2 px-2.5 py-1.5 font-heading font-semibold uppercase text-[12px] tracking-[0.05em] transition-colors duration-[120ms] ${
                              childActive ? 'text-accent-800 bg-accent-100' : 'text-ink/50 hover:text-accent-800 hover:bg-accent-100'
                            }`}
                          >
                            <ChildIcon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
                            {child.label}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`${navItemCls} ${active ? 'text-accent-800 bg-accent-100' : 'text-ink/55 hover:bg-accent-100 hover:text-accent-800'}`}
              >
                <Icon className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-divider flex items-center justify-between">
          <span className="font-body font-medium text-[10px] text-ink/40 tracking-[0.04em]">HIBOO OS · v0.8</span>
          {userRole && (
            <span className="font-heading font-semibold uppercase text-[9.5px] tracking-[0.06em] text-ink/55 border border-divider px-1.5 py-0.5">{userRole}</span>
          )}
        </div>
      </aside>
    </>
  )
}
