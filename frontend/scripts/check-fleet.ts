import { seedFleet } from '../src/data/fleet'
import { DEMO_PROFILES, buildReading } from '../src/data/profiles'
import { diagnose } from '../src/ml/engine'
const t0 = Date.now()
const { fleet, scans } = await seedFleet(Date.parse('2026-11-04T10:00:00Z'))
console.log('seed ms', Date.now() - t0, 'size KB', Math.round(JSON.stringify(scans).length / 1024))
for (const b of fleet) console.log(b.batteryId.padEnd(12), b.scanIds.map(id => { const d = scans[id].diagnosis; return `${d.soh.value}/${d.safety.flag}${d.safety.suspectCell ? '#' + d.safety.suspectCell : ''}` }).join('  →  '))
for (const p of DEMO_PROFILES) {
  const b = fleet.find(f => f.batteryId === p.spec.batteryId)!
  const last = scans[b.scanIds.at(-1)!]
  const r = buildReading(p.spec, '2026-11-04T10:00:00Z', p.id, { timestamp: last.createdAt, cellsMv: last.reading.cellsMv })
  const d = await diagnose(r)
  console.log('demo scan', p.id, d.soh.value, d.safety.flag, d.safety.suspectCell, d.safety.cells.filter(c => c.state !== 'normal').map(c => `#${c.index} ${c.rules} dr${c.driftMvDay} s${c.score}`).join('|'))
}
