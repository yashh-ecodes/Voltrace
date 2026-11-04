/**
 * On-device evaluation of the exported models. These are the *same* model files the
 * FastAPI service evaluates (backend/models/*.json), trained in backend/ml/.
 *   - soh_xgb.json : XGBoost multi-quantile regressor trained on NASA PCoE ageing data
 *   - iforest.json : Isolation Forest over per-cell robust z-scores
 */
type XNode = { l: number } | { f: number; t: number; m: 0 | 1; y: XNode; n: XNode }
interface XgbModel { features: string[]; quantiles: number[]; base_scores: number[]; trees: { g: number; r: XNode }[]; version: string }
interface IfTree { l: number[]; r: number[]; f: number[]; t: number[]; n: number[] }
interface IfModel { features: string[]; max_samples: number; trees: IfTree[]; floors: number[]; threshold_amber: number; threshold_red: number; version: string }

let xgb: XgbModel | null = null
let iforest: IfModel | null = null

export async function loadModels() {
  if (!xgb || !iforest) {
    const [a, b] = await Promise.all([import('./models/soh_xgb.json'), import('./models/iforest.json')])
    xgb = (a.default ?? a) as unknown as XgbModel
    iforest = (b.default ?? b) as unknown as IfModel
  }
  return { xgb: xgb!, iforest: iforest! }
}

const f32 = Math.fround

function evalTree(node: XNode, x: (number | null)[]): number {
  let n = node
  while (!('l' in n)) {
    const v = x[n.f]
    if (v === null || Number.isNaN(v)) n = n.m === 0 ? n.y : n.n
    else n = f32(v) < f32(n.t) ? n.y : n.n
  }
  return n.l
}

export async function predictSoh(features: Record<string, number | null>) {
  const { xgb: m } = await loadModels()
  const x = m.features.map((f) => (features[f] ?? null) as number | null)
  const out = m.base_scores.length === m.quantiles.length ? [...m.base_scores] : m.quantiles.map(() => m.base_scores[0])
  for (const t of m.trees) out[t.g] = f32(out[t.g] + evalTree(t.r, x))
  const [lo, mid, hi] = [...out].sort((a, b) => a - b).map((v) => Math.max(0, Math.min(100, v)))
  return { p05: Math.round(lo * 10) / 10, p50: Math.round(mid * 10) / 10, p95: Math.round(hi * 10) / 10, model: m.version }
}

const cFactor = (n: number) => (n <= 1 ? 0 : n === 2 ? 1 : 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1)) / n)
const med = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b)
  const k = s.length
  return k % 2 ? s[(k - 1) / 2] : (s[k / 2 - 1] + s[k / 2]) / 2
}

/** Isolation-forest anomaly score per cell (0..1, higher = more isolated). */
export async function iforestScores(cells: number[][]) {
  const { iforest: m } = await loadModels()
  const cols = m.features.map((_, j) => cells.map((c) => c[j]))
  const meds = cols.map(med)
  const scale = cols.map((c, j) => Math.max(med(c.map((v) => Math.abs(v - meds[j]))) * 1.4826, m.floors[j]))
  const cn = cFactor(m.max_samples)
  const scores = cells.map((cell) => {
    const z = cell.map((v, j) => Math.abs(v - meds[j]) / scale[j])
    let depth = 0
    for (const tr of m.trees) {
      let node = 0
      let d = 0
      while (tr.l[node] !== -1) {
        node = z[tr.f[node]] <= tr.t[node] ? tr.l[node] : tr.r[node]
        d++
      }
      depth += d + cFactor(tr.n[node])
    }
    return Math.round(2 ** (-(depth / m.trees.length) / cn) * 10000) / 10000
  })
  return { scores, thresholdAmber: m.threshold_amber, thresholdRed: m.threshold_red, model: m.version }
}
