import type { PackSpec } from './profiles'
import type { BatteryReading } from '../types'
import { DEMO_PROFILES, buildReading } from './profiles'
import type { ScanRecord } from '../types'
import { diagnose } from '../ml/engine'


export interface FleetBattery {
  batteryId: string
  vehicleType: string
  vehicleReg: string
  depot: string
  scanIds: string[] // chronological
}

export const FLEET_NAME = 'GreenWheels E-Mobility'
export const FLEET_CITY = 'New Delhi'

interface Seed {
  spec: PackSpec
  reg: string
  depot: string
  /** days before "now" at which recorded scans exist, oldest first; last entry is the latest scan */
  scansDaysAgo: number[]
  /** progressive fault: fraction (0..1) of the final fault present at each scan */
  faultRamp?: number[]
}

const er = (o: Partial<PackSpec> & Pick<PackSpec, 'batteryId' | 'seed'>): PackSpec => ({
  category: 'E-rickshaw traction pack', vehicleType: 'E-rickshaw', chemistry: 'LFP', series: 16, parallel: 1, nominalV: 51.2,
  ratedAh: 100, bmsSoh: 95, cycles: 400, soc: 70, ambientC: 30, restMeanMv: 3300, restSigmaMv: 4, rGrowth: 1.1, rSigma: 0.05,
  slopeRel: 1.05, recovery: 1.06, loadA: 30, tempRiseC: 1.6, events: [], ...o,
})

const [healthy, aged, faulty] = DEMO_PROFILES

const SEEDS: Seed[] = [
  { spec: faulty.spec, reg: 'DL 1ER 4471', depot: 'Raghubir Nagar', scansDaysAgo: [190, 95, 3], faultRamp: [0, 0.25, 0.53] },
  { spec: healthy.spec, reg: 'DL 1ER 2093', depot: 'Raghubir Nagar', scansDaysAgo: [150, 60, 9] },
  { spec: aged.spec, reg: 'DL 8SB 7731', depot: 'Janakpuri', scansDaysAgo: [240, 120, 21] },
  { spec: er({ batteryId: 'VTB-ER-1188', bmsSoh: 96.5, cycles: 310, rGrowth: 1.06, seed: 1188 }), reg: 'DL 1ER 5520', depot: 'Raghubir Nagar', scansDaysAgo: [130, 40, 6] },
  { spec: er({ batteryId: 'VTB-ER-0954', bmsSoh: 90.2, cycles: 880, rGrowth: 1.28, seed: 954 }), reg: 'DL 1ER 3307', depot: 'Tilak Nagar', scansDaysAgo: [200, 100, 12] },
  {
    spec: er({ batteryId: 'VTB-ER-0716', bmsSoh: 92.4, cycles: 705, rGrowth: 1.2, seed: 716, fault: { cell: 6, restMv: -38, prevRestMv: -30, rMult: 1.06, tempC: 0.5 }, events: [{ code: 'CUV', label: 'Cell under-voltage (cell 6)', count: 1 }] }),
    reg: 'DL 1ER 6142', depot: 'Tilak Nagar', scansDaysAgo: [170, 75, 5], faultRamp: [0, 0.6, 1],
  },
  { spec: er({ batteryId: 'VTB-L5-3310', category: 'Three-wheeler cargo pack', vehicleType: 'L5 cargo', chemistry: 'NMC', series: 20, nominalV: 74, ratedAh: 60, bmsSoh: 93.8, cycles: 420, restMeanMv: 3810, restSigmaMv: 6, rGrowth: 1.15, loadA: 40, seed: 3310 }), reg: 'DL 1LT 9021', depot: 'Janakpuri', scansDaysAgo: [110, 50, 14] },
  { spec: er({ batteryId: 'VTB-ER-1305', bmsSoh: 99.1, cycles: 64, rGrowth: 0.98, seed: 1305 }), reg: 'DL 1ER 7788', depot: 'Raghubir Nagar', scansDaysAgo: [45, 2] },
  { spec: er({ batteryId: 'VTB-2W-2450', category: 'Two-wheeler traction pack', vehicleType: 'E-scooter', chemistry: 'NMC', series: 14, nominalV: 51.8, ratedAh: 30, bmsSoh: 91.5, cycles: 520, restMeanMv: 3805, restSigmaMv: 6, rGrowth: 1.22, loadA: 22, seed: 2450 }), reg: 'DL 8SC 1206', depot: 'Janakpuri', scansDaysAgo: [180, 70, 17] },
  { spec: er({ batteryId: 'VTB-ER-0602', bmsSoh: 84.7, cycles: 1650, rGrowth: 1.45, slopeRel: 1.2, seed: 602, events: [{ code: 'DOT', label: 'Discharge over-temperature', count: 2 }] }), reg: 'DL 1ER 1150', depot: 'Tilak Nagar', scansDaysAgo: [260, 140, 30] },
]

export const DEMO_BATTERY_IDS = new Set(DEMO_PROFILES.map((p) => p.spec.batteryId))

/** Older state of a pack: fewer cycles, higher BMS capacity, lower resistance. */
function stateAt(spec: PackSpec, daysAgo: number, latestDaysAgo: number, faultFrac: number | undefined, k: number): PackSpec {
  const dd = daysAgo - latestDaysAgo
  const cyclesPerDay = spec.cycles / 900
  const backCycles = Math.round(cyclesPerDay * dd)
  const cycles = Math.max(5, spec.cycles - backCycles)
  const frac = cycles / spec.cycles
  const s: PackSpec = {
    ...spec,
    cycles,
    bmsSoh: Math.min(100, 100 - (100 - spec.bmsSoh) * Math.pow(frac, 0.8)),
    rGrowth: 1 + (spec.rGrowth - 1) * frac,
    slopeRel: 1 + (spec.slopeRel - 1) * frac,
    restMeanMv: spec.restMeanMv + ((k * 7) % 11) - 5,
    soc: Math.max(35, Math.min(90, spec.soc + ((k * 13) % 17) - 8)),
    events: dd > 0 ? spec.events.slice(0, Math.max(0, spec.events.length - 1)).map((e) => ({ ...e, count: Math.max(1, e.count - 1) })) : spec.events,
  }
  if (spec.fault && faultFrac !== undefined) {
    s.fault = faultFrac <= 0 ? undefined : {
      cell: spec.fault.cell,
      restMv: spec.fault.restMv * faultFrac,
      prevRestMv: spec.fault.prevRestMv * faultFrac,
      rMult: 1 + (spec.fault.rMult - 1) * faultFrac,
      tempC: spec.fault.tempC * faultFrac,
    }
  }
  return s
}

export interface SeedResult { fleet: FleetBattery[]; scans: Record<string, ScanRecord> }

export async function seedFleet(now = Date.now()): Promise<SeedResult> {
  const fleet: FleetBattery[] = []
  const scans: Record<string, ScanRecord> = {}
  for (const sd of SEEDS) {
    const ids: string[] = []
    let prev: { timestamp: string; cellsMv: number[] } | undefined
    const latest = sd.scansDaysAgo[sd.scansDaysAgo.length - 1]
    for (let k = 0; k < sd.scansDaysAgo.length; k++) {
      const days = sd.scansDaysAgo[k]
      const ts = new Date(now - days * 86400000 - ((k * 37) % 300) * 60000).toISOString()
      const spec = stateAt(sd.spec, days, latest, sd.faultRamp?.[k] ?? (sd.spec.fault ? 1 : undefined), k)
      const reading: BatteryReading = { ...buildReading({ ...spec, prevDaysAgo: 0 }, ts, undefined, prev), sourceLabel: 'Recorded fleet scan (simulated)' }
      const diagnosis = await diagnose(reading)
      const id = `scan-${sd.spec.batteryId}-${k}`
      scans[id] = { id, batteryId: sd.spec.batteryId, createdAt: ts, reading, diagnosis }
      ids.push(id)
      prev = { timestamp: ts, cellsMv: reading.cellsMv }
    }
    fleet.push({ batteryId: sd.spec.batteryId, vehicleType: sd.spec.vehicleType, vehicleReg: sd.reg, depot: sd.depot, scanIds: ids })
  }
  return { fleet, scans }
}
