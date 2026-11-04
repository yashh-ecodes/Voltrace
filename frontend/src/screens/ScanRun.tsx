import { Check, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, StatusPill, cx } from '../components/ui'
import { BatteryArt } from '../components/visuals'
import { buildReading, profileById } from '../data/profiles'
import { diagnose } from '../ml/engine'
import { latestScan, useApp } from '../store/app'
import type { DemoProfileId, ScanRecord } from '../types'

const STAGES = [
  { t: 'Identifying battery', d: 'Reading pack ID, chemistry and configuration from the BMS.' },
  { t: 'Connecting to BMS', d: 'Opening a secure read-only session with the battery management system.' },
  { t: 'Retrieving cell data', d: 'Reading every cell voltage, pack current and temperature sensors.' },
  { t: 'Analysing voltage and temperature', d: 'Running a 20-second guided load test and measuring each cell’s response.' },
  { t: 'Estimating battery health', d: 'XGBoost model estimates State of Health with a 90% confidence range.' },
  { t: 'Checking abnormal cell behaviour', d: 'Isolation Forest and safety rules compare every cell with its siblings.' },
  { t: 'Generating diagnostic results', d: 'Preparing your health report and recommendations.' },
]
const STAGE_MS = [650, 700, 900, 1300, 900, 1000, 600]

export default function ScanRun() {
  const { profileId } = useParams<{ profileId: DemoProfileId }>()
  const profile = profileById((profileId ?? 'healthy') as DemoProfileId)
  const nav = useNavigate()
  const st = useApp()
  const [stage, setStage] = useState(0)
  const [result, setResult] = useState<ScanRecord | null>(null)
  const [cellsShown, setCellsShown] = useState(0)
  const started = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    if (started.current) return
    started.current = true
    st.markTour('start')
    const run = async () => {
      const now = new Date().toISOString()
      const prev = latestScan(useApp.getState(), profile.spec.batteryId)
      const reading = buildReading(profile.spec, now, profile.id, prev ? { timestamp: prev.createdAt, cellsMv: prev.reading.cellsMv } : undefined)
      const diagP = diagnose(reading, { cloud: useApp.getState().settings.cloudInference })
      for (let i = 0; i < STAGES.length; i++) {
        if (!mounted.current) return
        setStage(i)
        if (i === 2) {
          for (let c = 1; c <= reading.seriesCells; c++) {
            setCellsShown(c)
            await wait(STAGE_MS[2] / reading.seriesCells)
          }
        } else await wait(STAGE_MS[i])
      }
      const diagnosis = await diagP
      if (!mounted.current) return
      const rec: ScanRecord = { id: `scan-u-${Date.now().toString(36)}`, batteryId: reading.batteryId, createdAt: now, reading, diagnosis }
      useApp.getState().addScan(rec)
      useApp.getState().setLastProfile(profile.id)
      useApp.getState().markTour('watch')
      setStage(STAGES.length)
      setResult(rec)
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const progress = result ? 100 : Math.round((STAGE_MS.slice(0, stage).reduce((a, b) => a + b, 0) / STAGE_MS.reduce((a, b) => a + b, 0)) * 100)
  const flag = result?.diagnosis.safety.flag

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-gradient-to-b from-[#EEF5FF] via-bg to-bg">
      <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col px-5 pt-safe">
        <div className="flex h-14 items-center justify-between">
          <button aria-label="Cancel scan" onClick={() => nav('/scan', { replace: true })} className="tap -ml-2 flex h-11 w-11 items-center justify-center rounded-full text-ink active:bg-white"><X className="h-6 w-6" /></button>
          <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-warn-ink ring-1 ring-warn-line">Demo · {profile.name}</span>
          <span className="w-11" />
        </div>

        <div className="relative mx-auto mt-4 flex h-[200px] w-[200px] items-center justify-center">
          <svg viewBox="0 0 200 200" className="absolute inset-0 -rotate-90">
            <circle cx="100" cy="100" r="92" stroke="#E2E8F0" strokeWidth="6" fill="none" />
            <circle cx="100" cy="100" r="92" stroke="url(#pg)" strokeWidth="6" fill="none" strokeLinecap="round" strokeDasharray={`${(578 * progress) / 100} 578`} style={{ transition: 'stroke-dasharray .5s ease' }} />
            <defs><linearGradient id="pg"><stop offset="0" stopColor="#3B82F6" /><stop offset="1" stopColor="#14B8A6" /></linearGradient></defs>
          </svg>
          {!result && <span className="absolute h-[150px] w-[150px] animate-pulsering rounded-full bg-primary/10" />}
          <div className="relative flex flex-col items-center">
            {result ? (
              <span className={cx('flex h-20 w-20 animate-fade-up items-center justify-center rounded-full text-white shadow-lift', flag === 'RED' ? 'bg-crit' : flag === 'AMBER' ? 'bg-warn' : 'bg-teal')}><Check className="h-10 w-10" strokeWidth={3} /></span>
            ) : (
              <BatteryArt className="w-[130px]" level={0.75} flag="BLUE" scanning cells={6} />
            )}
            <span className="mt-2 text-2xl font-bold tabular-nums text-ink">{progress}%</span>
          </div>
        </div>

        {!result ? (
          <div className="mt-6 text-center" aria-live="polite">
            <p className="text-[19px] font-bold text-ink">{STAGES[Math.min(stage, 6)].t}</p>
            <p className="mx-auto mt-1.5 max-w-[300px] text-sm leading-relaxed text-muted">{STAGES[Math.min(stage, 6)].d}</p>
            {stage >= 2 && (
              <div className="mx-auto mt-4 flex h-10 max-w-[300px] items-end justify-center gap-[3px]">
                {Array.from({ length: profile.spec.series }).map((_, i) => (
                  <span key={i} className={cx('w-full rounded-sm transition-all duration-300', i < cellsShown ? (stage >= 5 && profile.spec.fault?.cell === i + 1 ? 'bg-crit' : 'bg-teal') : 'bg-line')} style={{ height: i < cellsShown ? `${60 + ((i * 37) % 40)}%` : '20%' }} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-6 animate-fade-up text-center">
            <p className="text-[21px] font-bold text-ink">Scan complete</p>
            <p className="mt-1 text-sm text-muted">{result.batteryId} · {result.reading.seriesCells} cells analysed</p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <span className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-ink ring-1 ring-line">Health {result.diagnosis.soh.value.toFixed(0)}%</span>
              <StatusPill flag={result.diagnosis.safety.flag} />
            </div>
          </div>
        )}

        <ol className="mt-7 space-y-1 pb-4">
          {STAGES.map((s, i) => {
            const done = i < stage || !!result
            const active = i === stage && !result
            return (
              <li key={s.t} className={cx('flex items-center gap-3 rounded-xl px-3 py-2 transition', active && 'bg-white shadow-card')}>
                <span className={cx('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold', done ? 'bg-teal text-white' : active ? 'bg-primary text-white' : 'bg-line text-muted')}>
                  {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
                </span>
                <span className={cx('text-sm', done ? 'text-ink' : active ? 'font-semibold text-ink' : 'text-faint')}>{s.t}</span>
                {active && <span className="ml-auto h-4 w-4 animate-spin rounded-full border-2 border-line border-t-primary" />}
              </li>
            )
          })}
        </ol>

        <div className="mt-auto pb-safe-4 pt-2">
          {result && <Button size="lg" full onClick={() => nav(`/battery/${result.id}`, { replace: true })} className="animate-fade-up">View results</Button>}
        </div>
      </div>
    </div>
  )
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
