'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { KpiCard } from '@/components/ui/card'
import { formatDate } from '@/lib/format'
import { Search } from 'lucide-react'

interface CourseStudent {
  id: string
  name: string
  phase: string | null
  activity_status: string
  certification_date: string | null
  client: {
    id: string
    name: string
    email: string
    phone: string | null
    start_date: string | null
    status: string
    program: string | null
  } | null
}

export default function CourseOnlyPage() {
  const [students, setStudents] = useState<CourseStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('students')
        .select(`
          id, name, phase, activity_status, certification_date,
          client:clients!inner(id, name, email, phone, start_date, status, program)
        `)
        .eq('clients.program', 'FUNDAMENT')
        .order('name')

      setStudents((data || []) as unknown as CourseStudent[])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = students.filter(s => {
    if (!search) return true
    const q = search.toLowerCase()
    return s.name.toLowerCase().includes(q) || s.client?.email?.toLowerCase().includes(q)
  })

  const active = students.filter(s => s.client?.status === 'ACTIVE').length
  const certified = students.filter(s => s.certification_date).length

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-gray-400">Laden...</div></div>

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-gray-900">Course Only</h1>
        <p className="text-sm text-gray-500 mt-1">Studenten met het Fundament pakket</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard label="Totaal" value={students.length} />
        <KpiCard label="Actief" value={active} captionColor="success" />
        <KpiCard label="Gecertificeerd" value={certified} />
        <KpiCard label="Completion" value={students.length > 0 ? `${Math.round((certified / students.length) * 100)}%` : '0%'} />
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" strokeWidth={1.75} />
          <input
            type="text"
            placeholder="Zoek op naam of email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 h-9 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent transition-shadow duration-[120ms]"
          />
        </div>
        <span className="text-xs text-gray-400 tabular-nums">{filtered.length} studenten</span>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100">
                <th className="px-5 py-3">Naam</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Telefoon</th>
                <th className="px-4 py-3">Startdatum</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Fase</th>
                <th className="px-4 py-3">Certificaat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(s => {
                const activityDot = s.activity_status === 'RED' ? 'red' : s.activity_status === 'YELLOW' ? 'yellow' : 'green'
                return (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors duration-[120ms]">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={s.name} size="sm" status={activityDot as 'green' | 'yellow' | 'red'} />
                        <span className="font-medium text-gray-900">{s.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{s.client?.email || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{s.client?.phone || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(s.client?.start_date)}</td>
                    <td className="px-4 py-3"><Badge status={s.client?.status || 'UNKNOWN'} /></td>
                    <td className="px-4 py-3"><Badge status={s.phase || 'PHASE_1'} /></td>
                    <td className="px-4 py-3">
                      {s.certification_date
                        ? <span className="text-xs text-emerald-600 font-medium">{formatDate(s.certification_date)}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
