'use client'

import { createContext, useContext, useCallback, useEffect, useRef, useState, ReactNode } from 'react'
import type { Device, Call } from '@twilio/voice-sdk'
import { Phone, PhoneOff, Mic, MicOff, X, Settings2, Smartphone, Monitor } from 'lucide-react'

const iconProps = { strokeWidth: 1.75 } as const

export interface DialableLead {
  id: string
  name: string
  phone: string | null
}

interface MeInfo {
  role: string
  teamMemberId: string
  call_mode: 'browser' | 'mobile'
  mobile_phone: string | null
}

type CallState = 'idle' | 'connecting' | 'ringing' | 'active' | 'mobile-initiated'

interface DialerContextValue {
  dialerReady: boolean
  callMode: 'browser' | 'mobile'
  callState: CallState
  activeLead: DialableLead | null
  startCall: (lead: DialableLead) => void
  me: MeInfo | null
  refreshMe: () => void
}

const DialerContext = createContext<DialerContextValue | null>(null)

export function useDialer() {
  const ctx = useContext(DialerContext)
  if (!ctx) throw new Error('useDialer must be used within DialerProvider')
  return ctx
}

export function DialerProvider({
  children,
  onCallEnded,
}: {
  children: ReactNode
  // Wordt aangeroepen na ophangen zodat de pagina het log-modal kan openen.
  onCallEnded?: (lead: DialableLead, durationSeconds: number) => void
}) {
  const [me, setMe] = useState<MeInfo | null>(null)
  const [dialerReady, setDialerReady] = useState(false)
  const [callState, setCallState] = useState<CallState>('idle')
  const [activeLead, setActiveLead] = useState<DialableLead | null>(null)
  const [muted, setMuted] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const deviceRef = useRef<Device | null>(null)
  const callRef = useRef<Call | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startedAtRef = useRef<number | null>(null)
  const onCallEndedRef = useRef(onCallEnded)
  onCallEndedRef.current = onCallEnded

  const refreshMe = useCallback(() => {
    fetch('/api/me').then(r => r.ok ? r.json() : null).then(data => { if (data) setMe(data) })
  }, [])

  useEffect(() => { refreshMe() }, [refreshMe])

  // Twilio Device initialiseren (alleen browser-modus, SETTER/ADMIN)
  useEffect(() => {
    if (!me || !['ADMIN', 'SETTER'].includes(me.role) || me.call_mode !== 'browser') {
      setDialerReady(false)
      return
    }
    let cancelled = false

    async function init() {
      try {
        const res = await fetch('/api/twilio/token', { method: 'POST' })
        if (!res.ok) return
        const { token } = await res.json()
        const { Device } = await import('@twilio/voice-sdk')
        if (cancelled) return
        const device = new Device(token, { codecPreferences: ['opus', 'pcmu'] as never })
        device.on('tokenWillExpire', async () => {
          const r = await fetch('/api/twilio/token', { method: 'POST' })
          if (r.ok) device.updateToken((await r.json()).token)
        })
        device.on('error', () => setError('Browserbellen niet beschikbaar'))
        deviceRef.current = device
        setDialerReady(true)
      } catch {
        setError('Browserbellen niet beschikbaar')
      }
    }
    init()

    return () => {
      cancelled = true
      deviceRef.current?.destroy()
      deviceRef.current = null
      setDialerReady(false)
    }
  }, [me])

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
  }

  const endCall = useCallback((lead: DialableLead) => {
    stopTimer()
    const duration = startedAtRef.current ? Math.round((Date.now() - startedAtRef.current) / 1000) : 0
    startedAtRef.current = null
    callRef.current = null
    setCallState('idle')
    setActiveLead(null)
    setMuted(false)
    setSeconds(0)
    onCallEndedRef.current?.(lead, duration)
  }, [])

  const startCall = useCallback(async (lead: DialableLead) => {
    if (!lead.phone || callState !== 'idle' || !me) return
    setError(null)
    setActiveLead(lead)

    if (me.call_mode === 'mobile') {
      setCallState('mobile-initiated')
      const res = await fetch('/api/twilio/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error || 'Bellen via mobiel mislukt')
        setCallState('idle')
        setActiveLead(null)
      }
      return
    }

    const device = deviceRef.current
    if (!device) {
      setError('Dialer is nog niet klaar — probeer opnieuw of gebruik de tel:-link')
      setActiveLead(null)
      return
    }

    setCallState('connecting')
    try {
      const call = await device.connect({
        params: { To: lead.phone, leadId: lead.id, teamMemberId: me.teamMemberId },
      })
      callRef.current = call
      setCallState('ringing')
      call.on('accept', () => {
        setCallState('active')
        startedAtRef.current = Date.now()
        timerRef.current = setInterval(() => {
          if (startedAtRef.current) setSeconds(Math.round((Date.now() - startedAtRef.current) / 1000))
        }, 1000)
      })
      call.on('disconnect', () => endCall(lead))
      call.on('cancel', () => endCall(lead))
      call.on('error', () => {
        setError('Gesprek mislukt')
        endCall(lead)
      })
    } catch {
      setError('Kan geen verbinding maken — controleer je microfoon')
      setCallState('idle')
      setActiveLead(null)
    }
  }, [callState, me, endCall])

  const hangUp = () => {
    if (callRef.current) callRef.current.disconnect()
    else if (activeLead) endCall(activeLead)
  }

  const toggleMute = () => {
    if (!callRef.current) return
    const next = !muted
    callRef.current.mute(next)
    setMuted(next)
  }

  const dismissMobile = () => {
    if (activeLead) {
      const lead = activeLead
      setCallState('idle')
      setActiveLead(null)
      onCallEndedRef.current?.(lead, 0)
    }
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <DialerContext.Provider value={{ dialerReady, callMode: me?.call_mode || 'browser', callState, activeLead, startCall, me, refreshMe }}>
      {children}

      {/* Foutmelding */}
      {error && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2.5 flex items-center gap-3 shadow-sm">
          {error}
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* CallBar */}
      {activeLead && callState !== 'idle' && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white rounded-xl shadow-xl px-5 py-3 flex items-center gap-4 min-w-[340px]">
          <div className={`w-2.5 h-2.5 rounded-full ${callState === 'active' ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{activeLead.name}</div>
            <div className="text-xs text-gray-400">
              {callState === 'connecting' && 'Verbinden…'}
              {callState === 'ringing' && 'Gaat over…'}
              {callState === 'active' && <span className="tabular-nums">{fmt(seconds)}</span>}
              {callState === 'mobile-initiated' && 'Je wordt gebeld op je mobiel…'}
            </div>
          </div>
          {callState === 'mobile-initiated' ? (
            <button onClick={dismissMobile}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-700 hover:bg-gray-600 transition-colors">
              Log resultaat
            </button>
          ) : (
            <>
              <button onClick={toggleMute} title={muted ? 'Dempen opheffen' : 'Dempen'}
                className={`p-2 rounded-lg transition-colors ${muted ? 'bg-amber-500 hover:bg-amber-400' : 'bg-gray-700 hover:bg-gray-600'}`}>
                {muted ? <MicOff className="w-4 h-4" {...iconProps} /> : <Mic className="w-4 h-4" {...iconProps} />}
              </button>
              <button onClick={hangUp} title="Ophangen"
                className="p-2 rounded-lg bg-red-500 hover:bg-red-400 transition-colors">
                <PhoneOff className="w-4 h-4" {...iconProps} />
              </button>
            </>
          )}
        </div>
      )}
    </DialerContext.Provider>
  )
}

/* ── Bel-knop ── */
export function CallButton({ lead, size = 'sm' }: { lead: DialableLead; size?: 'sm' | 'md' }) {
  const { callState, startCall, me } = useDialer()
  if (!lead.phone || !me || !['ADMIN', 'SETTER'].includes(me.role)) return null
  const busy = callState !== 'idle'
  return (
    <button
      onClick={e => { e.stopPropagation(); startCall(lead) }}
      disabled={busy}
      className={`flex items-center gap-1 rounded-md font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors duration-[120ms] disabled:opacity-40 disabled:cursor-not-allowed ${size === 'md' ? 'px-3 py-2 text-sm' : 'px-2 py-1 text-xs'}`}>
      <Phone className={size === 'md' ? 'w-4 h-4' : 'w-3 h-3'} {...iconProps} /> Bel
    </button>
  )
}

/* ── Belvoorkeuren (browser/mobiel + mobiel nummer) ── */
export function DialerSettings() {
  const { me, refreshMe } = useDialer()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'browser' | 'mobile'>('browser')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (me) {
      setMode(me.call_mode)
      setPhone(me.mobile_phone || '')
    }
  }, [me])

  if (!me || !['ADMIN', 'SETTER'].includes(me.role)) return null

  const save = async () => {
    setSaving(true)
    await fetch('/api/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ call_mode: mode, mobile_phone: phone || null }),
    })
    setSaving(false)
    setOpen(false)
    refreshMe()
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} title="Belvoorkeuren"
        className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors duration-[120ms]">
        <Settings2 className="w-4 h-4" {...iconProps} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-lg border border-gray-200 shadow-lg p-4 w-72">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Belvoorkeuren</h3>
            <div className="space-y-2">
              <label className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${mode === 'browser' ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                <input type="radio" checked={mode === 'browser'} onChange={() => setMode('browser')} className="accent-blue-600" />
                <Monitor className="w-4 h-4 text-gray-500" {...iconProps} />
                <div>
                  <div className="text-sm font-medium text-gray-900">Bellen via browser</div>
                  <div className="text-[11px] text-gray-500">Headset aan je laptop</div>
                </div>
              </label>
              <label className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${mode === 'mobile' ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                <input type="radio" checked={mode === 'mobile'} onChange={() => setMode('mobile')} className="accent-blue-600" />
                <Smartphone className="w-4 h-4 text-gray-500" {...iconProps} />
                <div>
                  <div className="text-sm font-medium text-gray-900">Bellen via mobiel</div>
                  <div className="text-[11px] text-gray-500">Je wordt eerst zelf gebeld</div>
                </div>
              </label>
            </div>
            {mode === 'mobile' && (
              <div className="mt-3">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Mobiel nummer</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+31 6..."
                  className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-accent-700" />
              </div>
            )}
            <button onClick={save} disabled={saving || (mode === 'mobile' && !phone)}
              className="mt-3 w-full py-2 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 transition-colors disabled:opacity-40">
              {saving ? 'Opslaan…' : 'Opslaan'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
