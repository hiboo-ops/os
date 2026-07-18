'use client'

import { useState, useEffect, useMemo } from 'react'
import { SkeletonPage } from '@/components/ui/skeleton'
import { eur, formatDate } from '@/lib/format'
import { getAllCalls } from '@/lib/queries/sales'
import type { Call, CallResult } from '@/lib/queries/sales'
import { User, Calendar, DollarSign } from 'lucide-react'

const iconProps = { strokeWidth: 1.75 } as const

// Pipeline columns in order
const STAGES: { key: CallResult; label: string; color: string; borderColor: string }[] = [
  { key: 'NEW',             label: 'New',             color: 'bg-gray-50 text-gray-700',     borderColor: 'border-l-gray-400' },
  { key: 'RESCHEDULE',      label: 'Reschedule',      color: 'bg-amber-50 text-amber-700',   borderColor: 'border-l-amber-400' },
  { key: 'CONTACTED',       label: 'Contacted',       color: 'bg-sky-50 text-sky-700',       borderColor: 'border-l-sky-400' },
  { key: 'PRE CALL',        label: 'Pre Call',        color: 'bg-blue-50 text-blue-700',     borderColor: 'border-l-blue-400' },
  { key: 'OFFER ACCEPTED',  label: 'Offer Accepted',  color: 'bg-violet-50 text-violet-700', borderColor: 'border-l-violet-400' },
  { key: 'FOLLOW UP',       label: 'Follow Up',       color: 'bg-orange-50 text-orange-700', borderColor: 'border-l-orange-400' },
  { key: 'LTFU',            label: 'LTFU',            color: 'bg-rose-50 text-rose-700',     borderColor: 'border-l-rose-400' },
  { key: 'DEAL',            label: 'Deal',            color: 'bg-emerald-50 text-emerald-700', borderColor: 'border-l-emerald-500' },
  { key: 'NO SHOW',         label: 'No Show',         color: 'bg-red-50 text-red-700',       borderColor: 'border-l-red-400' },
  { key: 'NO DEAL',         label: 'No Deal',         color: 'bg-red-50 text-red-600',       borderColor: 'border-l-red-300' },
  { key: 'BROKE',           label: 'Broke',           color: 'bg-gray-50 text-gray-600',     borderColor: 'border-l-gray-300' },
  { key: 'CANCEL',          label: 'Cancel',          color: 'bg-gray-50 text-gray-500',     borderColor: 'border-l-gray-300' },
]

export default function PipelinePage() {
  const [calls, setCalls] = useState<Call[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAllCalls().then(data => {
      setCalls(data)
      setLoading(false)
    })
  }, [])

  const grouped = useMemo(() => {
    const map: Record<string, Call[]> = {}
    for (const stage of STAGES) {
      map[stage.key] = []
    }
    for (const call of calls) {
      const result = call.result || 'NEW'
      if (map[result]) {
        map[result].push(call)
      } else {
        map['NEW'].push(call)
      }
    }
    return map
  }, [calls])

  if (loading) return <SkeletonPage />

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Pipeline</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          <span className="tabular-nums">{calls.length}</span> calls in de pipeline
        </p>
      </div>

      {/* Kanban board */}
      <div className="overflow-x-auto -mx-6 px-6 pb-4">
        <div className="flex gap-3" style={{ minWidth: STAGES.length * 260 }}>
          {STAGES.map(stage => {
            const stageCalls = grouped[stage.key] || []
            const totalValue = stageCalls.reduce((sum, c) => sum + (c.deal_value || 0), 0)

            return (
              <div key={stage.key} className="w-[260px] flex-shrink-0">
                {/* Column header */}
                <div className="mb-3">
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center text-xs font-medium rounded-md px-2 py-1 ${stage.color}`}>
                      {stage.label}
                    </span>
                    <span className="text-xs text-gray-400 tabular-nums">{stageCalls.length}</span>
                  </div>
                  {totalValue > 0 && (
                    <div className="text-[11px] text-gray-400 mt-1 tabular-nums">{eur(totalValue)}</div>
                  )}
                </div>

                {/* Cards */}
                <div className="space-y-2 min-h-[200px]">
                  {stageCalls.map(call => (
                    <div
                      key={call.id}
                      onClick={() => console.log('Open call detail:', call.id, call)}
                      className={`bg-white rounded-lg border border-gray-200 ${stage.borderColor} border-l-[3px] p-3.5 cursor-pointer hover:border-gray-300 transition-colors duration-[120ms]`}
                    >
                      {/* Name */}
                      <div className="font-medium text-sm text-gray-900 truncate">
                        {call.name || 'Onbekend'}
                      </div>

                      {/* Date */}
                      {call.date_start_time && (
                        <div className="flex items-center gap-1.5 mt-1.5 text-xs text-gray-500">
                          <Calendar className="w-3 h-3 text-gray-400" {...iconProps} />
                          <span className="tabular-nums">{formatDate(call.date_start_time)}</span>
                        </div>
                      )}

                      {/* Closer / Setter */}
                      <div className="flex items-center gap-3 mt-2">
                        {call.closer && (
                          <div className="flex items-center gap-1 text-[11px] text-gray-500">
                            <User className="w-3 h-3 text-gray-400" {...iconProps} />
                            <span className="truncate max-w-[80px]">{call.closer.name}</span>
                          </div>
                        )}
                        {call.setter && (
                          <div className="flex items-center gap-1 text-[11px] text-gray-400">
                            <span className="truncate max-w-[80px]">S: {call.setter.name}</span>
                          </div>
                        )}
                      </div>

                      {/* Source */}
                      {call.source && (
                        <div className="mt-2">
                          <span className="inline-flex text-[10px] font-medium bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">
                            {call.source}
                          </span>
                        </div>
                      )}

                      {/* Deal value */}
                      {call.deal_value != null && call.deal_value > 0 && (
                        <div className="flex items-center gap-1 mt-2 text-xs font-medium text-emerald-700 tabular-nums">
                          <DollarSign className="w-3 h-3" {...iconProps} />
                          {eur(call.deal_value)}
                        </div>
                      )}
                    </div>
                  ))}

                  {stageCalls.length === 0 && (
                    <div className="rounded-lg border border-dashed border-gray-200 p-4 text-center">
                      <span className="text-xs text-gray-400">Geen calls</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
