import type { CellAnalysis } from '../types'
import { Sheet, StatusPill, InfoButton, cx } from './ui'
import { CELL_META } from '../lib/format'

const RULE_TEXT: Record<string, string> = {
  rest: 'Resting voltage deviates from the pack median',
  sag: 'Voltage sags more than siblings under load',
  temp: 'Runs warmer than the pack median',
  drift: 'Losing charge faster than siblings since the last scan',
}

export function CellSheet({ cell, onClose, medianMv }: { cell: CellAnalysis | null; onClose: () => void; medianMv: number }) {
  if (!cell) return null
  const meta = CELL_META[cell.state]
  const rows: { l: string; v: string; k?: Parameters<typeof InfoButton>[0]['k']; warn?: boolean }[] = [
    { l: 'Voltage', v: `${(cell.mv / 1000).toFixed(3)} V`, k: 'cellVoltage' },
    { l: 'Difference from pack median', v: `${cell.devMv > 0 ? '+' : ''}${cell.devMv} mV`, k: 'median', warn: Math.abs(cell.devMv) > 30 },
    { l: 'Temperature', v: cell.tempC !== undefined ? `${cell.tempC.toFixed(1)} °C${cell.tempDevC !== null ? ` (${cell.tempDevC > 0 ? '+' : ''}${cell.tempDevC} °C)` : ''}` : 'Not available', k: 'temperature', warn: (cell.tempDevC ?? 0) > 4 },
    { l: 'Sag vs siblings', v: cell.sagDevPct !== null ? `${cell.sagDevPct > 0 ? '+' : ''}${cell.sagDevPct}%` : 'No load test', k: 'sag', warn: (cell.sagDevPct ?? 0) > 30 },
    { l: 'Drift vs siblings', v: cell.driftMvDay !== null ? `${cell.driftMvDay > 0 ? '+' : ''}${cell.driftMvDay} mV/day` : 'Needs 2 scans', k: 'drift', warn: (cell.driftMvDay ?? 0) < -8 },
    { l: 'Anomaly score', v: cell.score.toFixed(2), k: 'iforest', warn: cell.ifLevel > 0 },
  ]
  return (
    <Sheet open onClose={onClose} title={<span className="flex items-center gap-2">Cell {cell.index}<StatusPill flag={meta.flag} size="sm" label={meta.label} /></span>}>
      <div className="-mx-1 divide-y divide-line/80 rounded-xl border border-line">
        {rows.map((r) => (
          <div key={r.l} className="flex min-h-[46px] items-center justify-between gap-2 px-3 py-2">
            <span className="flex items-center gap-1 text-sm text-muted">{r.l}{r.k && <InfoButton k={r.k} />}</span>
            <span className={cx('text-sm font-semibold tabular-nums', r.warn ? (cell.state === 'critical' ? 'text-crit-ink' : 'text-warn-ink') : 'text-ink')}>{r.v}</span>
          </div>
        ))}
      </div>
      <div className={cx('mt-4 rounded-xl p-3.5 text-sm leading-relaxed', cell.state === 'normal' ? 'bg-ok-soft text-ok-ink' : cell.state === 'warning' ? 'bg-warn-soft text-warn-ink' : 'bg-crit-soft text-crit-ink')}>
        {cell.state === 'normal' ? (
          <>This cell behaves like its siblings. Pack median is {(medianMv / 1000).toFixed(3)} V.</>
        ) : (
          <>
            <p className="font-semibold">Why this cell was flagged</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {cell.rules.map((r) => <li key={r}>{RULE_TEXT[r]}</li>)}
              {cell.ifLevel > 0 && <li>Isolation Forest marks it as a statistical outlier</li>}
            </ul>
          </>
        )}
      </div>
    </Sheet>
  )
}
