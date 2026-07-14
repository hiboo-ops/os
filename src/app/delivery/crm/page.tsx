'use client'

import { useState, useEffect, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { StudentDetail } from '@/components/student-detail'
import { getCoachesWithStats, getStudentsForPhaseBoard, StudentWithRelations } from '@/lib/queries/delivery'
import { Search } from 'lucide-react'

const iconProps = { strokeWidth: 1.75 } as const

const vmColors: Record<string, string> = { HIGH_TICKET_CLOSING: 'bg-violet-100 text-violet-700', VA: 'bg-sky-100 text-sky-700', APPOINTMENT_SETTING: 'bg-amber-100 text-amber-700' }
const vmShort: Record<string, string> = { HIGH_TICKET_CLOSING: 'HTC', VA: 'VA', APPOINTMENT_SETTING: 'AS' }
const dots: Record<string, string> = { GREEN: 'bg-emerald-400', YELLOW: 'bg-yellow-400', RED: 'bg-red-400' }

const phaseConfig: Record<string, { label: string; border: string; dot: string; desc: string }> = {
  PHASE_1: { label: 'Fase 1 — Leren', border: 'border-cyan-400', dot: 'bg-cyan-400', desc: 'Modules kijken' },
  PHASE_2: { label: 'Fase 2 — Opdrachten', border: 'border-blue-400', dot: 'bg-blue-400', desc: '10 opdrachten' },
  PHASE_3: { label: 'Fase 3 — Opdrachtgevers', border: 'border-purple-400', dot: 'bg-purple-400', desc: 'Gecertificeerd' },
  COMPLETED: { label: 'Afgerond', border: 'border-emerald-400', dot: 'bg-emerald-400', desc: 'Traject klaar' },
}

function initials(name: string) { return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() }

export default function DeliveryCRM() {
  const [coaches, setCoaches] = useState<Awaited<ReturnType<typeof getCoachesWithStats>>>([])
  const [students, setStudents] = useState<StudentWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCoach, setSelectedCoach] = useState('')
  const [selectedStudent, setSelectedStudent] = useState<StudentWithRelations | null>(null)
  const [search, setSearch] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    const [c, s] = await Promise.all([
      getCoachesWithStats(),
      getStudentsForPhaseBoard(selectedCoach || undefined),
    ])
    setCoaches(c)
    setStudents(s)
    setLoading(false)
  }, [selectedCoach])

  useEffect(() => { loadData() }, [loadData])

  // Read coach from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const coach = params.get('coach')
    if (coach) setSelectedCoach(coach)
  }, [])

  const filtered = students.filter(s => {
    if (!search) return true
    return s.name.toLowerCase().includes(search.toLowerCase()) || s.client?.email?.toLowerCase().includes(search.toLowerCase())
  })

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-gray-400">Laden...</div></div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">CRM — Fase Board</h1>
          <p className="text-sm text-gray-500 mt-0.5"><span className="tabular-nums">{filtered.length}</span> studenten</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" {...iconProps} />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Zoek..."
              className="pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white w-48 focus:outline-none focus:ring-2 focus:ring-accent-700" />
          </div>
          <select value={selectedCoach} onChange={e => setSelectedCoach(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white">
            <option value="">Alle coaches</option>
            {coaches.map(c => <option key={c.id} value={c.id}>{c.name} ({c.studenten})</option>)}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-[1100px]">
          {Object.entries(phaseConfig).map(([key, cfg]) => {
            const items = filtered.filter(s => s.phase === key)
            return (
              <div key={key} className="flex-1 min-w-[260px]">
                <div className={`border-t-2 ${cfg.border} bg-white rounded-lg border border-gray-100 overflow-hidden`}>
                  <div className="px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                      <span className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide">{cfg.label}</span>
                      <span className="text-[11px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full ml-auto tabular-nums">{items.length}</span>
                    </div>
                    <p className="text-[11px] text-gray-400 ml-4">{cfg.desc}</p>
                  </div>
                  <div className="p-2 space-y-2 min-h-[200px] max-h-[600px] overflow-y-auto">
                    {items.length === 0 ? <div className="text-[11px] text-gray-300 text-center py-8">Geen studenten</div> :
                      items.map(s => {
                        const cs = { dot: dots[s.activity_status] || dots.GREEN, ring: `ring-${s.activity_status === 'RED' ? 'red' : s.activity_status === 'YELLOW' ? 'yellow' : 'emerald'}-400/30`, bg: s.activity_status === 'RED' ? 'bg-red-50/50' : s.activity_status === 'YELLOW' ? 'bg-yellow-50/50' : '' }
                        return (
                          <div key={s.id} onClick={() => setSelectedStudent(s)}
                            className={`cursor-pointer bg-white border border-gray-100 rounded-lg p-3 ${cs.bg} ring-1 ring-gray-100 hover:border-gray-200 transition duration-[120ms]`}>
                            <div className="flex items-center gap-2 mb-2">
                              <div className="relative">
                                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-[11px] font-semibold text-gray-600">{initials(s.name)}</div>
                                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ${cs.dot} ring-2 ring-white`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-900 truncate">{s.name}</div>
                                <div className="text-[11px] text-gray-400">{s.verdienmodel ? vmShort[s.verdienmodel] || s.verdienmodel : 'Geen VM'}</div>
                              </div>
                            </div>
                            {s.certification_date && <div className="mb-2"><span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">Gecertificeerd</span></div>}
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-gray-400 tabular-nums">{s.coaching_hours || 0}h</span>
                              {s.coach && <span className="text-gray-400">{s.coach.name.split(' ')[0]}</span>}
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {selectedStudent && (
        <StudentDetail student={selectedStudent} onClose={() => setSelectedStudent(null)} onUpdate={() => loadData()} />
      )}
    </div>
  )
}
