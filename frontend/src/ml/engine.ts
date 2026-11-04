import type { BatteryReading, CellAnalysis, Diagnosis, Finding, SafetyFlag, SohFeatures, UsageCategory } from '../types'
import { clamp, median, round } from '../lib/rng'
import { CHEM } from './chemistry'
import { iforestScores, predictSoh } from './models'
import { api } from '../lib/api'

/** Step 2 of the methodology: engineered SoH features from a BMS reading + guided load test. */
export function extractSohFeatures(r: BatteryReading): SohFeatures {
  const ref = CHEM[r.chemistry]
  const lt = r.loadTest
  let rGrowth: number | null = null
  let recovery: number | null = null
  let slopeRel: number | null = null
  if (lt && lt.currentA > 0) {
    const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)
    const sagMv = sum(lt.restMv) - sum(lt.stepMv)
    const rPackMohm = sagMv / lt.currentA // R = dV / dI
    const rGroupNorm = (rPackMohm / r.seriesCells) * r.ratedAh // mOhm*Ah
    rGrowth = round(rGroupNorm / ref.rRef, 3)
    const cRate = lt.currentA / r.ratedAh
    const slope = (sum(lt.stepMv) - sum(lt.endMv)) / r.seriesCells / lt.durationS / cRate
    slopeRel = round(slope / ref.slopeRef, 3)
    recovery = sagMv > 0 ? round((sum(lt.recoveredMv) - sum(lt.endMv)) / sagMv, 3) : null
  }
  const temps = r.cellTempsC?.length ? r.cellTempsC : r.sensorTempsC
  return {
    cycle_frac: round(r.cycles / ref.cycleLife, 4),
    r_growth: rGrowth,
    recovery_ratio: recovery,
    slope_rel: slopeRel,
    avg_temp_c: round(lt?.avgTempC ?? temps.reduce((a, b) => a + b, 0) / Math.max(temps.length, 1), 1),
    bms_soh: round((r.bmsFullAh / r.ratedAh) * 100, 1),
  }
}

/** Step 3: per-cell deviation-from-pack-median features (raw units). */
export function cellDeviations(r: BatteryReading) {
  const n = r.cellsMv.length
  const medV = median(r.cellsMv)
  const lt = r.loadTest
  const sags = lt ? lt.restMv.map((v, i) => v - lt.stepMv[i]) : null
  const medSag = sags ? median(sags) : 0
  const medT = r.cellTempsC ? median(r.cellTempsC) : 0
  let drift: number[] | null = null
  let days = 0
  if (r.previous && r.previous.cellsMv.length === n) {
    days = Math.max((new Date(r.timestamp).getTime() - new Date(r.previous.timestamp).getTime()) / 86400000, 0.5)
    drift = r.cellsMv.map((v, i) => (v - r.previous!.cellsMv[i]) / days)
  }
  const medDrift = drift ? median(drift) : 0
  return r.cellsMv.map((v, i) => ({
    rest: v - medV,
    sag: sags && medSag > 0 ? ((sags[i] - medSag) / medSag) * 100 : null,
    temp: r.cellTempsC ? r.cellTempsC[i] - medT : null,
    drift: drift ? drift[i] - medDrift : null,
    days,
  }))
}

const RULES = {
  rest: [30, 60],
  sag: [30, 60],
  temp: [4, 7],
  drift: [8, 20],
  spread: [50, 100],
}

function ageingFor(soh: number) {
  if (soh >= 90) return { label: 'Minimal ageing', level: 0 as const }
  if (soh >= 80) return { label: 'Moderate ageing', level: 0 as const }
  if (soh >= 70) return { label: 'Advanced ageing', level: 1 as const }
  return { label: 'End of vehicle life', level: 2 as const }
}

export function usageFor(flag: SafetyFlag, soh: number): UsageCategory {
  if (flag === 'RED' || soh < 60) return 'RECYCLE'
  if (flag === 'AMBER') return 'INSPECT'
  if (soh < 80) return 'SECOND_LIFE'
  return 'CONTINUE'
}

export const USAGE_LABEL: Record<UsageCategory, string> = {
  CONTINUE: 'Continue in vehicle',
  INSPECT: 'Professional inspection',
  SECOND_LIFE: 'Second-life evaluation',
  RECYCLE: 'Remove from service',
}

export async function diagnose(r: BatteryReading, opts: { cloud?: boolean } = {}): Promise<Diagnosis> {
  const features = extractSohFeatures(r)
  const devs = cellDeviations(r)
  const matrix = devs.map((d) => [d.rest, d.sag ?? 0, d.temp ?? 0, d.drift ?? 0])

  let engine: Diagnosis['engine'] = 'on-device'
  let soh: { p05: number; p50: number; p95: number; model: string }
  let scores: number[]
  let thrA: number
  let thrR: number
  let ifModel: string
  const cloud = opts.cloud ? await api.diagnose(features, matrix) : null
  const local = await iforestScores(matrix)
  thrA = local.thresholdAmber
  thrR = local.thresholdRed
  if (cloud) {
    engine = 'cloud'
    soh = cloud.soh
    scores = cloud.safety.cells.map((c: { score: number }) => c.score)
    ifModel = cloud.safety.model
  } else {
    soh = await predictSoh(features as unknown as Record<string, number | null>)
    scores = local.scores
    ifModel = local.model
  }

  const medV = median(r.cellsMv)
  const cells: CellAnalysis[] = devs.map((d, i) => {
    const rules: string[] = []
    let lvl: 0 | 1 | 2 = 0
    const bump = (v: number, [a, b]: number[], key: string) => {
      if (v > b) { lvl = 2; rules.push(key) } else if (v > a) { lvl = Math.max(lvl, 1) as 0 | 1 | 2; rules.push(key) }
    }
    bump(Math.abs(d.rest), RULES.rest, 'rest')
    if (d.sag !== null) bump(d.sag, RULES.sag, 'sag')
    if (d.temp !== null) bump(d.temp, RULES.temp, 'temp')
    if (d.drift !== null) bump(-d.drift, RULES.drift, 'drift')
    const s = scores[i]
    const ifLevel: 0 | 1 | 2 = s >= thrR ? 2 : s >= thrA ? 1 : 0
    const level = Math.max(lvl, ifLevel)
    return {
      index: i + 1,
      mv: r.cellsMv[i],
      tempC: r.cellTempsC?.[i],
      devMv: round(d.rest, 0),
      sagDevPct: d.sag === null ? null : round(d.sag, 0),
      tempDevC: d.temp === null ? null : round(d.temp, 1),
      driftMvDay: d.drift === null ? null : round(d.drift, 1),
      score: s,
      ruleLevel: lvl,
      ifLevel,
      rules,
      state: level === 2 ? 'critical' : level === 1 ? 'warning' : 'normal',
    }
  })

  const spread = Math.max(...r.cellsMv) - Math.min(...r.cellsMv)
  const packLevel = spread > RULES.spread[1] ? 2 : spread > RULES.spread[0] ? 1 : 0
  const level = Math.max(packLevel, ...cells.map((c) => (c.state === 'critical' ? 2 : c.state === 'warning' ? 1 : 0)))
  const flag: SafetyFlag = (['GREEN', 'AMBER', 'RED'] as const)[level]
  const ranked = [...cells].sort((a, b) => (b.state === a.state ? b.score - a.score : rank(b.state) - rank(a.state)))
  const suspect = level > 0 && ranked[0].state !== 'normal' ? ranked[0] : level > 0 ? cells.reduce((a, b) => (Math.abs(b.devMv) > Math.abs(a.devMv) ? b : a)) : null

  const findings: Finding[] = []
  if (suspect) {
    const c = suspect
    const L = (v: number, [a, b]: number[]) => (v > b ? 2 : v > a ? 1 : 0)
    const add = (key: string, lv: number, title: string, detail: string) => lv && findings.push({ key, level: lv as 1 | 2, title, detail })
    add('rest', L(Math.abs(c.devMv), RULES.rest), `Cell ${c.index} resting voltage ${c.devMv < 0 ? 'low' : 'high'}`, `Rests ${Math.abs(c.devMv)} mV ${c.devMv < 0 ? 'below' : 'above'} the pack median of ${round(medV / 1000, 3)} V. Healthy cells in a balanced pack sit within about 30 mV of each other.`)
    if (c.sagDevPct !== null) add('sag', L(c.sagDevPct, RULES.sag), `Cell ${c.index} sags more under load`, `Its voltage dropped ${c.sagDevPct}% more than its siblings during the load test, which points to higher internal resistance.`)
    if (c.tempDevC !== null) add('temp', L(c.tempDevC, RULES.temp), `Cell ${c.index} is running warm`, `It is ${c.tempDevC} °C warmer than the pack median. Localised heat is an early sign of internal resistance or a micro-short.`)
    if (c.driftMvDay !== null) add('drift', L(-c.driftMvDay, RULES.drift), `Cell ${c.index} is self-discharging`, `Since the previous scan it lost ${Math.abs(c.driftMvDay)} mV/day more than the other cells. Abnormal self-discharge is the classic signature of an internal short.`)
    if (c.ifLevel) findings.push({ key: 'iforest', level: c.ifLevel as 1 | 2, title: 'Statistical outlier among sibling cells', detail: `The Isolation Forest anomaly score for cell ${c.index} is ${c.score.toFixed(2)} (alert threshold ${thrA.toFixed(2)}). Its combined behaviour is unlike any other cell in this pack.` })
  }
  if (packLevel) findings.push({ key: 'spread', level: packLevel as 1 | 2, title: 'Wide cell voltage spread', detail: `The difference between the highest and lowest cell is ${spread} mV. Safety literature treats a resting spread above 50 mV as abnormal.` })
  findings.sort((a, b) => b.level - a.level)

  const sohV = soh.p50
  const usage = usageFor(flag, sohV)
  const head = {
    GREEN: 'No significant abnormality identified in available data',
    AMBER: 'Abnormal behaviour detected — inspection recommended',
    RED: 'Significant abnormality detected — prompt professional inspection required',
  }[flag]
  const explanation = {
    GREEN: `All ${r.cellsMv.length} cells behave consistently: resting voltages lie within ${spread} mV and no cell stands out in voltage sag, temperature or self-discharge. This screening cannot detect every fault, so normal maintenance still applies.`,
    AMBER: `${suspect ? `Cell ${suspect.index}` : 'The pack'} behaves differently from its siblings. This is not necessarily dangerous, but it should be examined by a technician before the battery is relied upon.`,
    RED: `Cell ${suspect?.index ?? '?'} shows several warning signs at once. Internal shorts usually begin in a single cell that drifts away from its siblings, exactly the pattern found here. Lithium battery fires often start this way, although this screening cannot predict whether or when a failure will happen.`,
  }[flag]
  const nextAction = {
    GREEN: 'Keep using the battery normally and re-scan every 3 months or after any impact, water exposure or overheating.',
    AMBER: 'Book an inspection with a qualified battery technician. Avoid fast charging and do not leave the battery charging unattended until it has been checked.',
    RED: 'Stop using and charging this battery. Park the vehicle outdoors away from buildings and contact a qualified battery technician or authorised service centre promptly.',
  }[flag]

  const ag = ageingFor(sohV)
  return {
    engine,
    soh: { value: sohV, low: soh.p05, high: soh.p95, model: soh.model, bmsReported: features.bms_soh },
    ageing: { ...ag, remainingAh: round((r.ratedAh * sohV) / 100, 1), cycleFrac: features.cycle_frac },
    features,
    safety: { flag, suspectCell: suspect?.index ?? null, spreadMv: spread, medianMv: medV, cells, findings, headline: head, explanation, nextAction, model: `${ifModel} + rules` },
    usage,
  }
}

const rank = (s: CellAnalysis['state']) => (s === 'critical' ? 2 : s === 'warning' ? 1 : 0)
export const sohBand = (v: number): 0 | 1 | 2 => (v >= 80 ? 0 : v >= 65 ? 1 : 2)
export const pct = (v: number) => `${clamp(Math.round(v), 0, 100)}%`
