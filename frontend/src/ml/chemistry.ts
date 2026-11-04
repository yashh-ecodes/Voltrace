import type { Chemistry } from '../types'

/**
 * Chemistry reference values used to normalise features (mirrors backend/ml/features.py).
 * cycleLife: cycles to ~80% SoH at rated conditions; rRef: capacity-normalised DC resistance
 * of a new cell (mOhm*Ah); slopeRef: early loaded-voltage slope (mV/s per C).
 */
export const CHEM: Record<Chemistry, { cycleLife: number; rRef: number; slopeRef: number; label: string; nominalCellV: number }> = {
  LFP: { cycleLife: 3000, rRef: 80, slopeRef: 0.35, label: 'Lithium iron phosphate', nominalCellV: 3.2 },
  NMC: { cycleLife: 1000, rRef: 120, slopeRef: 0.6, label: 'Nickel manganese cobalt', nominalCellV: 3.7 },
}
