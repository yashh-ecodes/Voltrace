import { AlertTriangle, ChevronRight, ShieldAlert, TrendingUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { ScanRecord } from '../types'
import type { Alert } from '../store/app'
import { relTime } from '../lib/format'
import { StatusPill, cx, Badge } from './ui'
import { SohRing } from './visuals'

export function ScanRow({ s, onClick, sub }: { s: ScanRecord; onClick?: () => void; sub?: string }) {
  const nav = useNavigate()
  return (
    <button onClick={onClick ?? (() => nav(`/battery/${s.id}`))} className="tap flex min-h-[68px] w-full items-center gap-3 px-4 py-3 text-left active:bg-subtle/70">
      <SohRing value={s.diagnosis.soh.value} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[15px] font-semibold text-ink">{s.batteryId}</span>
          {s.id.startsWith('scan-u-') && s.reading.source === 'demo' && <Badge tone="amber" className="h-5 px-1.5 text-[10px]">Demo</Badge>}
        </div>
        <div className="mt-0.5 truncate text-[13px] text-muted">{sub ?? `${s.reading.vehicleType} · ${relTime(s.createdAt)}`}</div>
      </div>
      <StatusPill flag={s.diagnosis.safety.flag} size="sm" label={s.diagnosis.safety.flag === 'GREEN' ? 'No alerts' : s.diagnosis.safety.flag === 'AMBER' ? 'Attention' : 'Critical'} />
      <ChevronRight className="h-5 w-5 shrink-0 text-faint" />
    </button>
  )
}

export function AlertRow({ a }: { a: Alert }) {
  const nav = useNavigate()
  const red = a.level === 2
  return (
    <button onClick={() => nav(`/battery/${a.scanId}/diagnosis`)} className={cx('tap flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left active:scale-[0.99]', red ? 'border-crit-line bg-crit-soft' : 'border-warn-line bg-warn-soft')}>
      <span className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white', red ? 'text-crit' : 'text-warn')}>
        {red ? <ShieldAlert className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cx('truncate text-[14px] font-semibold', red ? 'text-crit-ink' : 'text-warn-ink')}>{a.title}</span>
        </div>
        <p className="mt-0.5 text-[13px] leading-snug text-ink/80">
          <span className="font-semibold text-ink">{a.batteryId}</span> · {a.detail}
        </p>
        <div className="mt-1.5 flex items-center gap-2 text-xs text-muted">
          {a.rose && <span className="inline-flex items-center gap-1 font-semibold text-crit-ink"><TrendingUp className="h-3.5 w-3.5" />Risk rose since last scan</span>}
          <span>{relTime(a.at)}</span>
        </div>
      </div>
    </button>
  )
}
