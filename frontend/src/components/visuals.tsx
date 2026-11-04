import QRCode from 'qrcode'
import { useId, useMemo } from 'react'
import { A_GLYPH, BRAND, markSvg } from '../lib/brand'
import type { CellAnalysis, SafetyFlag } from '../types'
import { cx } from './ui'
import { FLAG_META, sohColor } from '../lib/format'

export function LogoMark({ size = 32, className, bleed }: { size?: number; className?: string; bleed?: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const html = useMemo(() => markSvg(`m${id}`, { bleed }), [id, bleed])
  return <span aria-hidden className={cx('inline-block shrink-0 [&>svg]:block [&>svg]:h-full [&>svg]:w-full', className)} style={{ width: size, height: size, filter: size >= 48 ? 'drop-shadow(0 8px 18px rgba(47,107,242,.18))' : undefined }} dangerouslySetInnerHTML={{ __html: html }} />
}

/** "VOLTRACE" logotype with the crossbar-less A and teal triangle. */
export function Logotype({ height = 20, className, color = BRAND.navy }: { height?: number; className?: string; color?: string }) {
  const cap = height
  const fs = cap / 0.7
  return (
    <span className={cx('inline-flex items-baseline font-brand font-semibold leading-none', className)} style={{ fontSize: fs, letterSpacing: '0.035em', color }} aria-label="Voltrace" role="img">
      <span aria-hidden>VOLTR</span>
      <svg aria-hidden viewBox="0 0 78 72" style={{ height: cap, width: cap * 78 / 72, margin: `0 ${fs * 0.035}px` }}>
        <path d={A_GLYPH.outline} fill={color} />
        <path d={A_GLYPH.notch} fill={BRAND.teal} />
      </svg>
      <span aria-hidden>CE</span>
    </span>
  )
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cx('flex items-center gap-2.5', className)}>
      <LogoMark size={34} />
      <Logotype height={15} />
    </span>
  )
}

/** Stylised pack illustration with a fill level and a tint matching the status. */
export function BatteryArt({ level = 0.8, flag = 'GREEN', className, cells = 6, highlight, scanning }: { level?: number; flag?: SafetyFlag | 'BLUE'; className?: string; cells?: number; highlight?: number; scanning?: boolean }) {
  const col = flag === 'BLUE' ? '#3B82F6' : FLAG_META[flag].hex
  const soft = flag === 'BLUE' ? '#EAF3FF' : FLAG_META[flag].soft
  const w = 120
  const cw = (w - 16 - (cells - 1) * 4) / cells
  return (
    <svg viewBox="0 0 140 84" className={className} aria-hidden>
      <defs>
        <linearGradient id={`bf-${flag}`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={col} stopOpacity=".95" />
          <stop offset="1" stopColor={col} stopOpacity=".55" />
        </linearGradient>
        <clipPath id="bclip"><rect x="6" y="10" width={w} height="64" rx="12" /></clipPath>
      </defs>
      <rect x="6" y="10" width={w} height="64" rx="12" fill="#fff" stroke="#CBD5E1" strokeWidth="2" />
      <rect x={6 + w + 1} y="32" width="8" height="20" rx="3" fill="#CBD5E1" />
      {Array.from({ length: cells }).map((_, i) => {
        const x = 14 + i * (cw + 4)
        const h = 48 * level
        const hot = highlight === i
        return (
          <g key={i}>
            <rect x={x} y="18" width={cw} height="48" rx="5" fill={soft} />
            <rect x={x} y={18 + 48 - h} width={cw} height={h} rx="5" fill={hot ? '#EF4444' : `url(#bf-${flag})`} />
          </g>
        )
      })}
      {scanning && (
        <g clipPath="url(#bclip)">
          <rect x="6" y="0" width={w} height="16" fill="url(#scanline)" className="animate-sweep" style={{ transformBox: 'fill-box' }} />
          <defs>
            <linearGradient id="scanline" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#3B82F6" stopOpacity="0" />
              <stop offset=".8" stopColor="#3B82F6" stopOpacity=".35" />
              <stop offset="1" stopColor="#3B82F6" stopOpacity=".9" />
            </linearGradient>
          </defs>
        </g>
      )}
    </svg>
  )
}

/** Semi-circular SoH gauge with the 90% confidence band drawn on the track. */
export function SohGauge({ value, low, high, size = 260 }: { value: number; low: number; high: number; size?: number }) {
  const r = 100
  const cx0 = 120
  const cy0 = 118
  const pt = (p: number) => {
    const a = Math.PI * (1 - Math.max(0, Math.min(100, p)) / 100)
    return [cx0 + r * Math.cos(a), cy0 - r * Math.sin(a)]
  }
  const arc = (a: number, b: number) => {
    const [x1, y1] = pt(a)
    const [x2, y2] = pt(b)
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`
  }
  const col = sohColor(value)
  const [kx, ky] = pt(value)
  return (
    <svg viewBox="0 0 240 140" width="100%" style={{ maxWidth: size }} role="img" aria-label={`State of Health ${value}%, range ${low} to ${high}%`}>
      <path d={arc(0, 100)} stroke="#EEF2F7" strokeWidth="16" fill="none" strokeLinecap="round" />
      <path d={arc(low, high)} stroke={col} strokeOpacity=".22" strokeWidth="16" fill="none" strokeLinecap="butt" />
      <path d={arc(0, value)} stroke={col} strokeWidth="16" fill="none" strokeLinecap="round" className="gauge-arc" />
      <circle cx={kx} cy={ky} r="11" fill="#fff" stroke={col} strokeWidth="4" />
      <text x="120" y="100" textAnchor="middle" className="fill-ink" style={{ fontSize: 44, fontWeight: 700, letterSpacing: '-0.02em' }}>
        {value.toFixed(0)}
        <tspan style={{ fontSize: 22, fontWeight: 600 }} dx="2">%</tspan>
      </text>
      <text x="120" y="126" textAnchor="middle" className="fill-muted" style={{ fontSize: 12, fontWeight: 500 }}>
        90% range {low.toFixed(0)}–{high.toFixed(0)}%
      </text>
      <text x="20" y="138" textAnchor="middle" className="fill-faint" style={{ fontSize: 10 }}>0</text>
      <text x="220" y="138" textAnchor="middle" className="fill-faint" style={{ fontSize: 10 }}>100</text>
    </svg>
  )
}

/** Small ring for compact SoH display in lists. */
export function SohRing({ value, size = 44, stroke = 5 }: { value: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const col = sohColor(value)
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#EEF2F7" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={col} strokeWidth={stroke} fill="none" strokeDasharray={`${(c * value) / 100} ${c}`} strokeLinecap="round" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[12px] font-bold text-ink">{Math.round(value)}</span>
    </div>
  )
}

/** Interactive pack layout: each cell is tappable. */
export function CellGrid({ cells, selected, onSelect, medianMv }: { cells: CellAnalysis[]; selected?: number | null; onSelect: (i: number) => void; medianMv: number }) {
  const cols = cells.length % 5 === 0 && cells.length > 16 ? 5 : 4
  const minV = Math.min(...cells.map((c) => c.mv))
  const maxV = Math.max(...cells.map((c) => c.mv))
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {cells.map((c) => {
        const tone = c.state === 'critical' ? 'RED' : c.state === 'warning' ? 'AMBER' : 'GREEN'
        const m = FLAG_META[tone]
        const lvl = maxV === minV ? 0.7 : 0.35 + (0.6 * (c.mv - minV)) / (maxV - minV)
        const isSel = selected === c.index
        return (
          <button
            key={c.index}
            onClick={() => onSelect(c.index)}
            aria-label={`Cell ${c.index}, ${(c.mv / 1000).toFixed(3)} volts, ${c.state}`}
            className={cx(
              'tap relative flex h-[76px] flex-col justify-between overflow-hidden rounded-xl border p-2 text-left transition active:scale-[0.97]',
              c.state === 'normal' ? 'border-line bg-card' : cx(m.bg, m.ring),
              isSel && 'ring-2 ring-primary ring-offset-1',
              c.state === 'critical' && 'cell-pulse',
            )}
          >
            <span className="absolute inset-x-0 bottom-0 opacity-90" style={{ height: `${lvl * 100}%`, background: c.state === 'normal' ? 'linear-gradient(180deg, rgba(20,184,166,0.10), rgba(20,184,166,0.22))' : 'transparent' }} />
            <span className="relative flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted">C{c.index}</span>
              <span className={cx('h-2 w-2 rounded-full', c.state === 'normal' ? 'bg-teal' : m.dot)} />
            </span>
            <span className="relative">
              <span className="block text-[15px] font-bold tabular-nums leading-none text-ink">{(c.mv / 1000).toFixed(3)}</span>
              <span className={cx('mt-1 block text-[11px] font-medium tabular-nums', c.devMv === 0 ? 'text-faint' : Math.abs(c.devMv) > 30 ? m.text : 'text-muted')}>
                {c.devMv > 0 ? '+' : ''}{c.devMv} mV
              </span>
            </span>
          </button>
        )
      })}
      <span className="sr-only">Pack median {medianMv} mV</span>
    </div>
  )
}

/** Styled QR code: rounded modules, rounded finder eyes, Voltrace mark in the centre. */
export function QRArt({ value, size = 240, className, tone = 'ink' }: { value: string; size?: number; className?: string; tone?: 'ink' | 'red' }) {
  const qr = useMemo(() => QRCode.create(value, { errorCorrectionLevel: 'M' }), [value])
  const n = qr.modules.size
  const q = 3
  const dim = n + q * 2
  const data = qr.modules.data
  const isFinder = (x: number, y: number) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7)
  const logo = Math.max(5, Math.round(n * 0.16)) | 1
  const l0 = Math.floor((n - logo) / 2)
  const inLogo = (x: number, y: number) => x >= l0 - 1 && x <= l0 + logo && y >= l0 - 1 && y <= l0 + logo
  const qrMark = useMemo(() => markSvg('qrm'), [])
  const ink = tone === 'red' ? '#7F1D1D' : '#172B4D'
  const eye = tone === 'red' ? '#DC2626' : '#2563EB'
  const rects: string[] = []
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      if (!data[y * n + x] || isFinder(x, y) || inLogo(x, y)) continue
      // rounded-square module; corners rounded only where no dark neighbour, so runs stay solid
      const X = x + q
      const Y = y + q
      const dark = (i: number, j: number) => i >= 0 && j >= 0 && i < n && j < n && !!data[j * n + i] && !isFinder(i, j) && !inLogo(i, j)
      const r = 0.4
      const tl = !dark(x - 1, y) && !dark(x, y - 1) ? r : 0
      const tr = !dark(x + 1, y) && !dark(x, y - 1) ? r : 0
      const br = !dark(x + 1, y) && !dark(x, y + 1) ? r : 0
      const bl = !dark(x - 1, y) && !dark(x, y + 1) ? r : 0
      rects.push(`M${X + tl},${Y}H${X + 1 - tr}${tr ? `a${tr},${tr} 0 0 1 ${tr},${tr}` : ''}V${Y + 1 - br}${br ? `a${br},${br} 0 0 1 -${br},${br}` : ''}H${X + bl}${bl ? `a${bl},${bl} 0 0 1 -${bl},-${bl}` : ''}V${Y + tl}${tl ? `a${tl},${tl} 0 0 1 ${tl},-${tl}` : ''}Z`)
    }
  const eyeAt = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <rect x={x + q + 0.5} y={y + q + 0.5} width="6" height="6" rx="1.8" fill="none" stroke={ink} strokeWidth="1" />
      <rect x={x + q + 2} y={y + q + 2} width="3" height="3" rx="0.9" fill={eye} />
    </g>
  )
  return (
    <svg viewBox={`0 0 ${dim} ${dim}`} width={size} height={size} className={className} role="img" aria-label="Passport verification QR code" shapeRendering="geometricPrecision">
      <rect width={dim} height={dim} rx="2" fill="#fff" />
      <path d={rects.join('')} fill={ink} />
      {eyeAt(0, 0)}
      {eyeAt(n - 7, 0)}
      {eyeAt(0, n - 7)}
      <g transform={`translate(${l0 + q - 0.5} ${l0 + q - 0.5})`}>
        <rect width={logo + 1} height={logo + 1} rx={(logo + 1) * 0.26} fill="#fff" />
        {tone === 'red' ? (
          <svg x="0.5" y="0.5" width={logo} height={logo} viewBox="0 0 48 48">
            <rect width="48" height="48" rx="13" fill="#DC2626" />
            <path d="M27.5 9 15 26.5h8.2L20.5 39 33 21.5h-8.2L27.5 9Z" fill="#fff" />
          </svg>
        ) : (
          <svg x="0.5" y="0.5" width={logo} height={logo}><g dangerouslySetInnerHTML={{ __html: qrMark }} /></svg>
        )}
      </g>
    </svg>
  )
}

export function Sparkline({ values, color = '#3B82F6', width = 80, height = 28 }: { values: number[]; color?: string; width?: number; height?: number }) {
  if (values.length < 2) return <svg width={width} height={height} />
  const min = Math.min(...values) - 1
  const max = Math.max(...values) + 1
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * (width - 4) + 2},${height - 2 - ((v - min) / (max - min)) * (height - 4)}`)
  return (
    <svg width={width} height={height} aria-hidden>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1].split(',')[0]} cy={pts[pts.length - 1].split(',')[1]} r="2.5" fill={color} />
    </svg>
  )
}
