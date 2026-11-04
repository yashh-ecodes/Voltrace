import { DEMO_PROFILES, buildReading } from '../src/data/profiles'
import { diagnose } from '../src/ml/engine'
import { buildPayload, sha256Hex } from '../src/lib/passport'
import { canonicalJson } from '../src/lib/canonical'
const out = []
for (const p of DEMO_PROFILES) {
  const r = buildReading(p.spec, '2026-11-04T10:00:00.000Z', p.id)
  const d = await diagnose(r)
  const payload = { ...buildPayload({ id: 'x', batteryId: r.batteryId, createdAt: '', reading: r, diagnosis: d }), pid: 'VTP-ABCD-EFGH', iat: '2026-11-04T10:00:00Z', iss: 'Voltrace Issuer (server)', kid: 'vt-srv-2026-01' }
  out.push({ payload, hash: sha256Hex(payload), canon: canonicalJson(payload) })
}
console.log(JSON.stringify(out))
