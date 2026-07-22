'use client'

import { useState, useEffect, useMemo } from 'react'
import { SkeletonPage } from '@/components/ui/skeleton'
import { eur, formatDate } from '@/lib/format'
import { getAllCalls } from '@/lib/queries/sales'
import type { Call, CallResult } from '@/lib/queries/sales'
import { CallDetail } from '@/components/call-detail'
import { User, Calendar, DollarSign } from 'lucide-react'

const iconProps = { strokeWidth: 1.75 } as const

// Pipeline columns in order
const STAGES: { key: CallResult; label: string; color: string; borderColor: string; bgTint: string }[] = [
  { key: 'CALL BOOKED',         label: 'BOOKED',              color: 'bg-blue-50 text-blue-700',       borderColor: 'border-l-blue-400',    bgTint: 'bg-blue-50/20' },
  { key: 'RESCHEDULE',          label: 'RESCHEDULE',           color: 'bg-amber-50 text-amber-700',     borderColor: 'border-l-amber-400',   bgTint: 'bg-amber-50/20' },
  { key: 'FOLLOW UP',           label: 'FOLLOW UP',            color: 'bg-orange-50 text-orange-700',   borderColor: 'border-l-orange-400',  bgTint: 'bg-orange-50/20' },
  { key: 'FOLLOW UP LONG TERM', label: 'FOLLOW UP LT',         color: 'bg-rose-50 text-rose-700',       borderColor: 'border-l-rose-400',    bgTint: 'bg-rose-50/20' },
  { key: 'DEPOSIT',             label: 'DEPOSIT',              color: 'bg-violet-50 text-violet-700',   borderColor: 'border-l-violet-400',  bgTint: 'bg-violet-50/20' },
  { key: 'CLOSED',              label: 'CLOSED',               color: 'bg-emerald-50 text-emerald-700', borderColor: 'border-l-emerald-500', bgTint: 'bg-emerald-50/20' },
  { key: 'LOST - BROKE',        label: 'BROKE',                color: 'bg-gray-50 text-gray-500',       borderColor: 'border-l-gray-300',    bgTint: '' },
  { key: 'LOST - NO INTEREST',  label: 'NO INTEREST',          color: 'bg-gray-50 text-gray-500',       borderColor: 'border-l-gray-300',    bgTint: '' },
  { key: 'LOST - BAD FIT',      label: 'BAD FIT',              color: 'bg-gray-50 text-gray-500',       borderColor: 'border-l-gray-300',    bgTint: '' },
  { key: 'NO SHOW',             label: 'NO SHOW',              color: 'bg-red-50 text-red-700',         borderColor: 'border-l-red-400',     bgTint: 'bg-red-50/20' },
  { key: 'CANCELLED BY LEAD',   label: 'CANC. LEAD',           color: 'bg-gray-50 text-gray-600',       borderColor: 'border-l-gray-300',    bgTint: '' },
  { key: 'CANCELLED BY CLOSER', label: 'CANC. CLOSER',         color: 'bg-gray-50 text-gray-600',       borderColor: 'border-l-gray-300',    bgTint: '' },
]

export default function PipelinePage() {
  const [calls, setCalls] = useState<Call[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCall, setSelectedCall] = useState<Call | null>(null)
  const [dragCallId, setDragCallId] = useState<string | null>(null)
  const [dragOverStage, setDragOverStage] = useState<string | null>(null)
  const [closerFilter, setCloserFilter] = useState('')

  const loadCalls = () => {
    getAllCalls().then(data => {
      setCalls(data)
      setLoading(false)
    })
  }

  useEffect(() => {
    loadCalls()
  }, [])

  const closers = useMemo(() =>
    [...new Set(calls.map(c => c.closer?.name).filter(Boolean))].sort() as string[],
    [calls]
  )

  const filteredCalls = useMemo(() => {
    if (!closerFilter) return calls
    return calls.filter(c => c.closer?.name === closerFilter)
  }, [calls, closerFilter])

  const handleDrop = (callId: string, newResult: string) => {
    setDragCallId(null)
    setDragOverStage(null)
    setCalls(prev => prev.map(c => c.id === callId ? { ...c, result: newResult as Call['result'] } : c))
    fetch('/api/calls', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: callId, result: newResult }),
    })
  }

  const grouped = useMemo(() => {
    const map: Record<string, Call[]> = {}
    for (const stage of STAGES) {
      map[stage.key] = []
    }
    for (const call of filteredCalls) {
      const result = call.result || 'CALL BOOKED'
      if (map[result]) {
        map[result].push(call)
      } else {
        map['CALL BOOKED'].push(call)
      }
    }
    return map
  }, [filteredCalls])

  const totalPipelineValue = useMemo(() =>
    filteredCalls.filter(c => c.deal_value).reduce((sum, c) => sum + (c.deal_value || 0), 0),
    [filteredCalls]
  )

  if (loading) return <SkeletonPage />

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Pipeline</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            <span className="tabular-nums">{filteredCalls.length}</span> calls
            {totalPipelineValue > 0 && (
              <span> · <span className="tabular-nums">{eur(totalPipelineValue)}</span> totale waarde</span>
            )}
          </p>
        </div>

        {/* Closer filter */}
        <div className="relative">
          <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" {...iconProps} />
          <select
            value={closerFilter}
            onChange={e => setCloserFilter(e.target.value)}
            className="h-9 text-sm border border-gray-200 rounded-lg pl-8 pr-3 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-accent-500 appearance-none cursor-pointer"
          >
            <option value="">Alle closers</option>
            {closers.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Kanban board */}
      <div className="overflow-x-auto -mx-6 px-6 pb-4">
        <div className="flex gap-2" style={{ minWidth: STAGES.length * 244 }}>
          {STAGES.map(stage => {
            const stageCalls = grouped[stage.key] || []
            const totalValue = stageCalls.reduce((sum, c) => sum + (c.deal_value || 0), 0)

            return (
              <div key={stage.key} className="w-[240px] flex-shrink-0 flex flex-col"
                onDragOver={e => { e.preventDefault(); setDragOverStage(stage.key) }}
                onDragLeave={() => setDragOverStage(null)}
                onDrop={e => { e.preventDefault(); if (dragCallId) handleDrop(dragCallId, stage.key) }}>
                {/* Column header - sticky */}
                <div className="sticky top-0 z-10 bg-white/95 backdrop-blur pb-2">
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center text-[11px] font-medium rounded-md px-1.5 py-0.5 ${stage.color}`}>
                      {stage.label}
                    </span>
                    <span className="inline-flex items-center justify-center min-w-[20px] h-5 bg-gray-100 rounded-full text-[10px] font-medium text-gray-500 tabular-nums px-1.5">
                      {stageCalls.length}
                    </span>
                  </div>
                  {totalValue > 0 && (
                    <div className="text-[10px] text-gray-400 mt-0.5 tabular-nums">{eur(totalValue)}</div>
                  )}
                </div>

                {/* Cards */}
                <div className={`space-y-1.5 min-h-[120px] rounded-lg transition-colors duration-150 ${stage.bgTint} ${dragOverStage === stage.key ? 'ring-2 ring-blue-200 ring-inset bg-blue-50/50' : ''}`}>
                  {stageCalls.map(call => (
                    <div
                      key={call.id}
                      draggable
                      onDragStart={() => setDragCallId(call.id)}
                      onDragEnd={() => { setDragCallId(null); setDragOverStage(null) }}
                      onClick={() => setSelectedCall(call)}
                      className={`bg-white rounded-lg border border-gray-200 ${stage.borderColor} border-l-4 p-2.5 cursor-grab active:cursor-grabbing hover:border-gray-300 transition-colors duration-[120ms] ${dragCallId === call.id ? 'opacity-50' : ''}`}
                    >
                      {/* Name */}
                      <div className="font-medium text-[13px] text-gray-900 truncate">
                        {call.name || 'Unknown'}
                      </div>

                      {/* Date + deal value inline */}
                      <div className="flex items-center justify-between mt-1">
                        {call.date_start_time && (
                          <div className="flex items-center gap-1 text-[11px] text-gray-500">
                            <Calendar className="w-3 h-3 text-gray-400" {...iconProps} />
                            <span className="tabular-nums">{formatDate(call.date_start_time)}</span>
                          </div>
                        )}
                        {call.deal_value != null && call.deal_value > 0 && (
                          <span className="text-[11px] font-medium text-emerald-700 tabular-nums">
                            {eur(call.deal_value)}
                          </span>
                        )}
                      </div>

                      {/* Closer / Setter + Source inline */}
                      <div className="flex items-center justify-between mt-1.5">
                        <div className="flex items-center gap-1 text-[10px] text-gray-500 truncate">
                          {call.closer && (
                            <span className="truncate">C: {call.closer.name}</span>
                          )}
                          {call.closer && call.setter && (
                            <span className="text-gray-300">·</span>
                          )}
                          {call.setter && (
                            <span className="truncate text-gray-400">S: {call.setter.name}</span>
                          )}
                        </div>
                        {call.source && (
                          <span className="inline-flex text-[9px] font-medium bg-gray-100 text-gray-500 rounded px-1 py-0.5 ml-1 shrink-0">
                            {call.source}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}

                  {stageCalls.length === 0 && (
                    <div className="rounded-lg border border-dashed border-gray-200 p-3 text-center">
                      <span className="text-[11px] text-gray-400">Geen calls</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Call Detail slide-out */}
      {selectedCall && (
        <CallDetail
          call={selectedCall}
          onClose={() => setSelectedCall(null)}
          onUpdate={() => loadCalls()}
        />
      )}
    </div>
  )
}
