'use client'

import { useState, useEffect, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { SkeletonPage } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/format'
import { Copy, Check, ChevronDown, ExternalLink } from 'lucide-react'

interface Submission {
  id: string
  created_at: string
  status: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  answers: Record<string, unknown>
  signature: string | null
  signed_date: string | null
}

const STATUSES = ['NEW', 'REVIEWED', 'APPROVED', 'REJECTED']

export default function OnboardingReviewPage() {
  const [subs, setSubs] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const publicUrl = typeof window !== 'undefined' ? `${window.location.origin}/partner-onboarding` : '/partner-onboarding'

  const load = useCallback(() => {
    return fetch('/api/creator-onboarding').then(r => r.json()).then(d => setSubs(Array.isArray(d) ? d : []))
  }, [])
  useEffect(() => { load().finally(() => setLoading(false)) }, [load])

  const setStatus = async (id: string, status: string) => {
    setSubs(prev => prev.map(s => s.id === id ? { ...s, status } : s))
    await fetch('/api/creator-onboarding', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) })
  }

  if (loading) return <SkeletonPage />

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Partner onboarding</h1>
        <p className="text-sm text-gray-500 mt-1">Aanmeldingen via het publieke onboardingformulier</p>
      </div>

      {/* Deelbare link */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 flex items-center gap-3">
        <span className="text-xs font-semibold text-gray-500 uppercase shrink-0">Publieke link</span>
        <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-accent-700 underline truncate flex items-center gap-1">
          {publicUrl} <ExternalLink className="w-3.5 h-3.5" />
        </a>
        <button onClick={() => { navigator.clipboard.writeText(publicUrl); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
          className="ml-auto shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gray-100 text-gray-600 text-xs font-medium hover:bg-gray-200">
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} Kopieer link
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Aanmeldingen ({subs.length})</h3>
        </div>
        {subs.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">Nog geen aanmeldingen.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {subs.map(s => (
              <div key={s.id}>
                <button onClick={() => setOpenId(openId === s.id ? null : s.id)} className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-50 text-left transition">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-900">{[s.first_name, s.last_name].filter(Boolean).join(' ') || 'Onbekend'}</div>
                    <div className="text-xs text-gray-400">{s.email}{s.phone ? ` · ${s.phone}` : ''}</div>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{formatDate(s.created_at)}</span>
                  <Badge status={s.status} size="sm" />
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${openId === s.id ? 'rotate-180' : ''}`} />
                </button>
                {openId === s.id && (
                  <div className="px-6 pb-5">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-xs text-gray-500">Status:</span>
                      <select value={s.status} onChange={e => setStatus(s.id, e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-accent-700">
                        {STATUSES.map(st => <option key={st} value={st}>{st}</option>)}
                      </select>
                    </div>
                    <Answers answers={s.answers} signature={s.signature} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Answers({ answers, signature }: { answers: any; signature: string | null }) {
  const sections: [string, string][] = [
    ['person', 'Persoonsgegevens'], ['business', 'Bedrijfsgegevens'], ['socials', 'Socialmedia'],
    ['content', 'Content & beschikbaarheid'], ['motivation', 'Motivatie'], ['experience', 'Ervaring'],
    ['about', 'Over jou'], ['additional', 'Aanvullend'], ['declaration', 'Verklaring'],
  ]
  const render = (val: unknown): string => {
    if (val == null || val === '') return '—'
    if (Array.isArray(val)) return val.length ? val.join(', ') : '—'
    if (typeof val === 'object') return ''
    return String(val)
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {sections.map(([key, title]) => {
        const data = answers?.[key]
        if (!data || typeof data !== 'object') return null
        return (
          <div key={key} className="bg-gray-50 rounded-lg p-4">
            <div className="text-xs font-semibold text-accent-700 uppercase tracking-wide mb-2">{title}</div>
            <dl className="space-y-1.5">
              {Object.entries(data).map(([k, v]) => {
                if (v && typeof v === 'object' && !Array.isArray(v)) {
                  // socials: platform-object
                  return (
                    <div key={k} className="text-xs">
                      <dt className="text-gray-500 font-medium capitalize">{k}</dt>
                      <dd className="text-gray-800 pl-2">{Object.entries(v as Record<string, unknown>).map(([kk, vv]) => `${kk}: ${render(vv)}`).join(' · ')}</dd>
                    </div>
                  )
                }
                return (
                  <div key={k} className="text-xs">
                    <dt className="text-gray-500 capitalize inline">{k.replace(/_/g, ' ')}: </dt>
                    <dd className="text-gray-800 inline">{render(v)}</dd>
                  </div>
                )
              })}
            </dl>
          </div>
        )
      })}
      {signature && (
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-xs font-semibold text-accent-700 uppercase tracking-wide mb-2">Handtekening</div>
          <div className="text-sm text-gray-800 italic">{signature}</div>
        </div>
      )}
    </div>
  )
}
