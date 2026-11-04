import { createDaly, createJbd } from '../src/ble/protocols'
const assert = (c: unknown, m: string) => { if (!c) { console.error('FAIL', m); process.exit(1) } }
// ---- JBD: build responses DD reg 00 len data chk 77 ----
const jbdFrame = (reg: number, data: number[]) => {
  const body = [0x00, data.length, ...data]
  const sum = body.reduce((a, b) => a + b, 0)
  const chk = (0x10000 - sum) & 0xffff
  return [0xdd, reg, ...body, chk >> 8, chk & 0xff, 0x77]
}
const u16 = (v: number) => [(v >> 8) & 0xff, v & 0xff]
const basic = [...u16(5281), ...u16(0xffff - 300 + 1), ...u16(6220), ...u16(10000), ...u16(620), ...u16(0), 0, 0, 0, 0, ...u16(0b10), 0x10, 68, 3, 16, 2, ...u16(3031), ...u16(3041)]
const cells: number[] = []; for (let i = 0; i < 16; i++) cells.push(...u16(i === 10 ? 3237 : 3305))
const j = createJbd()
const stream = [...jbdFrame(0x03, basic), ...jbdFrame(0x04, cells)]
for (let i = 0; i < stream.length; i += 20) j.feed(Uint8Array.from(stream.slice(i, i + 20))) // 20-byte BLE chunks
const s = j.snapshot()!
assert(s && s.packV === 52.81 && s.packA === -3 && s.cycles === 620 && s.soc === 68 && s.cellsMv.length === 16 && s.cellsMv[10] === 3237 && s.tempsC[0] === 30 && s.protections[0] === 'Cell under-voltage', 'JBD parse ' + JSON.stringify(s))
console.log('JBD ok', s.packV, 'V', s.cellsMv.length, 'cells', s.protections)
// ---- Daly: A5 01 cmd 08 data[8] sum ----
const df = (cmd: number, d: number[]) => { const f = [0xa5, 0x01, cmd, 0x08, ...d]; return [...f, f.reduce((a, b) => a + b, 0) & 0xff] }
const d = createDaly()
const frames = [
  df(0x90, [...u16(518), ...u16(0), ...u16(30000 - 25), ...u16(640)]),
  df(0x93, [0, 1, 1, 0, 0, 0, 0x4a, 0x38]),
  df(0x94, [14, 2, 0, 0, 0, ...u16(1140), 0]),
  ...[1, 2, 3, 4, 5].map((fr) => df(0x95, [fr, ...u16(3790), ...u16(3792), ...u16(3788), 0])),
  df(0x96, [1, 71, 72, 0, 0, 0, 0, 0]),
]
for (const f of frames) d.feed(Uint8Array.from(f))
const t = d.snapshot()!
assert(t && t.packV === 51.8 && t.packA === -2.5 && t.soc === 64 && t.cycles === 1140 && t.cellsMv.length === 14 && t.tempsC.join() === '31,32' && t.remainingAh === 19, 'Daly parse ' + JSON.stringify(t))
console.log('Daly ok', t.packV, 'V', t.cellsMv.length, 'cells', t.remainingAh, 'Ah')
