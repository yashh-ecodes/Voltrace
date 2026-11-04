/**
 * BMS protocol adapters (publicly documented command sets).
 *
 * JBD / Xiaoxiang "smart BMS"  — service 0xFF00, notify 0xFF01, write 0xFF02
 *   request : DD A5 <reg> 00 <chk_hi> <chk_lo> 77
 *   response: DD <reg> <status> <len> <data…> <chk_hi> <chk_lo> 77
 * Daly smart BMS (BLE)          — service 0xFFF0, notify 0xFFF1, write 0xFFF2
 *   request : A5 80 <cmd> 08 00×8 <sum>
 *   response: A5 01 <cmd> 08 <8 data bytes> <sum>   (13-byte frames)
 */
export const uuid16 = (x: number) => `0000${x.toString(16).padStart(4, '0')}-0000-1000-8000-00805f9b34fb`

export type ProtocolId = 'JBD' | 'Daly'

export interface BmsSnapshot {
  packV: number
  packA: number
  soc: number
  remainingAh: number
  fullAh: number
  ratedAh?: number
  cycles: number
  cellsMv: number[]
  tempsC: number[]
  protections: string[]
  firmware?: string
}

export interface ProtocolAdapter {
  id: ProtocolId
  service: string
  notify: string
  write: string
  /** Request frames needed for one full snapshot, in order. */
  requests(): Uint8Array[]
  /** Feed a notification chunk; returns true when a complete snapshot is available. */
  feed(chunk: Uint8Array): boolean
  snapshot(): BmsSnapshot | null
  reset(): void
}

const u16 = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1]
const s16 = (b: Uint8Array, i: number) => { const v = u16(b, i); return v & 0x8000 ? v - 0x10000 : v }

// ---------------- JBD ----------------
const JBD_PROT = ['Cell over-voltage', 'Cell under-voltage', 'Pack over-voltage', 'Pack under-voltage', 'Charge over-temperature', 'Charge under-temperature', 'Discharge over-temperature', 'Discharge under-temperature', 'Charge over-current', 'Discharge over-current', 'Short circuit', 'Front-end IC error', 'MOSFET software lock']

export function jbdRequest(reg: number) {
  const chk = (0x10000 - (reg + 0)) & 0xffff
  return new Uint8Array([0xdd, 0xa5, reg, 0x00, chk >> 8, chk & 0xff, 0x77])
}

export function createJbd(): ProtocolAdapter {
  let buf: number[] = []
  let basic: Uint8Array | null = null
  let cells: Uint8Array | null = null
  let hw: string | undefined
  const frames = () => {
    // extract complete frames DD <reg> <st> <len> data chk chk 77
    while (buf.length >= 7) {
      const start = buf.indexOf(0xdd)
      if (start < 0) { buf = []; return }
      if (start > 0) buf = buf.slice(start)
      if (buf.length < 4) return
      const len = buf[3]
      const total = 4 + len + 3
      if (buf.length < total) return
      const frame = Uint8Array.from(buf.slice(0, total))
      buf = buf.slice(total)
      if (frame[total - 1] !== 0x77) continue
      let sum = 0
      for (let i = 2; i < 4 + len; i++) sum += frame[i]
      const chk = (0x10000 - sum) & 0xffff
      if (u16(frame, 4 + len) !== chk || frame[2] !== 0) continue
      const data = frame.slice(4, 4 + len)
      if (frame[1] === 0x03) basic = data
      else if (frame[1] === 0x04) cells = data
      else if (frame[1] === 0x05) hw = String.fromCharCode(...data).replace(/[^\x20-\x7e]/g, '')
    }
  }
  return {
    id: 'JBD',
    service: uuid16(0xff00),
    notify: uuid16(0xff01),
    write: uuid16(0xff02),
    requests: () => [jbdRequest(0x05), jbdRequest(0x03), jbdRequest(0x04)],
    feed(chunk) { buf.push(...chunk); frames(); return !!basic && !!cells },
    reset() { basic = null; cells = null },
    snapshot() {
      if (!basic || !cells) return null
      const b = basic
      const prot = u16(b, 16)
      const ntc = b[22] ?? 0
      const temps: number[] = []
      for (let k = 0; k < ntc; k++) temps.push(Math.round((u16(b, 23 + 2 * k) - 2731)) / 10)
      const cellsMv: number[] = []
      for (let i = 0; i + 1 < cells.length; i += 2) cellsMv.push(u16(cells, i))
      return {
        packV: u16(b, 0) / 100,
        packA: s16(b, 2) / 100,
        remainingAh: u16(b, 4) / 100,
        fullAh: u16(b, 6) / 100,
        cycles: u16(b, 8),
        soc: b[19],
        cellsMv,
        tempsC: temps,
        protections: JBD_PROT.filter((_, i) => prot & (1 << i)),
        firmware: hw,
      }
    },
  }
}

// ---------------- Daly ----------------
export function dalyRequest(cmd: number) {
  const f = new Uint8Array(13)
  f.set([0xa5, 0x80, cmd, 0x08])
  f[12] = f.slice(0, 12).reduce((a, b) => a + b, 0) & 0xff
  return f
}

export function createDaly(): ProtocolAdapter {
  let buf: number[] = []
  const got = new Map<number, Uint8Array>()
  const cellFrames = new Map<number, Uint8Array>()
  const tempFrames = new Map<number, Uint8Array>()
  let cellCount = 0
  let tempCount = 0
  const parse = () => {
    while (buf.length >= 13) {
      const s = buf.indexOf(0xa5)
      if (s < 0) { buf = []; return }
      if (s > 0) buf = buf.slice(s)
      if (buf.length < 13) return
      const f = Uint8Array.from(buf.slice(0, 13))
      const sum = f.slice(0, 12).reduce((a, b) => a + b, 0) & 0xff
      if (sum !== f[12] || f[3] !== 0x08) { buf = buf.slice(1); continue }
      buf = buf.slice(13)
      const cmd = f[2]
      const d = f.slice(4, 12)
      if (cmd === 0x95) cellFrames.set(d[0], d)
      else if (cmd === 0x96) tempFrames.set(d[0], d)
      else got.set(cmd, d)
      if (cmd === 0x94) { cellCount = d[0]; tempCount = d[1] }
    }
  }
  const ready = () => got.has(0x90) && got.has(0x93) && got.has(0x94) && cellCount > 0 && cellFrames.size >= Math.ceil(cellCount / 3)
  return {
    id: 'Daly',
    service: uuid16(0xfff0),
    notify: uuid16(0xfff1),
    write: uuid16(0xfff2),
    requests: () => [0x50, 0x90, 0x92, 0x93, 0x94, 0x95, 0x96, 0x98].map(dalyRequest),
    feed(chunk) { buf.push(...chunk); parse(); return ready() },
    reset() { got.clear(); cellFrames.clear(); tempFrames.clear() },
    snapshot() {
      if (!ready()) return null
      const soc = got.get(0x90)!
      const mos = got.get(0x93)!
      const st = got.get(0x94)!
      const rated = got.get(0x50)
      const cellsMv: number[] = []
      for (let fr = 1; cellsMv.length < cellCount; fr++) {
        const d = cellFrames.get(fr)
        if (!d) break
        for (let k = 0; k < 3 && cellsMv.length < cellCount; k++) cellsMv.push(u16(d, 1 + 2 * k))
      }
      const temps: number[] = []
      for (let fr = 1; temps.length < tempCount; fr++) {
        const d = tempFrames.get(fr)
        if (!d) break
        for (let k = 1; k < 8 && temps.length < tempCount; k++) temps.push(d[k] - 40)
      }
      if (!temps.length && got.has(0x92)) { const t = got.get(0x92)!; temps.push(t[0] - 40, t[2] - 40) }
      const fail = got.get(0x98)
      const remainingAh = ((mos[4] << 24) | (mos[5] << 16) | (mos[6] << 8) | mos[7]) / 1000
      const ratedAh = rated ? ((rated[0] << 24) | (rated[1] << 16) | (rated[2] << 8) | rated[3]) / 1000 : undefined
      const socPct = u16(soc, 6) / 10
      return {
        packV: u16(soc, 0) / 10,
        packA: (u16(soc, 4) - 30000) / 10,
        soc: socPct,
        remainingAh,
        fullAh: socPct > 5 ? Math.round((remainingAh / (socPct / 100)) * 10) / 10 : ratedAh ?? 0,
        ratedAh,
        cycles: u16(st, 5),
        cellsMv,
        tempsC: temps,
        protections: fail && fail.some((x) => x) ? ['BMS fault code active'] : [],
      }
    },
  }
}

export const ADAPTERS = { JBD: createJbd, Daly: createDaly }
