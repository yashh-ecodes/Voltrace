import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { CellAnalysis, LoadTest } from '../types'

const AX = { fontSize: 11, fill: '#64748B' }
const GRID = '#EEF2F7'
const tip = {
  contentStyle: { borderRadius: 12, border: '1px solid #E2E8F0', boxShadow: '0 8px 24px -8px rgba(23,43,77,.18)', fontSize: 12, padding: '8px 10px' },
  labelStyle: { color: '#172B4D', fontWeight: 600, marginBottom: 2 },
  cursor: { fill: 'rgba(59,130,246,0.06)' },
}
const stateColor = (s: CellAnalysis['state']) => (s === 'critical' ? '#EF4444' : s === 'warning' ? '#F59E0B' : '#14B8A6')

export function CellDeviationChart({ cells, selected, onSelect, mode = 'dev' }: { cells: CellAnalysis[]; selected?: number | null; onSelect: (i: number) => void; mode?: 'dev' | 'v' }) {
  const data = cells.map((c) => ({ name: `${c.index}`, v: mode === 'dev' ? c.devMv : c.mv / 1000, state: c.state, idx: c.index }))
  const vals = data.map((d) => d.v)
  const domain: [number, number] = mode === 'dev' ? [Math.min(-40, Math.min(...vals) - 8), Math.max(40, Math.max(...vals) + 8)] : [Math.min(...vals) - 0.01, Math.max(...vals) + 0.01]
  return (
    <ResponsiveContainer width="100%" height={210}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -14, bottom: 0 }} onClick={(e) => { const i = Number((e as { activeLabel?: string | number })?.activeLabel); if (i) onSelect(i) }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="name" tick={AX} tickLine={false} axisLine={false} interval={0} />
        <YAxis tick={AX} tickLine={false} axisLine={false} domain={domain} tickFormatter={(v) => (mode === 'dev' ? `${Math.round(v)}` : Number(v).toFixed(2))} width={44} />
        {mode === 'dev' && <ReferenceArea y1={-30} y2={30} fill="#14B8A6" fillOpacity={0.05} />}
        {mode === 'dev' && <ReferenceLine y={0} stroke="#94A3B8" />}
        {mode === 'dev' && <ReferenceLine y={-30} stroke="#F59E0B" strokeDasharray="4 4" />}
        {mode === 'dev' && <ReferenceLine y={30} stroke="#F59E0B" strokeDasharray="4 4" />}
        <Tooltip {...tip} formatter={(v) => (mode === 'dev' ? [`${v} mV`, 'vs median'] : [`${Number(v).toFixed(3)} V`, 'Voltage'])} labelFormatter={(l) => `Cell ${l}`} />
        <Bar dataKey="v" radius={[4, 4, 4, 4]} maxBarSize={18} isAnimationActive>
          {data.map((d) => (
            <Cell key={d.idx} fill={stateColor(d.state)} fillOpacity={selected && selected !== d.idx ? 0.45 : 1} cursor="pointer" />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function LoadTestChart({ lt }: { lt: LoadTest }) {
  const data = lt.samples.map((s) => ({ t: s.t, v: s.packV, a: Math.abs(s.packA) }))
  const loaded = lt.samples.filter((s) => Math.abs(s.packA) > 0.5)
  const vs = data.map((d) => d.v)
  return (
    <ResponsiveContainer width="100%" height={170}>
      <ComposedChart data={data} margin={{ top: 8, right: 6, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="lv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3B82F6" stopOpacity={0.25} /><stop offset="1" stopColor="#3B82F6" stopOpacity={0} /></linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={GRID} />
        {loaded.length > 0 && <ReferenceArea x1={loaded[0].t} x2={loaded[loaded.length - 1].t} fill="#F59E0B" fillOpacity={0.08} />}
        <XAxis dataKey="t" tick={AX} tickLine={false} axisLine={false} type="number" domain={['dataMin', 'dataMax']} tickFormatter={(v) => `${v}s`} />
        <YAxis tick={AX} tickLine={false} axisLine={false} domain={[Math.min(...vs) - 0.15, Math.max(...vs) + 0.1]} tickFormatter={(v) => Number(v).toFixed(1)} width={44} />
        <Tooltip {...tip} formatter={(v, n) => (n === 'v' ? [`${Number(v).toFixed(2)} V`, 'Pack voltage'] : [`${v} A`, 'Load'])} labelFormatter={(l) => `t = ${l}s`} />
        <Area type="monotone" dataKey="v" stroke="#3B82F6" strokeWidth={2} fill="url(#lv)" isAnimationActive />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

export function SohTrendChart({ points, height = 180 }: { points: { label: string; soh: number; band: [number, number] }[]; height?: number }) {
  const lo = Math.min(...points.map((p) => p.band[0]))
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={points} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="label" tick={AX} tickLine={false} axisLine={false} />
        <YAxis tick={AX} tickLine={false} axisLine={false} domain={[Math.max(0, Math.floor((lo - 5) / 10) * 10), 100]} width={40} />
        <Tooltip {...tip} formatter={(v, n) => (n === 'band' ? [`${(v as number[])[0]}–${(v as number[])[1]}%`, '90% range'] : [`${v}%`, 'SoH'])} />
        <Area dataKey="band" stroke="none" fill="#14B8A6" fillOpacity={0.15} isAnimationActive={false} />
        <Line type="monotone" dataKey="soh" stroke="#14B8A6" strokeWidth={2.5} dot={{ r: 3.5, fill: '#fff', strokeWidth: 2 }} activeDot={{ r: 5 }} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

export function Donut({ data, size = 132, center, sub }: { data: { name: string; value: number; color: string }[]; size?: number; center: string; sub: string }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data.filter((d) => d.value > 0)} dataKey="value" innerRadius={size * 0.36} outerRadius={size * 0.5} paddingAngle={2} stroke="none" isAnimationActive>
            {data.filter((d) => d.value > 0).map((d) => <Cell key={d.name} fill={d.color} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-ink">{center}</span>
        <span className="text-[11px] text-muted">{sub}</span>
      </div>
    </div>
  )
}

export function SimpleBars({ data, height = 180, unit = '', color = '#3B82F6' }: { data: { label: string; value: number; color?: string }[]; height?: number; unit?: string; color?: string }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -6, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="label" tick={AX} tickLine={false} axisLine={false} interval={0} />
        <YAxis tick={AX} tickLine={false} axisLine={false} allowDecimals={false} width={40} />
        <Tooltip {...tip} formatter={(v) => [`${v}${unit}`, '']} />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={36}>
          {data.map((d) => <Cell key={d.label} fill={d.color ?? color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
