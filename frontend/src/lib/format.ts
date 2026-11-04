import type { CellState, SafetyFlag, UsageCategory } from '../types'

export function relTime(iso: string, now = Date.now()) {
  const s = (now - new Date(iso).getTime()) / 1000
  if (s < 60) return 'Just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  const d = Math.floor(s / 86400)
  if (d === 1) return 'Yesterday'
  if (d < 30) return `${d} days ago`
  if (d < 365) return `${Math.floor(d / 30)} mo ago`
  return `${Math.floor(d / 365)} y ago`
}

export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
export const fmtShort = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

export const FLAG_META: Record<SafetyFlag, { label: string; short: string; text: string; bg: string; dot: string; ring: string; hex: string; soft: string }> = {
  GREEN: { label: 'No abnormality', short: 'Green', text: 'text-ok-ink', bg: 'bg-ok-soft', dot: 'bg-ok', ring: 'border-ok-line', hex: '#16A34A', soft: '#ECFDF3' },
  AMBER: { label: 'Needs attention', short: 'Amber', text: 'text-warn-ink', bg: 'bg-warn-soft', dot: 'bg-warn', ring: 'border-warn-line', hex: '#F59E0B', soft: '#FFF8EB' },
  RED: { label: 'Critical', short: 'Red', text: 'text-crit-ink', bg: 'bg-crit-soft', dot: 'bg-crit', ring: 'border-crit-line', hex: '#EF4444', soft: '#FEF2F2' },
}

export const CELL_META: Record<CellState, { label: string; flag: SafetyFlag }> = {
  normal: { label: 'Normal', flag: 'GREEN' },
  warning: { label: 'Warning', flag: 'AMBER' },
  critical: { label: 'Critical', flag: 'RED' },
}

export const USAGE_META: Record<UsageCategory, { label: string; tone: SafetyFlag | 'BLUE' | 'TEAL' }> = {
  CONTINUE: { label: 'Continue in vehicle', tone: 'GREEN' },
  INSPECT: { label: 'Professional inspection', tone: 'AMBER' },
  SECOND_LIFE: { label: 'Second-life candidate', tone: 'TEAL' },
  RECYCLE: { label: 'Remove from service', tone: 'RED' },
}

export const sohColor = (v: number) => (v >= 80 ? '#14B8A6' : v >= 65 ? '#F59E0B' : '#EF4444')
