'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3, Users, Target, DollarSign, GraduationCap,
  Megaphone, ClipboardCheck, Menu, X, LayoutDashboard,
  Columns3, ListChecks, FileEdit, ChevronDown, BookOpen,
  Phone, Kanban, CalendarDays, CreditCard, Handshake, Calendar
} from 'lucide-react'
import { useState } from 'react'

const nav = [
  { href: '/', label: 'Dashboard', icon: BarChart3 },
  { href: '/clients', label: 'Clients', icon: Users },
  {
    href: '/leads', label: 'Leads', icon: Target,
    children: [
      { href: '/leads', label: 'Board', icon: Kanban },
      { href: '/leads/analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    href: '/sales', label: 'Sales', icon: Phone,
    children: [
      { href: '/sales', label: 'Overview', icon: LayoutDashboard },
      { href: '/sales/pipeline', label: 'Pipeline', icon: Kanban },
      { href: '/sales/today', label: 'Today', icon: CalendarDays },
      { href: '/sales/installments', label: 'Installments', icon: CreditCard },
      { href: '/sales/deals', label: 'Deals', icon: Handshake },
    ],
  },
  { href: '/finance', label: 'Finance', icon: DollarSign },
  {
    href: '/delivery', label: 'Delivery', icon: GraduationCap,
    children: [
      { href: '/delivery', label: 'Overview', icon: LayoutDashboard },
      { href: '/delivery/crm', label: 'CRM', icon: Columns3 },
      { href: '/delivery/werklijst', label: 'Werklijst', icon: ListChecks },
      { href: '/delivery/course-only', label: 'Course Only', icon: BookOpen },
      { href: '/delivery/backfill', label: 'Backfill', icon: FileEdit },
    ],
  },
  { href: '/creators', label: 'Creators', icon: Megaphone },
  { href: '/admin', label: 'Admin', icon: ClipboardCheck },
]

export function Sidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    '/delivery': pathname.startsWith('/delivery'),
    '/sales': pathname.startsWith('/sales'),
    '/leads': pathname.startsWith('/leads'),
  })
  const toggleExpanded = (href: string) => setExpanded(prev => ({ ...prev, [href]: !prev[href] }))

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 flex items-center px-4 z-40">
        <button onClick={() => setOpen(true)} className="p-2 -ml-2 rounded-md hover:bg-gray-100 transition-colors duration-[120ms]">
          <Menu className="w-5 h-5 text-gray-600" />
        </button>
        <span className="ml-2 text-sm font-semibold text-gray-900">Hiboo</span>
      </div>

      {/* Mobile overlay */}
      {open && <div className="md:hidden fixed inset-0 bg-black/20 z-40" onClick={() => setOpen(false)} />}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full w-60 bg-white border-r border-gray-200 flex flex-col z-50 transition-transform duration-200 md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Logo */}
        <div className="flex items-center justify-between h-14 px-5 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-accent-700 flex items-center justify-center">
              <span className="text-white font-bold text-xs">H</span>
            </div>
            <span className="font-semibold text-gray-900 text-sm">Hiboo</span>
          </div>
          <button onClick={() => setOpen(false)} className="md:hidden p-1 rounded-md hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {nav.map((item) => {
            const Icon = item.icon
            const hasChildren = 'children' in item && item.children
            const active = hasChildren
              ? pathname.startsWith(item.href)
              : pathname === item.href

            if (hasChildren) {
              return (
                <div key={item.href}>
                  <button
                    onClick={() => toggleExpanded(item.href)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] transition-colors duration-[120ms] ${
                      active ? 'text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" strokeWidth={1.75} />
                    <span className="flex-1 text-left">{item.label}</span>
                    <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-[160ms] ${expanded[item.href] ? 'rotate-180' : ''}`} />
                  </button>
                  {expanded[item.href] && (
                    <div className="ml-[18px] mt-0.5 space-y-0.5 border-l border-gray-100 pl-2.5">
                      {item.children!.map((child) => {
                        const ChildIcon = child.icon
                        const childActive = pathname === child.href
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={() => setOpen(false)}
                            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] transition-colors duration-[120ms] ${
                              childActive ? 'text-gray-900 font-medium bg-gray-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <ChildIcon className="w-3.5 h-3.5" strokeWidth={1.75} />
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
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] transition-colors duration-[120ms] ${
                  active ? 'text-gray-900 font-medium bg-gray-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4" strokeWidth={1.75} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100">
          <span className="text-[11px] text-gray-400">Hiboo OS v0.6</span>
        </div>
      </aside>
    </>
  )
}
