import { BookOpenCheck, Brain, MapPin, ScanLine, Search, TrendingUp } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Card, Divided, Empty, KV, Page, Section, StatusPill, TopBar, cx } from '../components/ui'
import { SohRing } from '../components/visuals'
import { SohTrendChart } from '../components/charts'
import { batteryScans, useApp } from '../store/app'
import { DEMO_PROFILES } from '../data/profiles'
import { FLAG_META, fmtDate, fmtShort, USAGE_META } from '../lib/format'

export default function FleetBattery() {
  const { batteryId } = useParams()
  const nav = useNavigate()
  const st = useApp()
  const b = st.fleet.find((x) => x.batteryId === batteryId)
  const scans = b ? batteryScans(st, b.batteryId) : []
  const last = scans[scans.length - 1]
  if (!b || !last)
    return (
      <>
        <TopBar title="Battery" back />
        <Page><Empty icon={<Search />} title="Battery not found" text="It is not part of this fleet." /></Page>
      </>
    )
  const d = last.diagnosis
  const profile = DEMO_PROFILES.find((p) => p.spec.batteryId === b.batteryId)
  const rev = [...scans].reverse()
  const rank = (f: string) => (f === 'RED' ? 2 : f === 'AMBER' ? 1 : 0)

  return (
    <>
      <TopBar title={b.batteryId} subtitle={`${b.vehicleType} · ${b.vehicleReg}`} back />
      <Page>
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <SohRing value={d.soh.value} size={72} stroke={8} />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-muted">Latest State of Health</p>
              <p className="text-[22px] font-bold text-ink">{d.soh.value.toFixed(0)}% <span className="text-sm font-normal text-muted">{d.soh.low.toFixed(0)}–{d.soh.high.toFixed(0)}%</span></p>
              <div className="mt-1 flex flex-wrap gap-1.5"><StatusPill flag={d.safety.flag} size="sm" label={`${FLAG_META[d.safety.flag].short}${d.safety.suspectCell ? ` · cell ${d.safety.suspectCell}` : ''}`} /></div>
            </div>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-[13px] text-muted"><MapPin className="h-4 w-4" />{b.depot} depot · {USAGE_META[d.usage].label}</p>
        </Card>

        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <Button variant="primary" onClick={() => nav(`/battery/${last.id}/diagnosis`)} icon={<Brain className="h-5 w-5" />}>Diagnosis</Button>
          {profile ? (
            <Button variant="secondary" onClick={() => nav(`/scan?mode=demo&profile=${profile.id}`)} icon={<ScanLine className="h-5 w-5 text-primary" />}>Re-scan</Button>
          ) : (
            <Button variant="secondary" onClick={() => nav(`/battery/${last.id}/advice`)} icon={<BookOpenCheck className="h-5 w-5 text-primary" />}>Passport</Button>
          )}
        </div>

        {scans.length > 1 && (
          <Section title="Health trend">
            <Card className="p-3 pt-4">
              <SohTrendChart points={scans.map((s) => ({ label: fmtShort(s.createdAt), soh: s.diagnosis.soh.value, band: [s.diagnosis.soh.low, s.diagnosis.soh.high] }))} />
            </Card>
          </Section>
        )}

        <Section title="Scan history">
          <Card className="overflow-hidden p-1">
            <ol className="relative">
              {rev.map((s, i) => {
                const prev = rev[i + 1]
                const rose = prev && rank(s.diagnosis.safety.flag) > rank(prev.diagnosis.safety.flag)
                const m = FLAG_META[s.diagnosis.safety.flag]
                return (
                  <li key={s.id}>
                    <button onClick={() => nav(`/battery/${s.id}`)} className="tap flex w-full gap-3 rounded-xl px-3 py-3 text-left active:bg-subtle">
                      <span className="flex flex-col items-center">
                        <span className={cx('mt-1 h-3 w-3 rounded-full ring-4', m.dot, s.diagnosis.safety.flag === 'GREEN' ? 'ring-ok-soft' : s.diagnosis.safety.flag === 'AMBER' ? 'ring-warn-soft' : 'ring-crit-soft')} />
                        {i < rev.length - 1 && <span className="mt-1 w-px flex-1 bg-line" />}
                      </span>
                      <span className="min-w-0 flex-1 pb-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-ink">{fmtDate(s.createdAt)}</span>
                          <span className="text-sm font-bold tabular-nums text-ink">{s.diagnosis.soh.value.toFixed(0)}%</span>
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5">
                          <StatusPill flag={s.diagnosis.safety.flag} size="sm" label={m.short} />
                          {rose && <span className="inline-flex items-center gap-1 text-xs font-semibold text-crit-ink"><TrendingUp className="h-3.5 w-3.5" />Risk rose</span>}
                          {s.id.startsWith('scan-u-') && <span className="text-xs text-muted">Your scan</span>}
                        </span>
                        {s.diagnosis.safety.findings[0] && <span className="mt-1 block truncate text-xs text-muted">{s.diagnosis.safety.findings[0].title}</span>}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </Card>
        </Section>

        <Section title="Battery details">
          <Divided>
            <KV label="Category" value={last.reading.category} />
            <KV label="Chemistry" value={`${last.reading.chemistry} · ${last.reading.seriesCells}S${last.reading.parallel}P`} />
            <KV label="Rated capacity" value={`${last.reading.ratedAh} Ah`} info="rated" />
            <KV label="Cycle count" value={last.reading.cycles} info="cycles" />
            <KV label="Vehicle" value={`${b.vehicleType} · ${b.vehicleReg}`} />
            <KV label="Scans recorded" value={scans.length} />
          </Divided>
        </Section>
      </Page>
    </>
  )
}
