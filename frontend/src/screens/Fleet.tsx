import { ChevronRight, Search, Truck, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Card, Empty, Page, Section, StatusPill, TopBar, cx, InfoButton } from '../components/ui'
import { SohRing } from '../components/visuals'
import { AlertRow } from '../components/rows'
import { Donut, SohTrendChart } from '../components/charts'
import { useFleetSummary } from '../lib/hooks'
import { latestScan, useApp } from '../store/app'
import { FLEET_CITY, FLEET_NAME } from '../data/fleet'
import { relTime } from '../lib/format'

type F = 'ALL' | 'GREEN' | 'AMBER' | 'RED' | 'ALERT'

export default function Fleet() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const st = useApp()
  const { flags, avg, total, alerts, allScans } = useFleetSummary()
  const [q, setQ] = useState('')
  const [f, setF] = useState<F>((params.get('f') as F) || 'ALL')
  useEffect(() => { st.markTour('fleet') }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return st.fleet
      .map((b) => ({ b, s: latestScan(st, b.batteryId)! }))
      .filter((x) => x.s)
      .filter(({ b }) => !needle || [b.batteryId, b.vehicleReg, b.vehicleType, b.depot].some((v) => v.toLowerCase().includes(needle)))
      .filter(({ s }) => f === 'ALL' || (f === 'ALERT' ? s.diagnosis.safety.flag !== 'GREEN' : s.diagnosis.safety.flag === f))
      .sort((a, b) => {
        const r = (x: string) => (x === 'RED' ? 0 : x === 'AMBER' ? 1 : 2)
        return r(a.s.diagnosis.safety.flag) - r(b.s.diagnosis.safety.flag) || a.s.diagnosis.soh.value - b.s.diagnosis.soh.value
      })
  }, [st, q, f])

  // fleet average SoH by month (scan-weighted)
  const trend = useMemo(() => {
    const m = new Map<string, { sum: number; n: number; lo: number; hi: number; t: number }>()
    for (const s of allScans) {
      const d = new Date(s.createdAt)
      const k = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`
      const e = m.get(k) ?? { sum: 0, n: 0, lo: 0, hi: 0, t: d.getTime() }
      e.sum += s.diagnosis.soh.value; e.lo += s.diagnosis.soh.low; e.hi += s.diagnosis.soh.high; e.n++
      m.set(k, e)
    }
    return [...m.values()].sort((a, b) => a.t - b.t).slice(-7).map((e) => ({
      label: new Date(e.t).toLocaleDateString('en-IN', { month: 'short' }),
      soh: Math.round((e.sum / e.n) * 10) / 10,
      band: [Math.round(e.lo / e.n), Math.round(e.hi / e.n)] as [number, number],
    }))
  }, [allScans])

  return (
    <>
      <TopBar large title="Fleet" subtitle={`${FLEET_NAME} · ${FLEET_CITY}`} />
      <Page>
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <Donut size={124} center={`${avg.toFixed(0)}%`} sub="avg health" data={[
              { name: 'Green', value: flags.GREEN, color: '#14B8A6' },
              { name: 'Warning', value: flags.AMBER, color: '#F59E0B' },
              { name: 'Critical', value: flags.RED, color: '#EF4444' },
            ]} />
            <div className="flex-1 space-y-2.5">
              {[
                ['Total batteries', total, 'bg-primary'],
                ['No alerts (green)', flags.GREEN, 'bg-teal'],
                ['Warning', flags.AMBER, 'bg-warn'],
                ['Critical', flags.RED, 'bg-crit'],
              ].map(([l, v, c]) => (
                <div key={l as string} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted"><span className={cx('h-2.5 w-2.5 rounded-full', c as string)} />{l}</span>
                  <span className="font-bold tabular-nums text-ink">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {alerts.length > 0 && (
          <Section title="Fleet safety alerts" info="sos">
            <div className="space-y-2.5">{alerts.map((a) => <AlertRow key={a.id} a={a} />)}</div>
          </Section>
        )}

        <Section title={<span className="flex items-center gap-1">Fleet health trend<InfoButton k="confidence" /></span>}>
          <Card className="p-3 pt-4">
            <SohTrendChart points={trend} height={170} />
            <p className="px-1 text-center text-[11.5px] text-muted">Average State of Health of scans each month · shaded: average 90% range</p>
          </Card>
        </Section>

        <Section title="Batteries">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ID, registration or depot" aria-label="Search fleet" className="h-12 w-full rounded-xl border border-line bg-card pl-10 pr-10 text-[15px] outline-none placeholder:text-faint focus:border-primary" />
            {q && <button aria-label="Clear" onClick={() => setQ('')} className="tap absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center text-faint"><X className="h-4 w-4" /></button>}
          </div>
          <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 no-scrollbar">
            {([['ALL', 'All'], ['ALERT', 'Needs attention'], ['GREEN', 'No alerts'], ['AMBER', 'Warning'], ['RED', 'Critical']] as [F, string][]).map(([v, l]) => (
              <button key={v} onClick={() => setF(v)} className={cx('tap h-9 shrink-0 rounded-full px-3.5 text-[13px] font-semibold', f === v ? 'bg-ink text-white' : 'bg-card text-muted ring-1 ring-line')}>{l}</button>
            ))}
          </div>
          <Card className="mt-3 divide-y divide-line/80 overflow-hidden">
            {rows.map(({ b, s }) => (
              <button key={b.batteryId} onClick={() => nav(`/fleet/${b.batteryId}`)} className="tap flex min-h-[72px] w-full items-center gap-3 px-4 py-3 text-left active:bg-subtle/70">
                <SohRing value={s.diagnosis.soh.value} size={46} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-ink">{b.batteryId}</p>
                  <p className="truncate text-[12.5px] text-muted">{b.vehicleType} · {b.vehicleReg}</p>
                  <p className="truncate text-[12px] text-faint">Last scan {relTime(s.createdAt)}</p>
                </div>
                <StatusPill flag={s.diagnosis.safety.flag} size="sm" label={s.diagnosis.safety.flag === 'GREEN' ? 'No alerts' : s.diagnosis.safety.flag === 'AMBER' ? 'Warning' : 'Critical'} />
                <ChevronRight className="h-5 w-5 shrink-0 text-faint" />
              </button>
            ))}
            {rows.length === 0 && <Empty icon={<Truck />} title="No batteries match" text="Try a different search or filter." />}
          </Card>
        </Section>
      </Page>
    </>
  )
}
