import { useMemo } from 'react'
import { fleetAlerts, latestScan, useApp } from '../store/app'
import type { ScanRecord } from '../types'

export function useFleetSummary() {
  const scans = useApp((s) => s.scans)
  const fleet = useApp((s) => s.fleet)
  return useMemo(() => {
    const latest = fleet.map((b) => latestScan({ scans, fleet }, b.batteryId)).filter(Boolean) as ScanRecord[]
    const flags = { GREEN: 0, AMBER: 0, RED: 0 }
    for (const s of latest) flags[s.diagnosis.safety.flag]++
    const avg = latest.length ? latest.reduce((a, s) => a + s.diagnosis.soh.value, 0) / latest.length : 0
    const buckets = [
      { label: '<60', min: 0, max: 60, count: 0, color: '#EF4444' },
      { label: '60–70', min: 60, max: 70, count: 0, color: '#F59E0B' },
      { label: '70–80', min: 70, max: 80, count: 0, color: '#FBBF24' },
      { label: '80–90', min: 80, max: 90, count: 0, color: '#2DD4BF' },
      { label: '90+', min: 90, max: 101, count: 0, color: '#14B8A6' },
    ]
    for (const s of latest) {
      const b = buckets.find((x) => s.diagnosis.soh.value >= x.min && s.diagnosis.soh.value < x.max)
      if (b) b.count++
    }
    const allScans = Object.values(scans).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const usage = { CONTINUE: 0, INSPECT: 0, SECOND_LIFE: 0, RECYCLE: 0 }
    for (const s of latest) usage[s.diagnosis.usage]++
    return { latest, flags, avg, buckets, allScans, total: latest.length, alerts: fleetAlerts({ scans, fleet }), usage }
  }, [scans, fleet])
}

export function useUnreadAlerts() {
  const { alerts } = useFleetSummary()
  const read = useApp((s) => s.readAlerts)
  return alerts.filter((a) => !read.includes(a.id))
}

export function greeting(d = new Date()) {
  const h = d.getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}
