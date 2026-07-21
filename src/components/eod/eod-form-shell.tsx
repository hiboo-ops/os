'use client'

import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'
import type { RoleType } from '@/lib/queries/eod'

interface EodFormShellProps {
  roleType: RoleType
  title: string
  children: (props: {
    answers: Record<string, Record<string, unknown>>
    onChange: (sectionKey: string, fieldKey: string, value: unknown) => void
  }) => ReactNode
}

function todayString() {
  return new Date().toISOString().slice(0, 10)
}

export function EodFormShell({ roleType, title, children }: EodFormShellProps) {
  const [date, setDate] = useState(todayString)
  const [userName, setUserName] = useState('')
  const [memberId, setMemberId] = useState('')
  const [answers, setAnswers] = useState<Record<string, Record<string, unknown>>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  // Haal user info op
  useEffect(() => {
    fetch('/api/me')
      .then(r => r.json())
      .then(data => {
        if (data?.name) setUserName(data.name)
        if (data?.teamMemberId) setMemberId(data.teamMemberId)
      })
  }, [])

  // Laad bestaande EOD voor deze datum
  const loadExisting = useCallback(async () => {
    if (!memberId) return
    setLoading(true)
    try {
      const res = await fetch(
        `/api/eod?roleType=${roleType}&date=${date}&memberId=${memberId}`
      )
      const data = await res.json()
      if (data?.answers) {
        setAnswers(data.answers)
      } else {
        setAnswers({})
      }
    } catch {
      setAnswers({})
    }
    setLoading(false)
  }, [roleType, date, memberId])

  useEffect(() => {
    loadExisting()
  }, [loadExisting])

  const handleChange = useCallback(
    (sectionKey: string, fieldKey: string, value: unknown) => {
      setAnswers(prev => ({
        ...prev,
        [sectionKey]: {
          ...(prev[sectionKey] || {}),
          [fieldKey]: value,
        },
      }))
      setSaved(false)
    },
    []
  )

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch('/api/eod', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_date: date,
          role_type: roleType,
          answers,
        }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      alert('Opslaan mislukt, probeer het opnieuw.')
    }
    setSaving(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
          <p className="text-sm text-gray-500 mt-0.5">Einde-dag rapportage</p>
        </div>
      </div>

      {/* Header: datum + naam */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Datum
            </label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-accent-700 transition-shadow duration-[120ms]"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Naam
            </label>
            <input
              type="text"
              value={userName}
              disabled
              className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-gray-50 text-gray-500"
            />
          </div>
        </div>
      </div>

      {/* Formulier */}
      {loading ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-sm text-gray-400">
          Laden...
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
          {children({ answers, onChange: handleChange })}
        </div>
      )}

      {/* Opslaan */}
      <div className="flex items-center gap-3">
        <Button variant="primary" size="md" onClick={handleSave} disabled={saving || loading}>
          {saving ? 'Opslaan...' : saved ? (
            <>
              <Check className="w-4 h-4" strokeWidth={1.75} /> Opgeslagen
            </>
          ) : (
            'Opslaan'
          )}
        </Button>
        {saved && (
          <span className="text-sm text-emerald-600">EOD opgeslagen</span>
        )}
      </div>
    </div>
  )
}
