import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { ScanRecord, SignedPassport } from '../types'
import type { FleetBattery } from '../data/fleet'

export const TOUR_STEPS = [
  { id: 'open', title: 'Open Voltrace', hint: 'Welcome! This guide walks you through the full Voltrace workflow in about 3 minutes.', route: '/' },
  { id: 'home', title: 'Explore the home screen', hint: 'Scroll the dashboard: fleet health, recent scans and safety alerts.', route: '/' },
  { id: 'scan', title: 'Tap Scan Battery', hint: 'Tap the blue Scan button in the bottom bar.', route: '/scan' },
  { id: 'faulty', title: 'Select the Faulty Battery', hint: 'In Demo mode, choose the “Faulty Battery” profile.', route: '/scan' },
  { id: 'start', title: 'Start the simulated scan', hint: 'Tap “Start demo scan”.', route: '/scan' },
  { id: 'watch', title: 'Watch the inspection', hint: 'Voltrace reads the BMS, runs a load test and analyses every cell.', route: '/scan' },
  { id: 'diagnosis', title: 'Open the diagnosis', hint: 'Open the Diagnosis tab of the scan result.', route: null },
  { id: 'cell', title: 'Inspect the abnormal cell', hint: 'Tap the red cell (cell 11) to see why it was flagged.', route: null },
  { id: 'safety', title: 'Understand the safety warning', hint: 'Read the State of Safety card and its explanation.', route: null },
  { id: 'advice', title: 'View the recommendation', hint: 'Open the Advice tab to see what the owner should do.', route: null },
  { id: 'passport', title: 'Generate the Battery Passport', hint: 'Tap “Generate Battery Passport”.', route: null },
  { id: 'qr', title: 'Display the QR code', hint: 'The passport shows a signed QR code.', route: null },
  { id: 'phone', title: 'Scan it with another phone', hint: 'Point any phone camera at the QR code. It opens the public verification page.', route: null },
  { id: 'verify', title: 'Verify the passport', hint: 'Tap “Verify authenticity” to check the Ed25519 signature.', route: null },
  { id: 'tamper', title: 'Demonstrate tamper detection', hint: 'Open Tamper Test, change a value and watch verification fail.', route: null },
  { id: 'fleet', title: 'Open Fleet Management', hint: 'See how the faulty pack’s risk rose between scans.', route: '/fleet' },
] as const
export type TourStep = (typeof TOUR_STEPS)[number]['id']

export interface Settings {
  userName: string
  organisation: string
  role: string
  cloudInference: boolean
  offlineDemoSigning: boolean
  publicBaseUrl: string
  notifySafety: boolean
  notifyFleet: boolean
  notifyTips: boolean
  shareAnalytics: boolean
}

const DEFAULT_SETTINGS: Settings = {
  userName: 'Aarav Sharma',
  organisation: 'GreenWheels E-Mobility',
  role: 'Fleet operations lead',
  cloudInference: false,
  offlineDemoSigning: true,
  publicBaseUrl: '',
  notifySafety: true,
  notifyFleet: true,
  notifyTips: false,
  shareAnalytics: false,
}

interface State {
  seeded: boolean
  seedVersion: number
  scans: Record<string, ScanRecord>
  fleet: FleetBattery[]
  passports: Record<string, SignedPassport>
  settings: Settings
  tourActive: boolean
  tourDone: TourStep[]
  tourMinimised: boolean
  readAlerts: string[]
  lastProfile: string | null
  hydrate: (fleet: FleetBattery[], scans: Record<string, ScanRecord>) => void
  addScan: (s: ScanRecord) => void
  addPassport: (p: SignedPassport) => void
  updateSettings: (p: Partial<Settings>) => void
  startTour: () => void
  stopTour: () => void
  setTourMinimised: (v: boolean) => void
  markTour: (s: TourStep) => void
  markAlertsRead: (ids: string[]) => void
  setLastProfile: (id: string) => void
  resetDemo: () => void
}

export const SEED_VERSION = 3

export const useApp = create<State>()(
  persist(
    (set, get) => ({
      seeded: false,
      seedVersion: 0,
      scans: {},
      fleet: [],
      passports: {},
      settings: DEFAULT_SETTINGS,
      tourActive: false,
      tourDone: [],
      tourMinimised: false,
      readAlerts: [],
      lastProfile: null,
      hydrate: (fleet, scans) => set({ fleet, scans, seeded: true, seedVersion: SEED_VERSION }),
      addScan: (s) =>
        set((st) => {
          const fleet = st.fleet.some((f) => f.batteryId === s.batteryId)
            ? st.fleet.map((f) => (f.batteryId === s.batteryId ? { ...f, scanIds: [...f.scanIds, s.id] } : f))
            : [...st.fleet, { batteryId: s.batteryId, vehicleType: s.reading.vehicleType, vehicleReg: '—', depot: 'Unassigned', scanIds: [s.id] }]
          return { scans: { ...st.scans, [s.id]: s }, fleet }
        }),
      addPassport: (p) =>
        set((st) => ({
          passports: { ...st.passports, [p.payload.pid]: p },
          scans: p.scanId && st.scans[p.scanId] ? { ...st.scans, [p.scanId]: { ...st.scans[p.scanId], passportId: p.payload.pid } } : st.scans,
        })),
      updateSettings: (p) => set((st) => ({ settings: { ...st.settings, ...p } })),
      startTour: () => set({ tourActive: true, tourDone: ['open'], tourMinimised: false }),
      stopTour: () => set({ tourActive: false }),
      setTourMinimised: (v) => set({ tourMinimised: v }),
      markTour: (s) => {
        const st = get()
        if (!st.tourActive || st.tourDone.includes(s)) return
        // steps complete in order: completing a step also completes earlier ones
        const idx = TOUR_STEPS.findIndex((t) => t.id === s)
        const done = TOUR_STEPS.slice(0, idx + 1).map((t) => t.id)
        set({ tourDone: Array.from(new Set([...st.tourDone, ...done])) as TourStep[] })
      },
      markAlertsRead: (ids) => set((st) => ({ readAlerts: Array.from(new Set([...st.readAlerts, ...ids])) })),
      setLastProfile: (id) => set({ lastProfile: id }),
      resetDemo: () =>
        set((st) => ({
          seeded: false,
          scans: {},
          fleet: [],
          passports: {},
          tourDone: [],
          tourActive: false,
          readAlerts: [],
          lastProfile: null,
          settings: { ...DEFAULT_SETTINGS, publicBaseUrl: st.settings.publicBaseUrl },
        })),
    }),
    {
      name: 'voltrace.app.v1',
      storage: createJSONStorage(() => {
        try {
          localStorage.setItem('__vt', '1')
          localStorage.removeItem('__vt')
          return localStorage
        } catch {
          const mem = new Map<string, string>()
          return { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v), removeItem: (k) => void mem.delete(k) }
        }
      }),
    },
  ),
)

// ---------- selectors ----------
export function latestScan(st: Pick<State, 'scans' | 'fleet'>, batteryId: string): ScanRecord | undefined {
  const f = st.fleet.find((b) => b.batteryId === batteryId)
  const id = f?.scanIds[f.scanIds.length - 1]
  return id ? st.scans[id] : undefined
}

export function batteryScans(st: Pick<State, 'scans' | 'fleet'>, batteryId: string): ScanRecord[] {
  const f = st.fleet.find((b) => b.batteryId === batteryId)
  return (f?.scanIds ?? []).map((id) => st.scans[id]).filter(Boolean)
}

export interface Alert {
  id: string
  batteryId: string
  scanId: string
  level: 1 | 2
  title: string
  detail: string
  at: string
  rose: boolean
}

/** Alerts: latest scan of each battery that is AMBER/RED; flags whether risk rose since previous scan. */
export function fleetAlerts(st: Pick<State, 'scans' | 'fleet'>): Alert[] {
  const out: Alert[] = []
  for (const b of st.fleet) {
    const list = batteryScans(st, b.batteryId)
    const last = list[list.length - 1]
    if (!last || last.diagnosis.safety.flag === 'GREEN') continue
    const prev = list[list.length - 2]
    const lv = last.diagnosis.safety.flag === 'RED' ? 2 : 1
    const prevLv = prev ? (prev.diagnosis.safety.flag === 'RED' ? 2 : prev.diagnosis.safety.flag === 'AMBER' ? 1 : 0) : 0
    const cell = last.diagnosis.safety.suspectCell
    out.push({
      id: `${last.id}`,
      batteryId: b.batteryId,
      scanId: last.id,
      level: lv as 1 | 2,
      title: lv === 2 ? `Critical abnormality${cell ? ` · cell ${cell}` : ''}` : `Needs attention${cell ? ` · cell ${cell}` : ''}`,
      detail: last.diagnosis.safety.findings[0]?.title ?? last.diagnosis.safety.headline,
      at: last.createdAt,
      rose: lv > prevLv,
    })
  }
  return out.sort((a, b) => b.level - a.level || b.at.localeCompare(a.at))
}
