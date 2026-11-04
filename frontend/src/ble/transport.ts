import { ADAPTERS, uuid16, type ProtocolAdapter, type ProtocolId } from './protocols'

/**
 * Transport abstraction so the same protocol adapters work over:
 *   - Web Bluetooth (Chrome / Edge on Android, desktop Chrome)
 *   - Capacitor native BLE (@capacitor-community/bluetooth-le) inside the Android app,
 *     where the WebView has no Web Bluetooth.
 */
export interface BleLink {
  name: string
  protocol: ProtocolId
  adapter: ProtocolAdapter
  send(frame: Uint8Array): Promise<void>
  onDisconnect(cb: () => void): void
  disconnect(): Promise<void>
}

export type BleSupport = { ok: true; kind: 'web' | 'native' } | { ok: false; reason: string }

const isNative = () => !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()

export async function bleSupport(): Promise<BleSupport> {
  if (isNative()) return { ok: true, kind: 'native' }
  if (!window.isSecureContext) return { ok: false, reason: 'Bluetooth needs a secure (HTTPS) connection. Open Voltrace over HTTPS or install the Android app.' }
  if (!('bluetooth' in navigator)) {
    const ua = (navigator as Navigator).userAgent
    const ios = /iPhone|iPad|iPod/.test(ua)
    return { ok: false, reason: ios ? 'iOS browsers do not support Web Bluetooth. Use the Voltrace Android app or Chrome on Android.' : 'This browser does not support Web Bluetooth. Use Chrome or Edge on Android, or the Voltrace Android app.' }
  }
  try {
    const available = await navigator.bluetooth.getAvailability()
    if (!available) return { ok: false, reason: 'Bluetooth is turned off or no Bluetooth adapter is available on this device.' }
  } catch { /* some browsers lack getAvailability */ }
  return { ok: true, kind: 'web' }
}

const SERVICES = [uuid16(0xff00), uuid16(0xfff0)]

// ---------------- Web Bluetooth ----------------
async function connectWeb(pref: ProtocolId | 'auto', onStatus: (s: string) => void): Promise<BleLink> {
  onStatus('Choose your battery from the list…')
  const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: SERVICES })
  onStatus(`Connecting to ${device.name ?? 'device'}…`)
  const server = await device.gatt!.connect()
  onStatus('Identifying BMS protocol…')
  let protocol: ProtocolId | null = null
  let service: BluetoothRemoteGATTService | null = null
  for (const p of pref === 'auto' ? (['JBD', 'Daly'] as ProtocolId[]) : [pref]) {
    try {
      service = await server.getPrimaryService(p === 'JBD' ? uuid16(0xff00) : uuid16(0xfff0))
      protocol = p
      break
    } catch { /* try next */ }
  }
  if (!service || !protocol) {
    device.gatt?.disconnect()
    throw new Error('This device does not expose a supported BMS service (JBD 0xFF00 or Daly 0xFFF0).')
  }
  const adapter = ADAPTERS[protocol]()
  const rx = await service.getCharacteristic(adapter.notify)
  const tx = await service.getCharacteristic(adapter.write)
  await rx.startNotifications()
  rx.addEventListener('characteristicvaluechanged', (e) => {
    const v = (e.target as BluetoothRemoteGATTCharacteristic).value!
    adapter.feed(new Uint8Array(v.buffer, v.byteOffset, v.byteLength))
  })
  return {
    name: device.name ?? 'Unnamed BMS',
    protocol,
    adapter,
    send: async (f) => { await (tx.writeValueWithoutResponse ? tx.writeValueWithoutResponse(f) : tx.writeValue(f)) },
    onDisconnect: (cb) => device.addEventListener('gattserverdisconnected', cb),
    disconnect: async () => device.gatt?.disconnect(),
  }
}

// ---------------- Capacitor native ----------------
async function connectNative(pref: ProtocolId | 'auto', onStatus: (s: string) => void): Promise<BleLink> {
  const { BleClient } = await import('@capacitor-community/bluetooth-le')
  onStatus('Requesting Bluetooth permission…')
  await BleClient.initialize({ androidNeverForLocation: true })
  onStatus('Choose your battery from the list…')
  const device = await BleClient.requestDevice({ optionalServices: SERVICES })
  let disconnected: (() => void) | null = null
  onStatus(`Connecting to ${device.name ?? 'device'}…`)
  await BleClient.connect(device.deviceId, () => disconnected?.())
  const services = await BleClient.getServices(device.deviceId)
  const has = (u: string) => services.some((s) => s.uuid.toLowerCase() === u)
  const protocol: ProtocolId | null = pref !== 'auto' ? pref : has(uuid16(0xff00)) ? 'JBD' : has(uuid16(0xfff0)) ? 'Daly' : null
  if (!protocol) {
    await BleClient.disconnect(device.deviceId)
    throw new Error('This device does not expose a supported BMS service (JBD 0xFF00 or Daly 0xFFF0).')
  }
  const adapter = ADAPTERS[protocol]()
  await BleClient.startNotifications(device.deviceId, adapter.service, adapter.notify, (v) => adapter.feed(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)))
  return {
    name: device.name ?? 'Unnamed BMS',
    protocol,
    adapter,
    send: (f) => BleClient.writeWithoutResponse(device.deviceId, adapter.service, adapter.write, new DataView(f.buffer)),
    onDisconnect: (cb) => { disconnected = cb },
    disconnect: () => BleClient.disconnect(device.deviceId),
  }
}

export function connectBms(pref: ProtocolId | 'auto', onStatus: (s: string) => void) {
  return isNative() ? connectNative(pref, onStatus) : connectWeb(pref, onStatus)
}

/** Request one full snapshot from the BMS (resolves when the adapter has all frames). */
export async function readSnapshot(link: BleLink, timeoutMs = 4000) {
  link.adapter.reset()
  for (const f of link.adapter.requests()) {
    await link.send(f)
    await new Promise((r) => setTimeout(r, 120))
  }
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    const s = link.adapter.snapshot()
    if (s) return s
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error('The BMS did not answer in time. Make sure the battery is awake and in range.')
}
