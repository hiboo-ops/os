'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3, Users, Target, DollarSign, GraduationCap,
  Megaphone, ClipboardCheck, Menu, X, LayoutDashboard,
  Columns3, ListChecks, FileEdit, ChevronDown
} from 'lucide-react'
import { useState } from 'react'

const nav = [
  { href: '/', label: 'Dashboard', icon: BarChart3 },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/leads', label: 'Leads', icon: Target },
  { href: '/deals', label: 'Deals', icon: ClipboardCheck },
  { href: '/finance', label: 'Finance', icon: DollarSign },
  {
    href: '/delivery', label: 'Delivery', icon: GraduationCap,
    children: [
      { href: '/delivery', label: 'Overview', icon: LayoutDashboard },
      { href: '/delivery/crm', label: 'CRM', icon: Columns3 },
      { href: '/delivery/werklijst', label: 'Werklijst', icon: ListChecks },
      { href: '/delivery/backfill', label: 'Backfill', icon: FileEdit },
    ],
  },
  { href: '/creators', label: 'Creators', icon: Megaphone },
]

export function Sidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [deliveryOpen, setDeliveryOpen] = useState(pathname.startsWith('/delivery'))

  return (
    <>
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-slate-200 flex items-center px-4 z-40">
        <button onClick={() => setOpen(true)} className="p-2 rounded-lg hover:bg-slate-100">
          <Menu className="w-5 h-5" />
        </button>
        <span className="ml-3 font-bold text-slate-900">Hiboo</span>
      </div>

      {open && (
        <div className="md:hidden fixed inset-0 bg-black/30 z-40" onClick={() => setOpen(false)} />
      )}

      <aside className={`fixed top-0 left-0 h-full w-64 bg-white border-r border-slate-200 flex flex-col z-50 transition-transform duration-200 md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-5 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-brand-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">H</span>
            </div>
            <div>
              <div className="font-bold text-slate-900 text-base">Hiboo</div>
              <div className="text-xs text-slate-400">Operation System</div>
            </div>
          </div>
          <button onClick={() => setOpen(false)} className="md:hidden p-1 rounded hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {nav.map((item) => {
            const Icon = item.icon
            const isDelivery = !!item.children
            const active = isDelivery
              ? pathname.startsWith(item.href)
              : pathname === item.href

            if (isDelivery) {
              return (
                <div key={item.href}>
                  <button
                    onClick={() => setDeliveryOpen(!deliveryOpen)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                      active ? 'bg-brand-600/12 text-brand-600 font-semibold' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="flex-1 text-left">{item.label}</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${deliveryOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {deliveryOpen && (
                    <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-slate-100 pl-3">
                      {item.children.map((child) => {
                        const ChildIcon = child.icon
                        const childActive = pathname === child.href
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={() => setOpen(false)}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-all ${
                              childActive ? 'bg-brand-600/12 text-brand-600 font-semibold' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                            }`}
                          >
                            <ChildIcon className="w-3.5 h-3.5" />
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
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  active ? 'bg-brand-600/12 text-brand-600 font-semibold' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="px-5 py-4 border-t border-slate-100 text-xs text-slate-400">
          Hiboo OS v0.5
        </div>
      </aside>
    </>
  )
}
