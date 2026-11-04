import { DEMO_PROFILES, buildReading } from '../src/data/profiles'
import { diagnose } from '../src/ml/engine'
import { predictSoh, iforestScores } from '../src/ml/models'
import parity from '../../backend/models/soh_parity.json'
import { buildPayload, sha256Hex, encodeToken, decodeToken } from '../src/lib/passport'
import { canonicalJson } from '../src/lib/canonical'

const xgbF = ['cycle_frac','r_growth','recovery_ratio','slope_rel','avg_temp_c','bms_soh']
let err = 0
for (let i = 0; i < parity.X.length; i++) {
  const r = await predictSoh(Object.fromEntries(xgbF.map((f, j) => [f, parity.X[i][j]])))
  err = Math.max(err, Math.abs(r.p50 - parity.pred[i][1]), Math.abs(r.p05 - parity.pred[i][0]), Math.abs(r.p95 - parity.pred[i][2]))
}
console.log('TS vs xgboost max err', err.toFixed(3))
for (const p of DEMO_PROFILES) {
  const reading = buildReading(p.spec, '2026-11-04T10:00:00.000Z', p.id)
  const d = await diagnose(reading)
  console.log(p.id, 'SoH', d.soh.value, `[${d.soh.low}-${d.soh.high}]`, 'flag', d.safety.flag, 'suspect', d.safety.suspectCell, 'spread', d.safety.spreadMv, 'usage', d.usage)
  console.log('  features', JSON.stringify(d.features))
  console.log('  cells', d.safety.cells.filter(c => c.state !== 'normal').map(c => `#${c.index} ${c.state} dev${c.devMv} sag${c.sagDevPct} t${c.tempDevC} dr${c.driftMvDay} s${c.score} ${c.rules}`).join(' | ') || 'all normal', ' maxScore', Math.max(...d.safety.cells.map(c=>c.score)))
  const payload = { ...buildPayload({ id: 'x', batteryId: reading.batteryId, createdAt: '', reading, diagnosis: d }), pid: 'VTP-ABCD-EFGH', iat: '2026-11-04T10:00:00Z', iss: 'Voltrace Issuer (server)', kid: 'vt-srv-2026-01' }
  const tok = encodeToken({ payload: payload as any, hash: sha256Hex(payload), sig: 'ab'.repeat(64) })
  console.log('  canonical len', canonicalJson(payload).length, 'token len', tok.length, 'roundtrip', JSON.stringify(decodeToken(tok)!.payload) === JSON.stringify(JSON.parse(canonicalJson(payload))))
}
