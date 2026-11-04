import { Activity, AlertOctagon, ArrowRight, BadgeCheck, Bluetooth, BookOpenCheck, Brain, CheckCircle2, ChevronDown, ClipboardCheck, Cpu, FlaskConical, Info, Loader2, Recycle, Search, ShieldAlert, ShieldCheck, Sun, Thermometer, TrendingDown, Wrench, Zap } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Badge, Button, Card, Divided, Empty, InfoButton, KV, Page, Section, Segmented, StatusPill, TopBar, cx, toast } from '../components/ui'
import { CellGrid, SohGauge, SohRing } from '../components/visuals'
import { CellSheet } from '../components/CellSheet'
import { CellDeviationChart, LoadTestChart, SohTrendChart } from '../components/charts'
import { batteryScans, useApp } from '../store/app'
import { FLAG_META, fmtDateTime, fmtShort, relTime, USAGE_META } from '../lib/format'
import { buildRecommendation } from '../ml/recommend'
import { issuePassport } from '../lib/passport'
import type { ScanRecord, UsageCategory } from '../types'
import { CHEM } from '../ml/chemistry'

type Tab = 'overview' | 'diagnosis' | 'advice'

export default function Battery() {
  const { scanId, tab: tabParam } = useParams()
  const nav = useNavigate()
  const scan = useApp((s) => (scanId ? s.scans[scanId] : undefined))
  const tab: Tab = tabParam === 'diagnosis' || tabParam === 'advice' ? tabParam : 'overview'
  const markTour = useApp((s) => s.markTour)
  useEffect(() => {
    if (!scan || scan.reading.profileId !== 'faulty' || !scan.id.startsWith('scan-u-')) return
    if (tab === 'diagnosis') markTour('diagnosis')
    if (tab === 'advice') markTour('advice')
  }, [tab, scan, markTour])

  if (!scan)
    return (
      <>
        <TopBar title="Battery" back />
        <Page><Empty icon={<Search />} title="Scan not found" text="This scan may have been removed by a demo reset." action={<Button onClick={() => nav('/')}>Go home</Button>} /></Page>
      </>
    )

  const setTab = (t: Tab) => nav(`/battery/${scan.id}${t === 'overview' ? '' : `/${t}`}`, { replace: true })
  return (
    <>
      <TopBar title={scan.batteryId} subtitle={`${scan.reading.category} · ${relTime(scan.createdAt)}`} back right={<button onClick={() => nav(`/fleet/${scan.batteryId}`)} className="tap flex h-10 items-center rounded-full px-3 text-sm font-semibold text-primary-600 active:bg-primary-soft">History</button>} />
      <div className="sticky z-20 bg-bg/90 px-4 pb-3 backdrop-blur-md" style={{ top: 'calc(var(--sat) + 56px)' }}>
        <div className="mx-auto max-w-[448px]">
          <Segmented value={tab} onChange={setTab} options={[{ value: 'overview', label: 'Overview' }, { value: 'diagnosis', label: 'Diagnosis' }, { value: 'advice', label: 'Advice' }]} />
        </div>
      </div>
      <Page className="animate-fade-up" key={tab}>
        <SourceBanner scan={scan} />
        {tab === 'overview' && <Overview scan={scan} />}
        {tab === 'diagnosis' && <Diagnosis scan={scan} />}
        {tab === 'advice' && <Advice scan={scan} />}
      </Page>
    </>
  )
}

function SourceBanner({ scan }: { scan: ScanRecord }) {
  const demo = scan.reading.source === 'demo'
  return (
    <div className={cx('mb-4 flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[12.5px]', demo ? 'bg-warn-soft text-warn-ink' : 'bg-primary-soft text-primary-700')}>
      {demo ? <FlaskConical className="h-4 w-4 shrink-0" /> : <Bluetooth className="h-4 w-4 shrink-0" />}
      <span className="min-w-0 flex-1 leading-snug">
        {demo ? <><b>Demonstration data.</b> {scan.reading.sourceLabel}. Not a real battery assessment.</> : <><b>Live data</b> from {scan.reading.deviceName} ({scan.reading.protocol}) · {fmtDateTime(scan.createdAt)}</>}
      </span>
    </div>
  )
}

// ------------------------------------------------------------------ Overview
function Overview({ scan }: { scan: ScanRecord }) {
  const r = scan.reading
  const d = scan.diagnosis
  const nav = useNavigate()
  const [sel, setSel] = useState<number | null>(null)
  const markTour = useApp((s) => s.markTour)
  const temps = r.cellTempsC?.length ? r.cellTempsC : r.sensorTempsC
  return (
    <>
      <Card className="flex items-center gap-4 p-4" onClick={() => nav(`/battery/${scan.id}/diagnosis`)}>
        <SohRing value={d.soh.value} size={64} stroke={7} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-[13px] text-muted">State of Health</p>
          <p className="text-[17px] font-semibold text-ink">{d.soh.value.toFixed(0)}% <span className="text-sm font-normal text-muted">({d.soh.low.toFixed(0)}–{d.soh.high.toFixed(0)}%)</span></p>
          <div className="mt-1.5"><StatusPill flag={d.safety.flag} size="sm" label={`${FLAG_META[d.safety.flag].short}${d.safety.suspectCell ? ` · cell ${d.safety.suspectCell}` : ''}`} /></div>
        </div>
        <ArrowRight className="h-5 w-5 text-faint" />
      </Card>

      <Section title="Live pack data">
        <div className="grid grid-cols-2 gap-2.5">
          <Metric icon={<Zap />} label="Pack voltage" value={`${r.packV.toFixed(2)} V`} sub={`Nominal ${r.nominalV} V`} info="nominal" />
          <Metric icon={<Activity />} label="Pack current" value={`${r.packA.toFixed(1)} A`} sub={r.packA === 0 ? 'At rest' : r.packA > 0 ? 'Charging' : 'Discharging'} />
          <Metric icon={<Thermometer />} label="Temperature" value={`${Math.max(...temps).toFixed(1)} °C`} sub={`${r.sensorTempsC.length} sensors · max`} info="temperature" />
          <Metric icon={<Cpu />} label="Cycle count" value={`${r.cycles}`} sub={`${Math.round((r.cycles / CHEM[r.chemistry].cycleLife) * 100)}% of rated life`} info="cycles" />
        </div>
      </Section>

      <Section title="Battery details">
        <Divided>
          <KV label="Battery ID" value={r.batteryId} />
          <KV label="Category" value={r.category} />
          <KV label="Chemistry" value={`${r.chemistry} · ${r.seriesCells}S${r.parallel}P`} />
          <KV label="Nominal voltage" value={`${r.nominalV} V`} info="nominal" />
          <KV label="Rated capacity" value={`${r.ratedAh} Ah`} info="rated" />
          <KV label="Remaining capacity" value={`${r.remainingAh} Ah · ${r.soc}% SoC`} info="soc" />
          <KV label="BMS full capacity" value={`${r.bmsFullAh} Ah`} />
          <KV label="Scanned" value={fmtDateTime(scan.createdAt)} />
        </Divided>
      </Section>

      <Section title="Cell layout" info="cellVoltage" action={<span className="text-xs text-muted">Tap a cell</span>}>
        <Card className="p-3">
          <CellGrid cells={d.safety.cells} selected={sel} medianMv={d.safety.medianMv} onSelect={(i) => { setSel(i); if (i === d.safety.suspectCell && r.profileId === 'faulty') markTour('cell') }} />
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11.5px] text-muted">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-teal" />Normal</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-warn" />Warning</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-crit" />Critical</span>
            <span>Median {(d.safety.medianMv / 1000).toFixed(3)} V · spread {d.safety.spreadMv} mV</span>
          </div>
        </Card>
      </Section>

      {r.loadTest && (
        <Section title="Guided load test" info="sag">
          <Card className="p-3 pt-4">
            <p className="px-1 text-[13px] text-muted">Pack voltage during the 20 s load at {r.loadTest.currentA.toFixed(0)} A (shaded)</p>
            <LoadTestChart lt={r.loadTest} />
          </Card>
        </Section>
      )}

      <Section title="BMS protection events" info="protection">
        {r.protectionEvents.length ? (
          <Divided>
            {r.protectionEvents.map((e) => (
              <div key={e.code + e.label} className="flex min-h-[52px] items-center gap-3 px-4 py-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-warn-soft text-warn-ink"><ShieldAlert className="h-4 w-4" /></span>
                <span className="flex-1 text-sm font-medium text-ink">{e.label}</span>
                <Badge tone="amber">{e.count}×</Badge>
              </div>
            ))}
          </Divided>
        ) : (
          <Card className="flex items-center gap-3 p-4 text-sm text-muted"><CheckCircle2 className="h-5 w-5 text-ok" />No protection events reported by the BMS.</Card>
        )}
      </Section>

      <Button size="lg" full className="mt-6" onClick={() => nav(`/battery/${scan.id}/diagnosis`)} icon={<Brain className="h-5 w-5" />}>View AI diagnosis</Button>
      <CellSheet cell={sel ? d.safety.cells[sel - 1] : null} medianMv={d.safety.medianMv} onClose={() => setSel(null)} />
    </>
  )
}

function Metric({ icon, label, value, sub, info }: { icon: React.ReactNode; label: string; value: string; sub: string; info?: Parameters<typeof InfoButton>[0]['k'] }) {
  return (
    <Card className="p-3.5">
      <div className="flex items-center justify-between text-muted [&>span>svg]:h-4 [&>span>svg]:w-4">
        <span className="flex items-center gap-1.5 text-[12.5px] font-medium">{icon}{label}</span>
        {info && <InfoButton k={info} />}
      </div>
      <p className="mt-1.5 text-[20px] font-bold tabular-nums tracking-tight text-ink">{value}</p>
      <p className="mt-0.5 truncate text-xs text-muted">{sub}</p>
    </Card>
  )
}

// ------------------------------------------------------------------ Diagnosis
function Diagnosis({ scan }: { scan: ScanRecord }) {
  const d = scan.diagnosis
  const r = scan.reading
  const nav = useNavigate()
  const [sel, setSel] = useState<number | null>(null)
  const [mode, setMode] = useState<'dev' | 'v'>('dev')
  const [showFeat, setShowFeat] = useState(false)
  const st = useApp()
  const history = useMemo(() => batteryScans(st, scan.batteryId).filter((s) => s.createdAt <= scan.createdAt), [st, scan])
  const meta = FLAG_META[d.safety.flag]
  const safetyRef = useRef<HTMLDivElement>(null)
  const isTourScan = r.profileId === 'faulty' && scan.id.startsWith('scan-u-')

  useEffect(() => {
    if (!isTourScan || !safetyRef.current) return
    const io = new IntersectionObserver((e) => e[0].isIntersecting && st.markTour('safety'), { threshold: 0.6 })
    io.observe(safetyRef.current)
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTourScan])

  const over = d.soh.bmsReported - d.soh.value
  const FlagIcon = d.safety.flag === 'GREEN' ? ShieldCheck : d.safety.flag === 'AMBER' ? ShieldAlert : AlertOctagon
  return (
    <>
      {/* Safety first when abnormal */}
      <div ref={safetyRef}>
        <Card className={cx('overflow-hidden border', meta.ring)}>
          <div className={cx('flex items-start gap-3 p-4', meta.bg)}>
            <span className={cx('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white', meta.text)}><FlagIcon className="h-6 w-6" /></span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <p className={cx('text-xs font-bold uppercase tracking-wider', meta.text)}>State of Safety · {d.safety.flag}</p>
                <InfoButton k="sos" />
              </div>
              <p className="mt-0.5 text-[16px] font-semibold leading-snug text-ink">{d.safety.headline}</p>
            </div>
          </div>
          {d.safety.suspectCell && (
            <button onClick={() => { setSel(d.safety.suspectCell); if (isTourScan) st.markTour('cell') }} className="tap flex w-full items-center gap-3 border-t border-line/70 px-4 py-3 text-left active:bg-subtle">
              <span className={cx('flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-white', d.safety.flag === 'RED' ? 'bg-crit' : 'bg-warn')}>C{d.safety.suspectCell}</span>
              <span className="flex-1">
                <span className="block text-sm font-semibold text-ink">Suspected cell: {d.safety.suspectCell}</span>
                <span className="block text-xs text-muted">Tap to inspect its data</span>
              </span>
              <ArrowRight className="h-4 w-4 text-faint" />
            </button>
          )}
          <div className="space-y-3 border-t border-line/70 p-4">
            {d.safety.findings.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Detected abnormality</p>
                <ul className="mt-2 space-y-2">
                  {d.safety.findings.map((f) => (
                    <li key={f.key} className="flex gap-2.5">
                      <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', f.level === 2 ? 'bg-crit' : 'bg-warn')} />
                      <span>
                        <span className="block text-sm font-semibold text-ink">{f.title}</span>
                        <span className="block text-[13px] leading-relaxed text-muted">{f.detail}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">What this means</p>
              <p className="mt-1 text-sm leading-relaxed text-ink">{d.safety.explanation}</p>
            </div>
            <div className={cx('rounded-xl p-3', d.safety.flag === 'GREEN' ? 'bg-subtle' : meta.bg)}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Recommended next action</p>
              <p className="mt-1 text-sm font-medium leading-relaxed text-ink">{d.safety.nextAction}</p>
            </div>
          </div>
        </Card>
      </div>
      <p className="mt-2 flex gap-1.5 px-1 text-[11.5px] leading-relaxed text-muted">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />Prototype screening and decision-support tool, not a certified safety assessment. It cannot guarantee a battery is safe or predict a fire.
      </p>

      {/* SoH */}
      <Section title="State of Health" info="soh">
        <Card className="p-4">
          <div className="flex justify-center"><SohGauge value={d.soh.value} low={d.soh.low} high={d.soh.high} /></div>
          <div className="mt-2 grid grid-cols-3 divide-x divide-line rounded-xl bg-subtle py-3 text-center">
            <div><p className="text-[11px] text-muted">Remaining</p><p className="text-[15px] font-bold text-ink">{d.ageing.remainingAh} Ah</p></div>
            <div><p className="text-[11px] text-muted">of rated</p><p className="text-[15px] font-bold text-ink">{r.ratedAh} Ah</p></div>
            <div><p className="flex items-center justify-center text-[11px] text-muted">Ageing</p><p className={cx('text-[13px] font-bold', ['text-ok-ink', 'text-warn-ink', 'text-crit-ink'][d.ageing.level])}>{d.ageing.label}</p></div>
          </div>
          {over > 2 && (
            <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-primary-soft p-3 text-[13px] text-primary-700">
              <TrendingDown className="mt-0.5 h-4 w-4 shrink-0" />
              <span>The BMS reports <b>{d.soh.bmsReported.toFixed(0)}%</b>. Voltrace’s model corrects this optimistic figure by {over.toFixed(0)} points using resistance, sag and cycle data.</span>
            </div>
          )}
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1 text-[12px] text-muted">90% confidence range<InfoButton k="confidence" /></span>
            <Badge tone="blue"><Brain className="h-3 w-3" />{d.soh.model} · {d.engine}</Badge>
          </div>
          <button onClick={() => setShowFeat((v) => !v)} className="tap mt-2 flex h-11 w-full items-center justify-between rounded-xl px-1 text-sm font-medium text-primary-600">
            What the model used
            <ChevronDown className={cx('h-4 w-4 transition', showFeat && 'rotate-180')} />
          </button>
          {showFeat && (
            <div className="divide-y divide-line/80 rounded-xl border border-line text-sm">
              {[
                ['Cycle count', `${r.cycles} (${(d.features.cycle_frac * 100).toFixed(0)}% of rated life)`, 'cycles'],
                ['Internal resistance', d.features.r_growth ? `${d.features.r_growth.toFixed(2)}× new-cell reference` : 'Not measured', 'resistance'],
                ['Voltage drop under load', r.loadTest ? `${Math.round(r.loadTest.restMv.reduce((a, b, i) => a + b - r.loadTest!.stepMv[i], 0))} mV at ${r.loadTest.currentA.toFixed(0)} A` : 'Not measured', 'sag'],
                ['Voltage recovery', d.features.recovery_ratio ? `${(d.features.recovery_ratio * 100).toFixed(0)}% of sag recovered` : 'Not measured', 'sag'],
                ['Average temperature', `${d.features.avg_temp_c} °C`, 'temperature'],
                ['BMS-reported capacity', `${d.features.bms_soh}%`, 'soh'],
              ].map(([l, v, k]) => (
                <div key={l} className="flex min-h-[44px] items-center justify-between gap-2 px-3 py-2">
                  <span className="flex items-center gap-1 text-muted">{l}<InfoButton k={k as 'soh'} /></span>
                  <span className="text-right font-semibold text-ink">{v}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </Section>

      {history.length > 1 && (
        <Section title="Health trend">
          <Card className="p-3 pt-4">
            <SohTrendChart points={history.map((h) => ({ label: fmtShort(h.createdAt), soh: h.diagnosis.soh.value, band: [h.diagnosis.soh.low, h.diagnosis.soh.high] }))} height={160} />
            <div className="mt-1 flex flex-wrap gap-1.5 px-1">
              {history.map((h) => <StatusPill key={h.id} flag={h.diagnosis.safety.flag} size="sm" label={`${fmtShort(h.createdAt)} · ${FLAG_META[h.diagnosis.safety.flag].short}`} />)}
            </div>
          </Card>
        </Section>
      )}

      {/* Cells */}
      <Section title="Cell analysis" info="median">
        <Card className="p-3 pt-3.5">
          <Segmented value={mode} onChange={setMode} options={[{ value: 'dev', label: 'vs median (mV)' }, { value: 'v', label: 'Voltage (V)' }]} />
          <div className="mt-3"><CellDeviationChart cells={d.safety.cells} selected={sel} onSelect={(i) => { setSel(i); if (i === d.safety.suspectCell && isTourScan) st.markTour('cell') }} mode={mode} /></div>
          <p className="px-1 text-center text-[11.5px] text-muted">Cell number · dashed lines mark ±30 mV · tap a bar</p>
          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {d.safety.cells.map((c) => (
              <button key={c.index} onClick={() => setSel(c.index)} className={cx('tap h-9 min-w-[42px] shrink-0 rounded-lg text-xs font-semibold', c.state === 'critical' ? 'bg-crit text-white' : c.state === 'warning' ? 'bg-warn text-white' : 'bg-subtle text-ink')}>{c.index}</button>
            ))}
          </div>
        </Card>
        <Card className="mt-3 p-4">
          <p className="text-sm font-semibold text-ink">Why can a cell be abnormal?</p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">All cells in a pack are charged and discharged together, so they should behave like identical siblings. A cell that rests at a lower voltage, sags more under load, runs warmer, or keeps losing charge on its own usually has higher internal resistance or a developing internal short. Voltrace compares every cell with the pack median, so the method works for any brand.</p>
        </Card>
      </Section>

      <Button size="lg" full className="mt-6" onClick={() => nav(`/battery/${scan.id}/advice`)} icon={<ClipboardCheck className="h-5 w-5" />}>View recommendation</Button>
      <CellSheet cell={sel ? d.safety.cells[sel - 1] : null} medianMv={d.safety.medianMv} onClose={() => setSel(null)} />
    </>
  )
}

// ------------------------------------------------------------------ Advice
const CAT_ICON: Record<UsageCategory, typeof Wrench> = { CONTINUE: CheckCircle2, INSPECT: Wrench, SECOND_LIFE: Sun, RECYCLE: Recycle }
const CAT_TONE: Record<UsageCategory, string> = { CONTINUE: 'bg-ok-soft text-ok-ink', INSPECT: 'bg-warn-soft text-warn-ink', SECOND_LIFE: 'bg-teal-soft text-teal-700', RECYCLE: 'bg-crit-soft text-crit-ink' }

function Advice({ scan }: { scan: ScanRecord }) {
  const { main, extras } = useMemo(() => buildRecommendation(scan), [scan])
  const nav = useNavigate()
  const st = useApp()
  const [busy, setBusy] = useState(false)
  const Icon = CAT_ICON[main.category]
  const demo = scan.reading.source === 'demo'
  const isTourScan = scan.reading.profileId === 'faulty' && scan.id.startsWith('scan-u-')

  const generate = async () => {
    if (scan.passportId && st.passports[scan.passportId]) return nav(`/passport/${scan.passportId}`)
    setBusy(true)
    const res = await issuePassport(scan, st.settings.offlineDemoSigning)
    setBusy(false)
    if ('error' in res) return toast(res.error, 'err')
    st.addPassport(res)
    if (isTourScan) st.markTour('passport')
    toast(res.signer === 'server' ? 'Passport signed by Voltrace server' : 'Passport signed with offline demo key')
    nav(`/passport/${res.payload.pid}`)
  }

  return (
    <>
      {demo && (
        <div className="mb-4 rounded-xl border border-warn-line bg-white p-3.5 text-[13px] leading-relaxed text-warn-ink">
          <b>This recommendation illustrates the method using simulated data.</b> It must not be used to decide whether a real battery continues in service or is reused.
        </div>
      )}
      <Card className="overflow-hidden">
        <div className="p-4">
          <div className="flex items-center gap-3">
            <span className={cx('flex h-12 w-12 items-center justify-center rounded-2xl', CAT_TONE[main.category])}><Icon className="h-6 w-6" /></span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Recommendation</p>
              <p className="text-[13px] font-semibold text-ink">{USAGE_META[main.category].label}</p>
            </div>
          </div>
          <h2 className="mt-3 text-[19px] font-bold leading-snug text-ink">{main.title}</h2>
        </div>
        <div className="divide-y divide-line/70 border-t border-line/70">
          <QA n={1} q="What was detected?" a={main.detected} />
          <QA n={2} q="Why does it matter?" a={main.why} />
          <div className="p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink"><Num n={3} />What should you do?</p>
            <ol className="mt-2 space-y-2 pl-8">
              {main.todo.map((t, i) => <li key={i} className="relative text-sm leading-relaxed text-ink/90"><span className="absolute -left-5 top-[9px] h-1.5 w-1.5 rounded-full bg-primary" />{t}</li>)}
            </ol>
          </div>
          <div className="p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink"><Num n={4} />Is professional inspection necessary?</p>
            <div className={cx('ml-8 mt-2 rounded-xl p-3 text-sm', main.inspection.level === 'Required' ? 'bg-crit-soft text-crit-ink' : main.inspection.level === 'Recommended' ? 'bg-warn-soft text-warn-ink' : 'bg-ok-soft text-ok-ink')}>
              <b>{main.inspection.level}.</b> {main.inspection.text}
            </div>
          </div>
        </div>
      </Card>

      <Section title="Usage pathway" info="secondLife">
        <div className="grid grid-cols-2 gap-2">
          {(['CONTINUE', 'INSPECT', 'SECOND_LIFE', 'RECYCLE'] as UsageCategory[]).map((c) => {
            const I = CAT_ICON[c]
            const on = c === main.category
            return (
              <div key={c} className={cx('rounded-xl border p-3', on ? 'border-primary bg-card ring-2 ring-primary/15' : 'border-line bg-card opacity-60')}>
                <span className={cx('flex h-8 w-8 items-center justify-center rounded-lg', CAT_TONE[c])}><I className="h-4 w-4" /></span>
                <p className="mt-2 text-[13px] font-semibold leading-tight text-ink">{USAGE_META[c].label}</p>
                {on && <p className="mt-1 text-[11px] font-semibold text-primary-600">This battery</p>}
              </div>
            )
          })}
        </div>
      </Section>

      {extras.length > 0 && (
        <Section title="Also noted">
          <div className="space-y-2">
            {extras.map((e) => (
              <Card key={e.title} className="p-3.5">
                <p className={cx('text-sm font-semibold', e.tone === 'amber' ? 'text-warn-ink' : e.tone === 'red' ? 'text-crit-ink' : e.tone === 'teal' ? 'text-teal-700' : 'text-primary-700')}>{e.title}</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{e.text}</p>
              </Card>
            ))}
          </div>
        </Section>
      )}

      <Card className="mt-6 bg-gradient-to-br from-primary-soft to-teal-soft p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-primary-600"><BookOpenCheck className="h-5 w-5" /></span>
          <div className="flex-1">
            <p className="text-[15px] font-semibold text-ink">{scan.passportId ? 'Battery Passport issued' : 'Create a Battery Passport'}</p>
            <p className="text-[12.5px] text-muted">Signed, tamper-evident record with a verification QR code</p>
          </div>
        </div>
        <Button size="lg" full className="mt-4" disabled={busy} onClick={generate} icon={busy ? <Loader2 className="h-5 w-5 animate-spin" /> : scan.passportId ? <BadgeCheck className="h-5 w-5" /> : <BookOpenCheck className="h-5 w-5" />}>
          {busy ? 'Signing passport…' : scan.passportId ? 'View Battery Passport' : 'Generate Battery Passport'}
        </Button>
      </Card>
    </>
  )
}

const Num = ({ n }: { n: number }) => <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary-700">{n}</span>
function QA({ n, q, a }: { n: number; q: string; a: string }) {
  return (
    <div className="p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-ink"><Num n={n} />{q}</p>
      <p className="ml-8 mt-1.5 text-sm leading-relaxed text-ink/80">{a}</p>
    </div>
  )
}
