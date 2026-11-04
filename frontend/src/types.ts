export type Chemistry = 'LFP' | 'NMC'
export type SafetyFlag = 'GREEN' | 'AMBER' | 'RED'
export type CellState = 'normal' | 'warning' | 'critical'
export type DemoProfileId = 'healthy' | 'aged' | 'faulty'
export type UsageCategory = 'CONTINUE' | 'INSPECT' | 'SECOND_LIFE' | 'RECYCLE'

export interface ProtectionEvent {
  code: string
  label: string
  count: number
}

/** Guided 20-second load test captured from the BMS. Per-cell arrays are in mV. */
export interface LoadTest {
  durationS: number
  currentA: number
  restMv: number[] // before load
  stepMv: number[] // immediately after load applied
  endMv: number[] // end of load window
  recoveredMv: number[] // 10 s after load removed
  avgTempC: number
  samples: { t: number; packV: number; packA: number; minCellMv: number; maxCellMv: number }[]
}

/** A single BMS snapshot plus optional guided load test. Same shape for demo + live BLE. */
export interface BatteryReading {
  batteryId: string
  source: 'demo' | 'ble'
  sourceLabel: string
  profileId?: DemoProfileId
  protocol?: 'JBD' | 'Daly'
  deviceName?: string
  category: string
  vehicleType: string
  chemistry: Chemistry
  seriesCells: number
  parallel: number
  nominalV: number
  ratedAh: number
  bmsFullAh: number // capacity the BMS believes the pack holds when full
  remainingAh: number
  soc: number
  cycles: number
  packV: number
  packA: number
  sensorTempsC: number[]
  cellsMv: number[]
  cellTempsC?: number[]
  protectionEvents: ProtectionEvent[]
  loadTest?: LoadTest
  previous?: { timestamp: string; cellsMv: number[] }
  timestamp: string
}

export interface SohFeatures {
  cycle_frac: number
  r_growth: number | null
  recovery_ratio: number | null
  slope_rel: number | null
  avg_temp_c: number
  bms_soh: number
}

export interface CellAnalysis {
  index: number // 1-based
  mv: number
  tempC?: number
  devMv: number
  sagDevPct: number | null
  tempDevC: number | null
  driftMvDay: number | null
  score: number
  ruleLevel: 0 | 1 | 2
  ifLevel: 0 | 1 | 2
  rules: string[]
  state: CellState
}

export interface Finding {
  key: string
  level: 1 | 2
  title: string
  detail: string
}

export interface Diagnosis {
  engine: 'on-device' | 'cloud'
  soh: { value: number; low: number; high: number; model: string; bmsReported: number }
  ageing: { label: string; level: 0 | 1 | 2; remainingAh: number; cycleFrac: number }
  features: SohFeatures
  safety: {
    flag: SafetyFlag
    suspectCell: number | null
    spreadMv: number
    medianMv: number
    cells: CellAnalysis[]
    findings: Finding[]
    headline: string
    explanation: string
    nextAction: string
    model: string
  }
  usage: UsageCategory
}

export interface ScanRecord {
  id: string
  batteryId: string
  createdAt: string
  reading: BatteryReading
  diagnosis: Diagnosis
  passportId?: string
}

/** The exact object that is canonicalised, hashed and signed. Keep it compact: it rides in the QR. */
export interface PassportPayload {
  v: 1
  pid: string
  bid: string
  iss: string
  kid: string
  iat: string
  demo: boolean
  src: string
  bat: { cat: string; chem: Chemistry; cfg: string; vn: number; ah: number; cyc: number; veh: string }
  soh: { v: number; lo: number; hi: number; m: string }
  sos: { f: SafetyFlag; c: number | null; m: string; n: string }
  cells: { n: number; min: number; max: number; med: number; spr: number }
  use: UsageCategory
  meth: string
}

export interface SignedPassport {
  payload: PassportPayload
  hash: string
  sig: string
  scanId?: string
  signer: 'server' | 'demo-offline'
}

export type VerifyStatus = 'VERIFIED' | 'INVALID' | 'UNAVAILABLE'

export interface VerifyResult {
  status: VerifyStatus
  reason: string
  payload?: PassportPayload
  computedHash?: string
  claimedHash?: string
  issuer?: string
  demoKey?: boolean
}
