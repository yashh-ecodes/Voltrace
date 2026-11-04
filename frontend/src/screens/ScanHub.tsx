import { Bluetooth, BluetoothOff, CheckCircle2, Cpu, FlaskConical, Info, Loader2, Power, Radio } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Badge, Button, Card, Page, Segmented, StatusPill, TopBar, cx } from '../components/ui'
import { BatteryArt } from '../components/visuals'
import { DEMO_PROFILES } from '../data/profiles'
import { bleSupport, type BleSupport } from '../ble/transport'
import { useApp } from '../store/app'
import type { DemoProfileId } from '../types'

export default function ScanHub() {
  const [params] = useSearchParams()
  const [mode, setMode] = useState<'demo' | 'live'>(params.get('mode') === 'live' ? 'live' : 'demo')
  const [sel, setSel] = useState<DemoProfileId | null>((params.get('profile') as DemoProfileId) || null)
  const nav = useNavigate()
  const markTour = useApp((s) => s.markTour)
  useEffect(() => { markTour('scan') }, [markTour])

  const choose = (id: DemoProfileId) => {
    setSel(id)
    if (id === 'faulty') markTour('faulty')
  }

  return (
    <>
      <TopBar title="Scan battery" back />
      <Page className="!pb-[260px]">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'demo', label: <><FlaskConical className="h-4 w-4" />Demo mode</> },
            { value: 'live', label: <><Bluetooth className="h-4 w-4" />Live Bluetooth</> },
          ]}
        />
        {mode === 'demo' ? (
          <div className="animate-fade-up">
            <p className="mt-5 text-[15px] leading-relaxed text-muted">No battery nearby? Pick a recorded battery profile. Voltrace runs its real AI models on the data, exactly as for a live scan.</p>
            <div className="mt-4 space-y-3" role="radiogroup" aria-label="Demo battery profile">
              {DEMO_PROFILES.map((p) => {
                const active = sel === p.id
                return (
                  <button
                    key={p.id}
                    role="radio"
                    aria-checked={active}
                    onClick={() => choose(p.id)}
                    className={cx('tap flex w-full gap-3.5 rounded-2xl border bg-card p-3.5 text-left shadow-card transition active:scale-[0.99]', active ? 'border-primary ring-2 ring-primary/20' : 'border-line/80')}
                  >
                    <div className={cx('flex w-[88px] shrink-0 items-center justify-center rounded-xl', p.expectSafety === 'RED' ? 'bg-crit-soft' : p.id === 'aged' ? 'bg-warn-soft' : 'bg-ok-soft')}>
                      <BatteryArt className="w-[80px]" level={p.id === 'healthy' ? 0.9 : p.id === 'aged' ? 0.6 : 0.78} flag={p.id === 'healthy' ? 'GREEN' : p.id === 'aged' ? 'AMBER' : 'RED'} cells={5} highlight={p.id === 'faulty' ? 3 : undefined} />
                    </div>
                    <div className="min-w-0 flex-1 py-0.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[16px] font-semibold text-ink">{p.name}</span>
                        <span className={cx('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2', active ? 'border-primary bg-primary' : 'border-line')}>
                          {active && <span className="h-2 w-2 rounded-full bg-white" />}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[12.5px] font-medium text-muted">{p.tagline}</p>
                      <p className="mt-1.5 text-[13px] leading-snug text-ink/80">{p.description}</p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        <Badge tone="blue">Health {p.expectSoh}</Badge>
                        <StatusPill flag={p.expectSafety} size="sm" label={p.expectSafety === 'GREEN' ? 'Green' : p.expectSafety === 'AMBER' ? 'Amber' : 'Red · cell fault'} />
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
            <div className="mt-4 flex gap-2.5 rounded-xl bg-subtle p-3 text-[12.5px] leading-relaxed text-muted">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              Demo profiles are reproducible simulations of recorded pack behaviour. Results are clearly labelled as demonstration data and must not be applied to a real battery.
            </div>
          </div>
        ) : (
          <LivePanel />
        )}
      </Page>
      {mode === 'demo' && (
        <div className="fixed inset-x-0 z-30 mx-auto max-w-[480px] px-4" style={{ bottom: 'calc(var(--tabbar-h) + var(--sab) + 12px)' }}>
          <Button
            size="lg"
            full
            disabled={!sel}
            onClick={() => { markTour('start'); nav(`/scan/run/${sel}`) }}
            className="shadow-lift"
          >
            {sel ? `Start demo scan · ${DEMO_PROFILES.find((p) => p.id === sel)!.name}` : 'Select a battery profile'}
          </Button>
        </div>
      )}
    </>
  )
}

function LivePanel() {
  const nav = useNavigate()
  const [support, setSupport] = useState<BleSupport | null>(null)
  useEffect(() => { bleSupport().then(setSupport) }, [])
  return (
    <div className="animate-fade-up">
      <Card className="mt-5 overflow-hidden">
        <div className="flex items-center gap-3 p-4">
          <span className={cx('flex h-11 w-11 items-center justify-center rounded-xl', !support ? 'bg-subtle text-muted' : support.ok ? 'bg-ok-soft text-ok-ink' : 'bg-warn-soft text-warn-ink')}>
            {!support ? <Loader2 className="h-5 w-5 animate-spin" /> : support.ok ? <Bluetooth className="h-5 w-5" /> : <BluetoothOff className="h-5 w-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-ink">{!support ? 'Checking Bluetooth…' : support.ok ? 'Bluetooth ready' : 'Bluetooth unavailable here'}</p>
            <p className="mt-0.5 text-[13px] leading-snug text-muted">
              {!support ? 'Looking for Bluetooth Low Energy support' : support.ok ? (support.kind === 'native' ? 'Native Android Bluetooth (Capacitor)' : 'Web Bluetooth supported in this browser') : support.reason}
            </p>
          </div>
        </div>
        <div className="border-t border-line bg-subtle/60 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Supported BMS protocols</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone="blue"><Cpu className="h-3 w-3" />JBD / Xiaoxiang</Badge>
            <Badge tone="blue"><Cpu className="h-3 w-3" />Daly smart BMS</Badge>
            <Badge>More coming</Badge>
          </div>
        </div>
      </Card>

      <h3 className="mt-6 text-[15px] font-semibold text-ink">Before you connect</h3>
      <div className="mt-3 space-y-2">
        {[
          { i: Power, t: 'Wake the battery', d: 'Switch the vehicle on so the BMS is powered.' },
          { i: Radio, t: 'Stay within 2 metres', d: 'Keep your phone close to the battery pack.' },
          { i: CheckCircle2, t: 'Close other BMS apps', d: 'A BMS accepts only one Bluetooth connection at a time.' },
        ].map((s, k) => (
          <div key={k} className="flex items-start gap-3 rounded-xl bg-card p-3 ring-1 ring-line/80">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-600"><s.i className="h-[18px] w-[18px]" /></span>
            <div>
              <p className="text-sm font-semibold text-ink">{s.t}</p>
              <p className="text-[13px] text-muted">{s.d}</p>
            </div>
          </div>
        ))}
      </div>
      <Button size="lg" full className="mt-5" disabled={!support} onClick={() => nav('/scan/live')} icon={<Bluetooth className="h-5 w-5" />}>
        {support && !support.ok ? 'Open Bluetooth scanner anyway' : 'Find nearby BMS'}
      </Button>
      {support && !support.ok && (
        <Button variant="ghost" full className="mt-2" onClick={() => nav('/scan?mode=demo')}>Use Demo mode instead</Button>
      )}
      <p className="mt-4 text-center text-xs leading-relaxed text-muted">
        Voltrace only reads data. It never changes BMS settings or switches the battery on or off.
      </p>
    </div>
  )
}
