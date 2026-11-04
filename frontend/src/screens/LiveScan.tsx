import { AlertTriangle, Bluetooth, BluetoothConnected, Check, Gauge, Loader2, Plug, Thermometer, Unplug, X, Zap } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Card, Segmented, cx } from '../components/ui'
import { bleSupport, connectBms, readSnapshot, type BleLink, type BleSupport } from '../ble/transport'
import type { BmsSnapshot, ProtocolId } from '../ble/protocols'
import { diagnose } from '../ml/engine'
import { latestScan, useApp } from '../store/app'
import type { BatteryReading, Chemistry, LoadTest, ScanRecord } from '../types'
import { median, round } from '../lib/rng'

type Phase = 'idle' | 'connecting' | 'connected' | 'details' | 'load' | 'analysing' | 'error'

export default function LiveScan() {
  const nav = useNavigate()
  const [support, setSupport] = useState<BleSupport | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [pref, setPref] = useState<ProtocolId | 'auto'>('auto')
  const [link, setLink] = useState<BleLink | null>(null)
  const [snap, setSnap] = useState<BmsSnapshot | null>(null)
  const poll = useRef<number | null>(null)
  const linkRef = useRef<BleLink | null>(null)

  useEffect(() => { bleSupport().then(setSupport) }, [])
  useEffect(() => () => { stopPoll(); linkRef.current?.disconnect() }, [])

  const stopPoll = () => { if (poll.current) window.clearInterval(poll.current); poll.current = null }
  const startPoll = (l: BleLink) => {
    stopPoll()
    poll.current = window.setInterval(async () => {
      try { setSnap(await readSnapshot(l, 2500)) } catch { /* keep last */ }
    }, 1500)
  }

  const connect = async () => {
    setError('')
    setPhase('connecting')
    try {
      const l = await connectBms(pref, setStatus)
      linkRef.current = l
      setLink(l)
      l.onDisconnect(() => { stopPoll(); setLink(null); setPhase('error'); setError('The BMS disconnected. Move closer and try again.') })
      setStatus('Reading first snapshot…')
      const s = await readSnapshot(l)
      setSnap(s)
      setPhase('connected')
      startPoll(l)
    } catch (e) {
      const msg = (e as Error).message || String(e)
      setPhase(msg.includes('cancelled') || (e as Error).name === 'NotFoundError' ? 'idle' : 'error')
      setError((e as Error).name === 'NotFoundError' ? '' : msg)
    }
  }

  const disconnect = async () => {
    stopPoll()
    await linkRef.current?.disconnect()
    linkRef.current = null
    setLink(null)
    setSnap(null)
    setPhase('idle')
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-bg">
      <div className="mx-auto flex min-h-full max-w-[480px] flex-col px-4 pt-safe">
        <div className="flex h-14 items-center justify-between">
          <button aria-label="Close" onClick={async () => { await disconnect(); nav('/scan?mode=live', { replace: true }) }} className="tap -ml-2 flex h-11 w-11 items-center justify-center rounded-full active:bg-subtle"><X className="h-6 w-6" /></button>
          <span className="text-[16px] font-semibold">Live BMS scan</span>
          <span className="w-11" />
        </div>

        {/* connection card */}
        <Card className="mt-2 p-4">
          <div className="flex items-center gap-3">
            <span className={cx('relative flex h-12 w-12 items-center justify-center rounded-2xl', link ? 'bg-ok-soft text-ok-ink' : 'bg-primary-soft text-primary-600')}>
              {phase === 'connecting' && <span className="absolute inset-0 animate-pulsering rounded-2xl bg-primary/20" />}
              {link ? <BluetoothConnected className="h-6 w-6" /> : <Bluetooth className="h-6 w-6" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold">{link ? link.name : phase === 'connecting' ? 'Connecting…' : 'Not connected'}</p>
              <p className="truncate text-[13px] text-muted">{link ? `${link.protocol} protocol${snap?.firmware ? ` · ${snap.firmware}` : ''}` : phase === 'connecting' ? status : 'Read-only connection to a smart BMS'}</p>
            </div>
            {link && <Badge tone="green">Connected</Badge>}
          </div>
          {support && !support.ok && (
            <div className="mt-3 flex gap-2 rounded-xl bg-warn-soft p-3 text-[13px] text-warn-ink">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{support.reason} No connection has been made.</span>
            </div>
          )}
        </Card>

        {phase === 'idle' || phase === 'error' || phase === 'connecting' ? (
          <div className="mt-5">
            <p className="mb-2 text-sm font-semibold">BMS protocol</p>
            <Segmented value={pref} onChange={setPref} options={[{ value: 'auto', label: 'Auto-detect' }, { value: 'JBD', label: 'JBD' }, { value: 'Daly', label: 'Daly' }]} />
            {error && (
              <div className="mt-4 flex gap-2 rounded-xl bg-crit-soft p-3 text-[13px] text-crit-ink">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}
              </div>
            )}
            <div className="mt-4 rounded-xl bg-subtle p-3.5 text-[13px] leading-relaxed text-muted">
              {support?.ok && support.kind === 'web'
                ? 'Your browser will show a list of nearby Bluetooth devices. Choose the one named after your BMS (often “xiaoxiang”, “JBD-…” or “DL-…”).'
                : 'In the Android app, Voltrace scans for nearby devices and shows them in a system list.'}
            </div>
            <Button size="lg" full className="mt-5" disabled={!support?.ok || phase === 'connecting'} onClick={connect} icon={phase === 'connecting' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Bluetooth className="h-5 w-5" />}>
              {phase === 'connecting' ? 'Connecting…' : 'Search for devices'}
            </Button>
            <Button variant="ghost" full className="mt-2" onClick={() => nav('/scan?mode=demo', { replace: true })}>No battery? Use Demo mode</Button>
          </div>
        ) : null}

        {snap && link && (phase === 'connected' || phase === 'details' || phase === 'load') && <LiveSnapshot snap={snap} />}

        {phase === 'connected' && snap && (
          <div className="mt-5 space-y-2 pb-safe-8">
            <Button size="lg" full onClick={() => setPhase('details')}>Continue to health check</Button>
            <Button variant="secondary" full onClick={disconnect} icon={<Unplug className="h-4 w-4" />}>Disconnect</Button>
          </div>
        )}

        {phase === 'details' && snap && link && <DetailsAndLoad link={link} first={snap} stopPoll={stopPoll} onDisconnect={disconnect} setPhase={setPhase} />}
        {phase === 'analysing' && (
          <div className="mt-10 flex flex-col items-center gap-3 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="font-semibold">Analysing cells…</p>
          </div>
        )}
      </div>
    </div>
  )
}

function LiveSnapshot({ snap }: { snap: BmsSnapshot }) {
  const med = median(snap.cellsMv)
  const spread = Math.max(...snap.cellsMv) - Math.min(...snap.cellsMv)
  return (
    <Card className="mt-4 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Live readings</p>
        <span className="flex items-center gap-1.5 text-xs font-medium text-ok-ink"><span className="h-2 w-2 animate-pulse rounded-full bg-ok" />Streaming</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          { i: Zap, l: 'Pack', v: `${snap.packV.toFixed(2)} V` },
          { i: Gauge, l: 'Current', v: `${snap.packA.toFixed(1)} A` },
          { i: Thermometer, l: 'Temp', v: snap.tempsC.length ? `${Math.max(...snap.tempsC).toFixed(0)} °C` : '—' },
        ].map((x) => (
          <div key={x.l} className="rounded-xl bg-subtle p-2.5">
            <x.i className="h-4 w-4 text-muted" />
            <p className="mt-1 text-[15px] font-bold tabular-nums">{x.v}</p>
            <p className="text-[11px] text-muted">{x.l}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs font-medium text-muted">{snap.cellsMv.length} cells · spread {spread} mV · SoC {snap.soc}% · {snap.cycles} cycles</p>
      <div className="mt-2 flex h-16 items-end gap-[3px]">
        {snap.cellsMv.map((v, i) => (
          <div key={i} className={cx('flex-1 rounded-sm', Math.abs(v - med) > 30 ? 'bg-warn' : 'bg-teal')} style={{ height: `${30 + Math.max(0, Math.min(70, (v - med + 40) * 0.9))}%` }} title={`Cell ${i + 1}: ${v} mV`} />
        ))}
      </div>
      {snap.protections.length > 0 && <p className="mt-3 text-xs font-medium text-warn-ink">Active protection: {snap.protections.join(', ')}</p>}
    </Card>
  )
}

function DetailsAndLoad({ link, first, stopPoll, onDisconnect, setPhase }: { link: BleLink; first: BmsSnapshot; stopPoll: () => void; onDisconnect: () => void; setPhase: (p: Phase) => void }) {
  const nav = useNavigate()
  const avgCell = first.cellsMv.reduce((a, b) => a + b, 0) / first.cellsMv.length
  const [id, setId] = useState('')
  const [chem, setChem] = useState<Chemistry>(avgCell > 3450 ? 'NMC' : 'LFP')
  const [rated, setRated] = useState(String(Math.round(first.ratedAh ?? first.fullAh ?? 100)))
  const [vehicle, setVehicle] = useState('E-rickshaw')
  const [stage, setStage] = useState<'form' | 'rest' | 'load' | 'recover' | 'done'>('form')
  const [t, setT] = useState(0)
  const [msg, setMsg] = useState('')
  const samples = useRef<{ t: number; s: BmsSnapshot }[]>([])

  const run = async () => {
    stopPoll()
    samples.current = []
    const ratedAh = Number(rated) || 100
    const threshold = Math.max(2, ratedAh * 0.05)
    setStage('rest')
    setMsg('Measuring resting voltages. Keep the load OFF.')
    const rest = await readSnapshot(link)
    setStage('load')
    setMsg('Switch the load ON now (e.g. lights + motor with wheels raised).')
    let stepSnap: BmsSnapshot | null = null
    let endSnap: BmsSnapshot | null = null
    let stepT = 0
    const t0 = Date.now()
    while (Date.now() - t0 < 32000) {
      const s = await readSnapshot(link, 2500).catch(() => null)
      const el = (Date.now() - t0) / 1000
      setT(Math.round(el))
      if (s) {
        samples.current.push({ t: el, s })
        if (Math.abs(s.packA) >= threshold) {
          if (!stepSnap) { stepSnap = s; stepT = el; setMsg('Load detected — hold it for 20 seconds…') }
          endSnap = s
          if (el - stepT >= 20) break
        }
      }
    }
    let recovered: BmsSnapshot | null = null
    if (stepSnap && endSnap) {
      setStage('recover')
      setMsg('Switch the load OFF and wait 10 seconds…')
      const t1 = Date.now()
      while (Date.now() - t1 < 25000) {
        const s = await readSnapshot(link, 2500).catch(() => null)
        if (s && Math.abs(s.packA) < threshold) {
          await new Promise((r) => setTimeout(r, 10000))
          recovered = await readSnapshot(link).catch(() => s)
          break
        }
      }
    }
    setStage('done')
    setPhase('analysing')

    const now = new Date().toISOString()
    const batteryId = id.trim().toUpperCase() || `VT-TMP-${Date.now().toString(36).toUpperCase().slice(-6)}`
    const prev = latestScan(useApp.getState(), batteryId)
    const loadTest: LoadTest | undefined = stepSnap && endSnap && recovered
      ? {
          durationS: 20,
          currentA: Math.abs(median(samples.current.filter((x) => Math.abs(x.s.packA) >= threshold).map((x) => x.s.packA))),
          restMv: rest.cellsMv, stepMv: stepSnap.cellsMv, endMv: endSnap.cellsMv, recoveredMv: recovered.cellsMv,
          avgTempC: round(samples.current.flatMap((x) => x.s.tempsC).reduce((a, b) => a + b, 0) / Math.max(1, samples.current.flatMap((x) => x.s.tempsC).length), 1),
          samples: samples.current.map((x) => ({ t: round(x.t, 1), packV: x.s.packV, packA: x.s.packA, minCellMv: Math.min(...x.s.cellsMv), maxCellMv: Math.max(...x.s.cellsMv) })),
        }
      : undefined
    const reading: BatteryReading = {
      batteryId, source: 'ble', sourceLabel: `Live ${link.protocol} BMS over Bluetooth`, protocol: link.protocol, deviceName: link.name,
      category: vehicle === 'E-scooter' ? 'Two-wheeler traction pack' : vehicle === 'Other' ? 'Lithium-ion pack' : `${vehicle} traction pack`,
      vehicleType: vehicle, chemistry: chem, seriesCells: rest.cellsMv.length, parallel: 1,
      nominalV: round(rest.cellsMv.length * (chem === 'LFP' ? 3.2 : 3.7), 1), ratedAh: Number(rated) || 100,
      bmsFullAh: rest.fullAh || Number(rated), remainingAh: rest.remainingAh, soc: rest.soc, cycles: rest.cycles,
      packV: rest.packV, packA: rest.packA, sensorTempsC: rest.tempsC, cellsMv: rest.cellsMv,
      protectionEvents: rest.protections.map((p) => ({ code: p.slice(0, 3).toUpperCase(), label: p, count: 1 })),
      loadTest, previous: prev ? { timestamp: prev.createdAt, cellsMv: prev.reading.cellsMv } : undefined, timestamp: now,
    }
    const diagnosis = await diagnose(reading, { cloud: useApp.getState().settings.cloudInference })
    const rec: ScanRecord = { id: `scan-u-${Date.now().toString(36)}`, batteryId, createdAt: now, reading, diagnosis }
    useApp.getState().addScan(rec)
    await onDisconnect()
    nav(`/battery/${rec.id}`, { replace: true })
  }

  if (stage !== 'form')
    return (
      <Card className="mt-4 p-5 text-center">
        <span className={cx('mx-auto flex h-14 w-14 items-center justify-center rounded-full', stage === 'load' ? 'bg-warn-soft text-warn-ink' : 'bg-primary-soft text-primary-600')}>
          {stage === 'load' ? <Plug className="h-7 w-7" /> : stage === 'done' ? <Check className="h-7 w-7" /> : <Loader2 className="h-7 w-7 animate-spin" />}
        </span>
        <p className="mt-3 text-[17px] font-semibold">{stage === 'rest' ? 'Resting measurement' : stage === 'load' ? `Guided load test · ${t}s` : stage === 'recover' ? 'Recovery measurement' : 'Done'}</p>
        <p className="mt-1 text-sm text-muted">{msg}</p>
      </Card>
    )

  return (
    <div className="mt-5 space-y-4 pb-safe-8">
      <div>
        <label className="text-sm font-semibold" htmlFor="bid">Battery ID (BPAN or label)</label>
        <input id="bid" value={id} onChange={(e) => setId(e.target.value)} placeholder="Leave blank for a temporary Voltrace ID" className="mt-1.5 h-12 w-full rounded-xl border border-line bg-card px-3.5 outline-none focus:border-primary" />
      </div>
      <div>
        <p className="text-sm font-semibold">Chemistry</p>
        <Segmented className="mt-1.5" value={chem} onChange={setChem} options={[{ value: 'LFP', label: 'LFP' }, { value: 'NMC', label: 'NMC' }]} />
        <p className="mt-1 text-xs text-muted">Suggested from average cell voltage ({(avgCell / 1000).toFixed(2)} V).</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-semibold" htmlFor="ah">Rated capacity (Ah)</label>
          <input id="ah" inputMode="decimal" value={rated} onChange={(e) => setRated(e.target.value)} className="mt-1.5 h-12 w-full rounded-xl border border-line bg-card px-3.5 outline-none focus:border-primary" />
        </div>
        <div>
          <label className="text-sm font-semibold" htmlFor="veh">Vehicle</label>
          <select id="veh" value={vehicle} onChange={(e) => setVehicle(e.target.value)} className="mt-1.5 h-12 w-full rounded-xl border border-line bg-card px-3 outline-none focus:border-primary">
            {['E-rickshaw', 'E-scooter', 'L5 cargo', 'Other'].map((v) => <option key={v}>{v}</option>)}
          </select>
        </div>
      </div>
      <div className="rounded-xl bg-primary-soft p-3.5 text-[13px] leading-relaxed text-primary-700">
        Next, Voltrace runs a 20-second guided load test: it measures resting voltages, asks you to switch a load on, then off. This is how internal resistance and voltage sag are measured.
      </div>
      <Button size="lg" full onClick={run}>Start guided load test</Button>
      <Button variant="secondary" full onClick={onDisconnect} icon={<Unplug className="h-4 w-4" />}>Disconnect</Button>
    </div>
  )
}
