'use client'

import { useState, useEffect, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/format'
import type { Call, CallResult } from '@/lib/queries/sales'
import {
  X, Save, Check, Copy, ExternalLink,
  Phone, Mail, AtSign,
  Calendar, User, UserCheck, Globe, Video,
  MessageSquare, Link as LinkIcon, CreditCard,
  Send, ChevronDown,
} from 'lucide-react'

const iconProps = { strokeWidth: 1.75 } as const

const RESULT_OPTIONS: CallResult[] = [
  'CALL BOOKED', 'RESCHEDULE', 'FOLLOW UP', 'FOLLOW UP LONG TERM',
  'DEPOSIT', 'CLOSED', 'LOST - BROKE', 'LOST - NO INTEREST',
  'LOST - BAD FIT', 'NO SHOW', 'CANCELLED BY LEAD', 'CANCELLED BY CLOSER',
]

interface CallDetailProps {
  call: Call
  onClose: () => void
  onUpdate: () => void
}

export function CallDetail({ call, onClose, onUpdate }: CallDetailProps) {
  // Editable state
  const [result, setResult] = useState<CallResult | ''>(call.result || '')
  const [fathomLink, setFathomLink] = useState(call.fathom_link || '')
  const [setterNotes, setSetterNotes] = useState(call.setter_notes || '')
  const [preCallNotes, setPreCallNotes] = useState(call.pre_call_notes || '')
  const [closingNotes, setClosingNotes] = useState(call.closing_notes || '')
  const [triageNotes, setTriageNotes] = useState(call.triage_notes || '')
  const [noDealReason, setNoDealReason] = useState(call.no_deal_reason || '')
  const [dealValue, setDealValue] = useState<number | ''>(call.deal_value ?? '')

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState('')
  const [slackSent, setSlackSent] = useState<Record<string, boolean>>({})

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(''), 2000)
  }

  const saveAll = async () => {
    setSaving(true)
    try {
      await fetch('/api/calls', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: call.id,
          result: result || null,
          fathom_link: fathomLink || null,
          setter_notes: setterNotes || null,
          pre_call_notes: preCallNotes || null,
          closing_notes: closingNotes || null,
          triage_notes: triageNotes || null,
          no_deal_reason: noDealReason || null,
          deal_value: dealValue === '' ? null : dealValue,
        }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      onUpdate()
    } catch (err) {
      console.error('Save failed:', err)
    } finally {
      setSaving(false)
    }
  }

  const sendToSlack = async (noteType: string) => {
    setSlackSent(prev => ({ ...prev, [noteType]: true }))
    // Future: POST to /api/slack
    // For now, just set the flag visually
    setTimeout(() => {
      setSlackSent(prev => ({ ...prev, [noteType]: false }))
    }, 3000)
  }

  const formatTime = (dateStr: string | null): string => {
    if (!dateStr) return '—'
    try {
      const d = new Date(dateStr)
      return d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
    } catch {
      return '—'
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl overflow-y-auto">

        {/* ── Header ── */}
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-accent-700 flex items-center justify-center text-white text-sm font-semibold shrink-0">
              {(call.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-gray-900 truncate">{call.name || 'Onbekend'}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                {call.result && <Badge status={call.result} size="sm" />}
                {call.source && (
                  <span className="inline-flex text-[10px] font-medium bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">
                    {call.source}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition duration-[120ms]">
            <X className="w-5 h-5 text-gray-400" {...iconProps} />
          </button>
        </div>

        {/* ── Contact Info ── */}
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Contactgegevens</h3>
          <div className="grid grid-cols-2 gap-3">
            <InfoRow icon={User} label="Naam" value={call.name} />
            <InfoRow icon={Mail} label="E-mail" value={call.email} />
            <InfoRow icon={Phone} label="Telefoon" value={call.phone} />
            <InfoRow icon={AtSign} label="Instagram" value={call.instagram} />
          </div>
        </div>

        {/* ── Scheduling ── */}
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Planning</h3>
          <div className="grid grid-cols-2 gap-3">
            <InfoRow icon={Calendar} label="Datum" value={call.date_start_time ? `${formatDate(call.date_start_time)} · ${formatTime(call.date_start_time)}` : null} />
            <InfoRow icon={UserCheck} label="Closer" value={call.closer?.name} />
            <InfoRow icon={User} label="Setter" value={call.setter?.name} />
            <InfoRow icon={Globe} label="Source" value={call.source} />
            <InfoRow icon={Video} label="Event type" value={call.event_type} />
          </div>
        </div>

        {/* ── Meeting Links ── */}
        {(call.meeting_link || call.reschedule_link || call.cancel_link) && (
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Meeting Links</h3>
            <div className="flex flex-wrap gap-2">
              {call.meeting_link && (
                <a href={call.meeting_link} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-accent-700 text-white rounded-lg hover:bg-accent-800 transition-colors duration-[120ms]">
                  <Video className="w-3.5 h-3.5" {...iconProps} />
                  Meeting Link
                </a>
              )}
              {call.reschedule_link && (
                <a href={call.reschedule_link} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-[120ms]">
                  <Calendar className="w-3.5 h-3.5" {...iconProps} />
                  Reschedule
                </a>
              )}
              {call.cancel_link && (
                <a href={call.cancel_link} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-gray-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors duration-[120ms]">
                  <X className="w-3.5 h-3.5" {...iconProps} />
                  Cancel
                </a>
              )}
            </div>
          </div>
        )}

        {/* ── Sales Info (editable) ── */}
        <div className="px-6 py-5 border-b border-gray-100">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Sales informatie</h3>
          <div className="space-y-4">

            {/* Result */}
            <div>
              <label className="text-[11px] font-semibold text-gray-400 uppercase">Result</label>
              <select
                value={result}
                onChange={e => setResult(e.target.value as CallResult)}
                className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700"
              >
                <option value="">— Selecteer —</option>
                {RESULT_OPTIONS.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {/* Fathom Link */}
            <div>
              <label className="text-[11px] font-semibold text-gray-400 uppercase">Fathom Link</label>
              <input
                type="text"
                value={fathomLink}
                onChange={e => setFathomLink(e.target.value)}
                placeholder="Plak Fathom link hier..."
                className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700"
              />
            </div>

            {/* Setter Notes */}
            <NoteField
              label="Setter Notes"
              value={setterNotes}
              onChange={setSetterNotes}
              onSendSlack={() => sendToSlack('setter')}
              slackSent={!!slackSent['setter']}
            />

            {/* Pre Call Notes */}
            <NoteField
              label="Pre Call Notes"
              value={preCallNotes}
              onChange={setPreCallNotes}
              onSendSlack={() => sendToSlack('pre_call')}
              slackSent={!!slackSent['pre_call']}
            />

            {/* Closing Notes */}
            <NoteField
              label="Closing Notes"
              value={closingNotes}
              onChange={setClosingNotes}
              onSendSlack={() => sendToSlack('closing')}
              slackSent={!!slackSent['closing']}
            />

            {/* Triage Notes */}
            <NoteField
              label="Triage Notes"
              value={triageNotes}
              onChange={setTriageNotes}
              onSendSlack={() => sendToSlack('triage')}
              slackSent={!!slackSent['triage']}
            />

            {/* No Deal Reason (conditional) */}
            {result?.startsWith('LOST') && (
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase">No Deal Reason</label>
                <input
                  type="text"
                  value={noDealReason}
                  onChange={e => setNoDealReason(e.target.value)}
                  placeholder="Reden..."
                  className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700"
                />
              </div>
            )}

            {/* Deal Value (conditional) */}
            {result === 'CLOSED' && (
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase">Deal Value</label>
                <div className="mt-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">EUR</span>
                  <input
                    type="number"
                    value={dealValue}
                    onChange={e => setDealValue(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="0"
                    className="w-full text-sm border border-gray-200 rounded-lg pl-12 pr-3 py-2 bg-white tabular-nums focus:outline-none focus:ring-2 focus:ring-accent-700"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Payment Links ── */}
        <div className="px-6 py-5 border-b border-gray-100">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Payment Links</h3>
          <div className="space-y-3">
            {/* Whop link */}
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="text-[11px] font-semibold text-gray-400 uppercase">Whop Link</label>
                {call.whop_link ? (
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-sm text-gray-700 truncate flex-1">{call.whop_link}</span>
                    <button
                      onClick={() => copyToClipboard(call.whop_link!, 'whop')}
                      className={`p-1.5 rounded-lg transition duration-[120ms] ${copied === 'whop' ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                    >
                      {copied === 'whop' ? <Check className="w-3.5 h-3.5" {...iconProps} /> : <Copy className="w-3.5 h-3.5" {...iconProps} />}
                    </button>
                    <a href={call.whop_link} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition duration-[120ms]">
                      <ExternalLink className="w-3.5 h-3.5" {...iconProps} />
                    </a>
                  </div>
                ) : (
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-sm text-gray-300">Geen link</span>
                    <Button size="sm" variant="secondary" onClick={() => {
                      fetch('/api/calls', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: call.id, whop_link: '__TRIGGER__' }),
                      }).then(() => onUpdate())
                    }}>
                      <LinkIcon className="w-3 h-3" {...iconProps} />
                      Generate Whop Link
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Stripe link */}
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="text-[11px] font-semibold text-gray-400 uppercase">Stripe Link</label>
                {call.stripe_link ? (
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-sm text-gray-700 truncate flex-1">{call.stripe_link}</span>
                    <button
                      onClick={() => copyToClipboard(call.stripe_link!, 'stripe')}
                      className={`p-1.5 rounded-lg transition duration-[120ms] ${copied === 'stripe' ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                    >
                      {copied === 'stripe' ? <Check className="w-3.5 h-3.5" {...iconProps} /> : <Copy className="w-3.5 h-3.5" {...iconProps} />}
                    </button>
                    <a href={call.stripe_link} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition duration-[120ms]">
                      <ExternalLink className="w-3.5 h-3.5" {...iconProps} />
                    </a>
                  </div>
                ) : (
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-sm text-gray-300">Geen link</span>
                    <Button size="sm" variant="secondary" onClick={() => {
                      fetch('/api/calls', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: call.id, stripe_link: '__TRIGGER__' }),
                      }).then(() => onUpdate())
                    }}>
                      <CreditCard className="w-3 h-3" {...iconProps} />
                      Generate Stripe Link
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Qualification Questions ── */}
        {call.questions && (Array.isArray(call.questions) ? call.questions.length > 0 : Object.keys(call.questions).length > 0) && (
          <div className="px-6 py-5 border-b border-gray-100">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Qualification Questions</h3>
            <div className="space-y-2">
              {(Array.isArray(call.questions)
                ? call.questions.map((qa: { question: string; answer: string }, i: number) => (
                    <div key={i} className="bg-gray-50 rounded-md px-3 py-2.5">
                      <div className="text-[11px] text-gray-500 mb-0.5">{qa.question}</div>
                      <div className="text-sm text-gray-900">{qa.answer}</div>
                    </div>
                  ))
                : Object.entries(call.questions).map(([question, answer]) => (
                    <div key={question} className="bg-gray-50 rounded-md px-3 py-2.5">
                      <div className="text-[11px] text-gray-500 mb-0.5">{question}</div>
                      <div className="text-sm text-gray-900">{String(answer)}</div>
                    </div>
                  ))
              )}
            </div>
          </div>
        )}

        {/* ── Footer: Save ── */}
        <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-gray-100 px-6 py-4 flex gap-3">
          <button
            onClick={saveAll}
            disabled={saving}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-accent-700 text-white rounded-lg text-sm font-medium hover:bg-accent-800 disabled:opacity-50 transition duration-[120ms]"
          >
            {saving ? 'Opslaan...' : saved ? <><Check className="w-4 h-4" {...iconProps} /> Opgeslagen</> : <><Save className="w-4 h-4" {...iconProps} /> Opslaan</>}
          </button>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition duration-[120ms]"
          >
            Sluiten
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Helper Components ── */

function InfoRow({ icon: Icon, label, value }: {
  icon: typeof User
  label: string
  value: string | null | undefined
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon className="w-3.5 h-3.5 text-gray-400 shrink-0" {...iconProps} />
      <div className="min-w-0">
        <div className="text-[11px] text-gray-400">{label}</div>
        <div className="text-sm text-gray-900 truncate">{value || '—'}</div>
      </div>
    </div>
  )
}

function NoteField({ label, value, onChange, onSendSlack, slackSent }: {
  label: string
  value: string
  onChange: (v: string) => void
  onSendSlack: () => void
  slackSent: boolean
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-semibold text-gray-400 uppercase">{label}</label>
        <button
          onClick={onSendSlack}
          disabled={slackSent || !value.trim()}
          className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md transition duration-[120ms] ${
            slackSent
              ? 'bg-emerald-50 text-emerald-600'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-30'
          }`}
        >
          {slackSent ? (
            <><Check className="w-3 h-3" {...iconProps} /> Verstuurd</>
          ) : (
            <><Send className="w-3 h-3" {...iconProps} /> Send to Slack</>
          )}
        </button>
      </div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={2}
        placeholder={`${label}...`}
        className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-accent-700"
      />
    </div>
  )
}
