'use client'

import { useRef, useState, useEffect } from 'react'

const ACCENT = '#5980a6'
const ACCENT_700 = '#416180'
const ACCENT_800 = '#2c455d'
const ACCENT_300 = '#b5d9fd'
const ACCENT_200 = '#d6ebff'
const DANGER = '#a5443f'
const GRID = 'rgba(29,31,32,0.09)'
const AXIS_LINE = 'rgba(29,31,32,0.22)'
const LABEL = 'rgba(29,31,32,0.42)'

function useSize() {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 600, h: 180 })
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const { width, height } = e.contentRect
        if (width > 0 && height > 0) setSize({ w: Math.round(width), h: Math.round(height) })
      }
    })
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return { ref, ...size }
}

const PAD = { t: 10, b: 20, x: 4 }

/** Vertical steel bars, 4 hairline gridlines, peak/last bar in accent-800. */
export function SteelBars({ labels, data, danger }: { labels: string[]; data: number[]; danger?: boolean[] }) {
  const { ref, w, h } = useSize()
  const max = Math.max(...data, 1)
  const innerH = h - PAD.t - PAD.b
  const innerW = w - PAD.x * 2
  const slot = innerW / (data.length || 1)
  const bw = Math.min(slot * 0.6, 30)
  const grids = [0, 0.25, 0.5, 0.75, 1]
  const showEveryLabel = data.length <= 12

  return (
    <div ref={ref} className="w-full h-full">
      {w > 0 && (
        <svg width={w} height={h}>
          {grids.map((g, i) => {
            const y = PAD.t + innerH * (1 - g)
            return <line key={i} x1={PAD.x} x2={w - PAD.x} y1={y} y2={y} stroke={i === 0 ? AXIS_LINE : GRID} strokeWidth={1} />
          })}
          {data.map((v, i) => {
            const bh = max > 0 ? (v / max) * innerH : 0
            const x = PAD.x + slot * i + (slot - bw) / 2
            const y = PAD.t + innerH - bh
            const peak = danger?.[i] ? DANGER : (i === data.length - 1 || v === max) ? ACCENT_800 : ACCENT
            return <rect key={i} x={x} y={Math.max(y, PAD.t)} width={bw} height={Math.max(bh, 0)} fill={peak} />
          })}
          {labels.map((l, i) => (
            (showEveryLabel || i % 2 === 0) &&
            <text key={i} x={PAD.x + slot * i + slot / 2} y={h - 6} textAnchor="middle" fontSize={9} fontFamily="var(--font-heading)" fontWeight={600} letterSpacing="0.04em" fill={LABEL}>{l}</text>
          ))}
        </svg>
      )}
    </div>
  )
}

/** Area chart: accent stroke + vertical gradient fill, square peak nodes. */
export function SteelArea({ labels, data }: { labels: string[]; data: number[] }) {
  const { ref, w, h } = useSize()
  const max = Math.max(...data, 1)
  const innerH = h - PAD.t - PAD.b
  const innerW = w - PAD.x * 2
  const n = data.length
  const px = (i: number) => PAD.x + (n <= 1 ? innerW / 2 : (innerW * i) / (n - 1))
  const py = (v: number) => PAD.t + innerH - (max > 0 ? (v / max) * innerH : 0)
  const line = data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${px(i)} ${py(v)}`).join(' ')
  const area = `${line} L ${px(n - 1)} ${PAD.t + innerH} L ${px(0)} ${PAD.t + innerH} Z`
  const gid = 'steelArea'

  return (
    <div ref={ref} className="w-full h-full">
      {w > 0 && (
        <svg width={w} height={h}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ACCENT} stopOpacity={0.28} />
              <stop offset="100%" stopColor={ACCENT} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          {[0, 0.5, 1].map((g, i) => {
            const y = PAD.t + innerH * (1 - g)
            return <line key={i} x1={PAD.x} x2={w - PAD.x} y1={y} y2={y} stroke={g === 0 ? AXIS_LINE : GRID} strokeWidth={1} />
          })}
          <path d={area} fill={`url(#${gid})`} />
          <path d={line} fill="none" stroke={ACCENT} strokeWidth={2} />
          {data.map((v, i) => {
            const isPeak = v === max
            const s = isPeak ? 6 : 4
            return <rect key={i} x={px(i) - s / 2} y={py(v) - s / 2} width={s} height={s} fill={isPeak ? ACCENT_800 : '#fff'} stroke={ACCENT_800} strokeWidth={1.25} />
          })}
          {labels.map((l, i) => (
            (i === 0 || i === n - 1) &&
            <text key={i} x={px(i)} y={h - 6} textAnchor={i === 0 ? 'start' : 'end'} fontSize={9} fontFamily="var(--font-heading)" fontWeight={600} letterSpacing="0.04em" fill={LABEL}>{l}</text>
          ))}
        </svg>
      )}
    </div>
  )
}

/** Compact sparkline (steel line + accent-800 end node). */
export function Sparkline({ data }: { data: number[] }) {
  const { ref, w, h } = useSize()
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const n = data.length
  const px = (i: number) => 2 + (n <= 1 ? (w - 4) / 2 : ((w - 4) * i) / (n - 1))
  const py = (v: number) => 4 + (h - 8) * (1 - (v - min) / range)
  const line = data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${px(i)} ${py(v)}`).join(' ')
  return (
    <div ref={ref} className="w-full h-full">
      {w > 0 && (
        <svg width={w} height={h}>
          <path d={line} fill="none" stroke={ACCENT} strokeWidth={1.75} />
          {n > 0 && <rect x={px(n - 1) - 3} y={py(data[n - 1]) - 3} width={6} height={6} fill={ACCENT_800} />}
        </svg>
      )}
    </div>
  )
}

/** Grouped two-series bars (e.g. deal value vs cash per month). */
export function GroupedSteelBars({ labels, a, b }: { labels: string[]; a: number[]; b: number[] }) {
  const { ref, w, h } = useSize()
  const max = Math.max(...a, ...b, 1)
  const innerH = h - PAD.t - PAD.b
  const innerW = w - PAD.x * 2
  const slot = innerW / (labels.length || 1)
  const gw = Math.min(slot * 0.66, 34)
  const bw = gw / 2
  const grids = [0, 0.25, 0.5, 0.75, 1]
  return (
    <div ref={ref} className="w-full h-full">
      {w > 0 && (
        <svg width={w} height={h}>
          {grids.map((g, i) => {
            const y = PAD.t + innerH * (1 - g)
            return <line key={i} x1={PAD.x} x2={w - PAD.x} y1={y} y2={y} stroke={i === 0 ? AXIS_LINE : GRID} strokeWidth={1} />
          })}
          {labels.map((l, i) => {
            const cx = PAD.x + slot * i + slot / 2
            const ah = (a[i] / max) * innerH
            const bh = (b[i] / max) * innerH
            return (
              <g key={i}>
                <rect x={cx - bw} y={PAD.t + innerH - ah} width={bw - 1} height={ah} fill={ACCENT_200} />
                <rect x={cx + 1} y={PAD.t + innerH - bh} width={bw - 1} height={bh} fill={ACCENT_700} />
                <text x={cx} y={h - 6} textAnchor="middle" fontSize={9} fontFamily="var(--font-heading)" fontWeight={600} letterSpacing="0.04em" fill={LABEL}>{l}</text>
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}

/** Two-segment proportion bar (e.g. PIF vs Split). */
export function SegmentBar({ a, b }: { a: number; b: number }) {
  const total = a + b || 1
  return (
    <div className="flex h-2.5 w-full">
      <div style={{ width: `${(a / total) * 100}%`, background: ACCENT_800 }} />
      <div style={{ width: `${(b / total) * 100}%`, background: ACCENT_300 }} />
    </div>
  )
}

/** Labeled progress row (ageing buckets). */
export function ProgressRow({ label, value, pct, danger }: { label: string; value: string; pct: number; danger?: boolean }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className={`font-heading font-semibold uppercase text-[10px] tracking-[0.08em] ${danger ? 'text-[var(--color-danger)]' : 'text-ink/55'}`}>{label}</span>
        <span className="font-heading font-semibold tabular-nums text-[12px] text-ink">{value}</span>
      </div>
      <div className="h-1.5 w-full bg-neutral-200">
        <div className="h-full" style={{ width: `${Math.min(pct, 100)}%`, background: danger ? DANGER : ACCENT }} />
      </div>
    </div>
  )
}
