import { Check, ChevronDown, SlidersHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts'
import { Card, Page, Section, Segmented, Sheet, TopBar, cx } from '../components/ui'
import { CellDeviationChart, Donut, SimpleBars, SohTrendChart } from '../components/charts'
import { CellSheet } from '../components/CellSheet'
import { latestScan, useApp } from '../store/app'
import { CHEM } from '../ml/chemistry'
import { USAGE_META } from '../lib/format'
import type { ScanRecord } from '../types'

type Veh = 'all' | 'E-rickshaw' | 'two' | 'other'
type Period = 'all' | '180' | '90'

export default function Analytics() {
  const st = useApp()
  const nav = useNavigate()
  const [veh, setVeh] = useState<Veh>('all')
  const [period, setPeriod] = useState<Period>('all')
  const [sheet, setSheet] = useState(false)
  const [pickOpen, setPickOpen] = useState(false)
  const [cell, setCell] = useState<number | null>(null)

  const vMatch = (t: string) => veh === 'all' || (veh === 'E-rickshaw' ? t === 'E-rickshaw' : veh === 'two' ? t === 'E-scooter' : t !== 'E-rickshaw' && t !== 'E-scooter')
  const since = period === 'all' ? 0 : Date.now() - Number(period) * 86400000

  const data = useMemo(() => {
    const batteries = st.fleet.filter((b) => vMatch(b.vehicleType))
    const latest = batteries.map((b) => latestScan(st, b.batteryId)).filter(Boolean) as ScanRecord[]
    const scans = batteries.flatMap((b) => b.scanIds.map((id) => st.scans[id])).filter((s) => s && new Date(s.createdAt).getTime() >= since)
    const buckets = [['<60', 0, 60, '#EF4444'], ['60–70', 60, 70, '#F59E0B'], ['70–80', 70, 80, '#FBBF24'], ['80–90', 80, 90, '#2DD4BF'], ['90+', 90, 101, '#14B8A6']] as const
    const dist = buckets.map(([label, lo, hi, color]) => ({ label, value: latest.filter((s) => s.diagnosis.soh.value >= lo && s.diagnosis.soh.value < hi).length, color }))
    const flags = { GREEN: 0, AMBER: 0, RED: 0 }
    latest.forEach((s) => flags[s.diagnosis.safety.flag]++)
    const byMonth = new Map<string, { t: number; n: number; soh: number; lo: number; hi: number }>()
    for (const s of scans) {
      const d = new Date(s.createdAt)
      const k = `${d.getFullYear()}-${d.getMonth()}`
      const e = byMonth.get(k) ?? { t: new Date(d.getFullYear(), d.getMonth(), 1).getTime(), n: 0, soh: 0, lo: 0, hi: 0 }
      e.n++; e.soh += s.diagnosis.soh.value; e.lo += s.diagnosis.soh.low; e.hi += s.diagnosis.soh.high
      byMonth.set(k, e)
    }
    const months = [...byMonth.values()].sort((a, b) => a.t - b.t)
    const lab = (t: number) => new Date(t).toLocaleDateString('en-IN', { month: 'short' })
    const trend = months.map((m) => ({ label: lab(m.t), soh: Math.round((m.soh / m.n) * 10) / 10, band: [Math.round(m.lo / m.n), Math.round(m.hi / m.n)] as [number, number] }))
    const history = months.map((m) => ({ label: lab(m.t), value: m.n, color: '#3B82F6' }))
    const scatter = latest.map((s) => ({ x: Math.round((s.reading.cycles / CHEM[s.reading.chemistry].cycleLife) * 100), y: s.diagnosis.soh.value, id: s.batteryId, flag: s.diagnosis.safety.flag }))
    const depots = new Map<string, { n: number; soh: number }>()
    for (const b of batteries) {
      const s = latestScan(st, b.batteryId)
      if (!s) continue
      const e = depots.get(b.depot) ?? { n: 0, soh: 0 }
      e.n++; e.soh += s.diagnosis.soh.value
      depots.set(b.depot, e)
    }
    const depotBars = [...depots.entries()].map(([k, v]) => ({ label: k.split(' ')[0], value: Math.round(v.soh / v.n), color: '#14B8A6' }))
    const usage = (['CONTINUE', 'INSPECT', 'SECOND_LIFE', 'RECYCLE'] as const).map((u) => ({ u, n: latest.filter((s) => s.diagnosis.usage === u).length, list: latest.filter((s) => s.diagnosis.usage === u) }))
    return { latest, dist, flags, trend, history, scatter, depotBars, usage, scans }
  }, [st, veh, period]) // eslint-disable-line react-hooks/exhaustive-deps

  const [pick, setPick] = useState<string | null>(null)
  const sel = data.latest.find((s) => s.batteryId === pick) ?? [...data.latest].sort((a, b) => (b.diagnosis.safety.flag === 'RED' ? 1 : 0) - (a.diagnosis.safety.flag === 'RED' ? 1 : 0))[0]
  const avg = data.latest.length ? data.latest.reduce((a, s) => a + s.diagnosis.soh.value, 0) / data.latest.length : 0

  return (
    <>
      <TopBar title="Analytics" back right={<button onClick={() => setSheet(true)} className="tap flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-primary-600 active:bg-primary-soft"><SlidersHorizontal className="h-4 w-4" />Filters</button>} />
      <Page>
        <Segmented value={veh} onChange={setVeh} options={[{ value: 'all', label: 'All' }, { value: 'E-rickshaw', label: 'E-rickshaw' }, { value: 'two', label: '2-wheeler' }, { value: 'other', label: 'Cargo' }]} />
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[['Batteries', data.latest.length], ['Avg health', `${avg.toFixed(0)}%`], ['Scans', data.scans.length]].map(([l, v]) => (
            <Card key={l as string} className="p-3 text-center"><p className="text-[20px] font-bold text-ink">{v}</p><p className="text-[11.5px] text-muted">{l}</p></Card>
          ))}
        </div>

        <Section title="Battery health distribution" info="soh">
          <Card className="p-3 pt-4"><SimpleBars data={data.dist.map((d) => ({ ...d }))} /><p className="text-center text-[11.5px] text-muted">Batteries by State of Health (%)</p></Card>
        </Section>

        <Section title="Safety status distribution" info="sos">
          <Card className="flex items-center gap-4 p-4">
            <Donut size={120} center={`${data.latest.length}`} sub="batteries" data={[{ name: 'Green', value: data.flags.GREEN, color: '#14B8A6' }, { name: 'Amber', value: data.flags.AMBER, color: '#F59E0B' }, { name: 'Red', value: data.flags.RED, color: '#EF4444' }]} />
            <div className="flex-1 space-y-2 text-sm">
              {[['Green', data.flags.GREEN, 'bg-teal'], ['Amber', data.flags.AMBER, 'bg-warn'], ['Red', data.flags.RED, 'bg-crit']].map(([l, v, c]) => (
                <div key={l as string} className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted"><span className={cx('h-2.5 w-2.5 rounded-full', c as string)} />{l}</span><span className="font-bold text-ink">{v}</span></div>
              ))}
            </div>
          </Card>
        </Section>

        <Section title="Ageing trend" info="ageing">
          <Card className="p-3 pt-4">
            {data.trend.length > 1 ? <SohTrendChart points={data.trend} height={170} /> : <p className="py-10 text-center text-sm text-muted">Not enough scans in this period</p>}
            <p className="text-center text-[11.5px] text-muted">Average SoH of scans per month</p>
          </Card>
          <Card className="mt-3 p-3 pt-4">
            <p className="px-1 text-[13px] font-semibold text-ink">Health vs. rated cycle life used</p>
            <ResponsiveContainer width="100%" height={190}>
              <ScatterChart margin={{ top: 10, right: 12, left: -4, bottom: 4 }}>
                <CartesianGrid stroke="#EEF2F7" />
                <XAxis type="number" dataKey="x" name="Cycle life used" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                <YAxis type="number" dataKey="y" name="SoH" tickFormatter={(v) => `${v}%`} domain={[50, 100]} tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} width={48} />
                <ZAxis range={[70, 70]} />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} formatter={(v, n) => [`${v}%`, n]} labelFormatter={() => ''} />
                <Scatter data={data.scatter.filter((p) => p.flag === 'GREEN')} fill="#14B8A6" />
                <Scatter data={data.scatter.filter((p) => p.flag === 'AMBER')} fill="#F59E0B" />
                <Scatter data={data.scatter.filter((p) => p.flag === 'RED')} fill="#EF4444" />
              </ScatterChart>
            </ResponsiveContainer>
          </Card>
        </Section>

        {sel && (
          <Section title="Cell voltage comparison" info="median">
            <Card className="p-3">
              <button onClick={() => setPickOpen(true)} className="tap flex h-11 w-full items-center justify-between rounded-xl bg-subtle px-3 text-sm font-semibold text-ink">
                {sel.batteryId}<ChevronDown className="h-4 w-4 text-muted" />
              </button>
              <div className="mt-2"><CellDeviationChart cells={sel.diagnosis.safety.cells} selected={cell} onSelect={setCell} /></div>
              <p className="text-center text-[11.5px] text-muted">Deviation from pack median (mV) · tap a bar</p>
            </Card>
          </Section>
        )}

        <Section title="Scan history">
          <Card className="p-3 pt-4"><SimpleBars data={data.history} unit=" scans" /></Card>
        </Section>

        <Section title="Fleet health by depot">
          <Card className="p-3 pt-4"><SimpleBars data={data.depotBars} unit="% avg SoH" /></Card>
        </Section>

        <Section title="Second-life evaluation overview" info="secondLife">
          <div className="grid grid-cols-2 gap-2">
            {data.usage.map(({ u, n }) => (
              <Card key={u} className="p-3.5">
                <p className="text-[24px] font-bold text-ink">{n}</p>
                <p className="text-[12.5px] font-medium text-muted">{USAGE_META[u].label}</p>
              </Card>
            ))}
          </div>
          {data.usage.find((x) => x.u === 'SECOND_LIFE')!.list.length > 0 && (
            <Card className="mt-3 divide-y divide-line/80">
              <p className="px-4 pb-2 pt-3 text-xs font-semibold uppercase tracking-wide text-muted">Second-life candidates</p>
              {data.usage.find((x) => x.u === 'SECOND_LIFE')!.list.map((s) => (
                <button key={s.id} onClick={() => nav(`/battery/${s.id}/advice`)} className="tap flex h-12 w-full items-center justify-between px-4 text-left active:bg-subtle">
                  <span className="text-sm font-semibold text-ink">{s.batteryId}</span>
                  <span className="text-sm text-muted">{s.diagnosis.soh.value.toFixed(0)}% SoH</span>
                </button>
              ))}
              <p className="px-4 py-3 text-[12px] leading-relaxed text-muted">Candidates still require professional capacity and insulation testing before reuse.</p>
            </Card>
          )}
        </Section>
      </Page>

      <Sheet open={sheet} onClose={() => setSheet(false)} title="Filters">
        <p className="text-sm font-semibold text-ink">Vehicle type</p>
        <Segmented className="mt-2" value={veh} onChange={setVeh} options={[{ value: 'all', label: 'All' }, { value: 'E-rickshaw', label: 'E-rickshaw' }, { value: 'two', label: '2-wheeler' }, { value: 'other', label: 'Cargo' }]} />
        <p className="mt-5 text-sm font-semibold text-ink">Scan period</p>
        <Segmented className="mt-2" value={period} onChange={setPeriod} options={[{ value: 'all', label: 'All time' }, { value: '180', label: '6 months' }, { value: '90', label: '90 days' }]} />
        <button onClick={() => setSheet(false)} className="tap mt-6 h-12 w-full rounded-xl bg-primary font-semibold text-white">Apply</button>
      </Sheet>
      <Sheet open={pickOpen} onClose={() => setPickOpen(false)} title="Choose battery">
        <div className="-mx-2">
          {data.latest.map((s) => (
            <button key={s.id} onClick={() => { setPick(s.batteryId); setPickOpen(false); setCell(null) }} className="tap flex h-12 w-full items-center justify-between rounded-xl px-3 text-[15px] active:bg-subtle">
              <span>{s.batteryId} <span className="text-sm text-muted">· {s.reading.vehicleType}</span></span>
              {sel?.batteryId === s.batteryId && <Check className="h-5 w-5 text-primary" />}
            </button>
          ))}
        </div>
      </Sheet>
      {sel && <CellSheet cell={cell ? sel.diagnosis.safety.cells[cell - 1] : null} medianMv={sel.diagnosis.safety.medianMv} onClose={() => setCell(null)} />}
    </>
  )
}
