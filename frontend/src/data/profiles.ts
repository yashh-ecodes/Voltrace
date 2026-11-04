import type { BatteryReading, Chemistry, DemoProfileId, LoadTest, ProtectionEvent } from '../types'
import { round, seeded } from '../lib/rng'
import { CHEM } from '../ml/chemistry'

/**
 * Physical description of a pack. `buildReading` turns it into a BMS snapshot + guided
 * load test using a simple equivalent-circuit model (rest voltage, ohmic step R*I,
 * polarisation slope, relaxation). Demo profiles and fleet records both use it, so
 * every number shown in the app derives from one deterministic source.
 */
export interface PackSpec {
  batteryId: string
  category: string
  vehicleType: string
  chemistry: Chemistry
  series: number
  parallel: number
  nominalV: number
  ratedAh: number
  bmsSoh: number // % the BMS reports (often optimistic)
  cycles: number
  soc: number
  ambientC: number
  restMeanMv: number
  restSigmaMv: number
  rGrowth: number // DC resistance / chemistry reference
  rSigma: number // cell-to-cell resistance spread (fraction)
  slopeRel: number
  recovery: number
  loadA: number
  tempRiseC: number
  events: ProtectionEvent[]
  prevDaysAgo?: number
  fault?: { cell: number; restMv: number; prevRestMv: number; rMult: number; tempC: number }
  seed: number
}

export interface DemoProfile {
  id: DemoProfileId
  name: string
  tagline: string
  description: string
  expectSoh: string
  expectSafety: 'GREEN' | 'AMBER' | 'RED'
  spec: PackSpec
}

export function buildReading(
  spec: PackSpec,
  timestamp = new Date().toISOString(),
  profileId?: DemoProfileId,
  previous?: { timestamp: string; cellsMv: number[] },
): BatteryReading {
  const rnd = seeded(spec.seed)
  const ref = CHEM[spec.chemistry]
  const cRate = spec.loadA / spec.ratedAh
  const n = spec.series
  const rest: number[] = []
  const step: number[] = []
  const end: number[] = []
  const recov: number[] = []
  const temps: number[] = []
  const prev: number[] = []
  const duration = 20
  const prevDays = spec.prevDaysAgo ?? 0
  const commonPrevShift = rnd.gauss(4, 1.5) // pack SOC differed slightly at previous scan

  for (let i = 0; i < n; i++) {
    const isFault = spec.fault && spec.fault.cell === i + 1
    let v = spec.restMeanMv + rnd.gauss(0, spec.restSigmaMv)
    if (isFault) v = spec.restMeanMv + spec.fault!.restMv
    // capacity-normalised reference R (mOhm*Ah) -> group resistance (mOhm)
    let rGroup = (ref.rRef / spec.ratedAh) * spec.rGrowth * (1 + rnd.gauss(0, spec.rSigma))
    if (isFault) rGroup *= spec.fault!.rMult
    const sag = spec.loadA * rGroup
    const slope = ref.slopeRef * cRate * spec.slopeRel * (isFault ? 1.25 : 1) * (1 + rnd.gauss(0, 0.04))
    const s = v - sag
    const e = s - slope * duration
    const rc = e + spec.recovery * sag * (1 + rnd.gauss(0, 0.02))
    rest.push(round(v, 0))
    step.push(round(s, 0))
    end.push(round(e, 0))
    recov.push(round(rc, 0))
    const t = spec.ambientC + spec.tempRiseC + rnd.gauss(0, 0.35) + (isFault ? spec.fault!.tempC : 0)
    temps.push(round(t, 1))
    const prevV = isFault ? spec.restMeanMv + spec.fault!.prevRestMv : v + rnd.gauss(0, 1.2)
    prev.push(round(prevV + commonPrevShift, 0))
  }
  // neighbours of a hot cell warm slightly (thermal coupling)
  if (spec.fault && spec.fault.tempC > 0) {
    for (const k of [spec.fault.cell - 2, spec.fault.cell]) if (k >= 0 && k < n) temps[k] = round(temps[k] + spec.fault.tempC * 0.25, 1)
  }

  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)
  const packRest = sum(rest) / 1000
  const samples: LoadTest['samples'] = []
  for (let t = 0; t <= 30; t += 1) {
    let cells: number[]
    let a = 0
    if (t < 2) cells = rest
    else if (t <= 2 + duration) {
      const k = (t - 2) / duration
      cells = step.map((s, i) => s + (end[i] - s) * k)
      a = -spec.loadA
    } else {
      const k = Math.min(1, (t - 2 - duration) / 6)
      cells = end.map((e, i) => e + (recov[i] - e) * (1 - Math.exp(-4 * k)))
    }
    samples.push({ t, packV: round(sum(cells) / 1000, 2), packA: round(a + (a ? rnd.gauss(0, 0.15) : 0), 1), minCellMv: Math.min(...cells), maxCellMv: Math.max(...cells) })
  }

  const sensors = [0, Math.floor(n / 3), Math.floor((2 * n) / 3), n - 1].map((i) => round(spec.ambientC + spec.tempRiseC * 0.8 + (temps[i] - spec.ambientC - spec.tempRiseC) * 0.6, 1))
  const bmsFullAh = round((spec.ratedAh * spec.bmsSoh) / 100, 1)
  const prevTs = new Date(new Date(timestamp).getTime() - prevDays * 86400000).toISOString()

  return {
    batteryId: spec.batteryId,
    source: 'demo',
    sourceLabel: profileId ? `Demo profile · recorded ${spec.chemistry} pack data` : 'Recorded fleet scan',
    profileId,
    category: spec.category,
    vehicleType: spec.vehicleType,
    chemistry: spec.chemistry,
    seriesCells: n,
    parallel: spec.parallel,
    nominalV: spec.nominalV,
    ratedAh: spec.ratedAh,
    bmsFullAh,
    remainingAh: round((bmsFullAh * spec.soc) / 100, 1),
    soc: spec.soc,
    cycles: spec.cycles,
    packV: round(packRest, 2),
    packA: 0,
    sensorTempsC: sensors,
    cellsMv: rest,
    cellTempsC: temps,
    protectionEvents: spec.events,
    loadTest: {
      durationS: duration,
      currentA: spec.loadA,
      restMv: rest,
      stepMv: step,
      endMv: end,
      recoveredMv: recov,
      avgTempC: round(temps.reduce((a, b) => a + b, 0) / n, 1),
      samples,
    },
    previous: previous ?? (prevDays ? { timestamp: prevTs, cellsMv: prev } : undefined),
    timestamp,
  }
}

export const DEMO_PROFILES: DemoProfile[] = [
  {
    id: 'healthy',
    name: 'Healthy Battery',
    tagline: 'E-rickshaw · LFP 51.2 V 105 Ah',
    description: 'A two-year-old e-rickshaw pack with well-balanced cells and low resistance.',
    expectSoh: '~90%',
    expectSafety: 'GREEN',
    spec: {
      batteryId: 'VTB-ER-1042', category: 'E-rickshaw traction pack', vehicleType: 'E-rickshaw',
      chemistry: 'LFP', series: 16, parallel: 1, nominalV: 51.2, ratedAh: 105, bmsSoh: 98.6, cycles: 182, soc: 72,
      ambientC: 29, restMeanMv: 3302, restSigmaMv: 3.5, rGrowth: 1.04, rSigma: 0.04, slopeRel: 1.0, recovery: 1.04,
      loadA: 32, tempRiseC: 1.4, events: [], prevDaysAgo: 9, seed: 1042,
    },
  },
  {
    id: 'aged',
    name: 'Aged Battery',
    tagline: 'Two-wheeler · NMC 51.8 V 30 Ah',
    description: 'A heavily used scooter pack. Capacity has faded and resistance has grown, but cells remain consistent.',
    expectSoh: '~67%',
    expectSafety: 'GREEN',
    spec: {
      batteryId: 'VTB-2W-2207', category: 'Two-wheeler traction pack', vehicleType: 'E-scooter',
      chemistry: 'NMC', series: 14, parallel: 1, nominalV: 51.8, ratedAh: 30, bmsSoh: 86.2, cycles: 1140, soc: 64,
      ambientC: 31, restMeanMv: 3792, restSigmaMv: 7.5, rGrowth: 1.52, rSigma: 0.06, slopeRel: 1.3, recovery: 1.18,
      loadA: 24, tempRiseC: 2.2, events: [{ code: 'COT', label: 'Charge over-temperature', count: 2 }, { code: 'CUV', label: 'Cell under-voltage', count: 1 }],
      prevDaysAgo: 21, seed: 2207,
    },
  },
  {
    id: 'faulty',
    name: 'Faulty Battery',
    tagline: 'E-rickshaw · LFP 51.2 V 100 Ah',
    description: 'One cell is drifting away from its siblings — the early signature of an internal short.',
    expectSoh: '~83%',
    expectSafety: 'RED',
    spec: {
      batteryId: 'VTB-ER-0871', category: 'E-rickshaw traction pack', vehicleType: 'E-rickshaw',
      chemistry: 'LFP', series: 16, parallel: 1, nominalV: 51.2, ratedAh: 100, bmsSoh: 91.4, cycles: 620, soc: 68,
      ambientC: 30, restMeanMv: 3305, restSigmaMv: 4, rGrowth: 1.22, rSigma: 0.05, slopeRel: 1.12, recovery: 1.1,
      loadA: 30, tempRiseC: 1.8,
      events: [{ code: 'CUV', label: 'Cell under-voltage (cell 11)', count: 3 }, { code: 'DOC', label: 'Discharge over-current', count: 1 }],
      prevDaysAgo: 3, fault: { cell: 11, restMv: -68, prevRestMv: -36, rMult: 1.42, tempC: 5.4 }, seed: 871,
    },
  },
]

export const profileById = (id: DemoProfileId) => DEMO_PROFILES.find((p) => p.id === id)!
