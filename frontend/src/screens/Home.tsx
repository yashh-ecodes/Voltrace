import { Bell, BookOpenCheck, PlayCircle, QrCode, ScanLine, ShieldCheck, Sparkles, Truck, ArrowRight } from 'lucide-react'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, IconButton, LinkAction, Page, Section, Divided, InfoButton, cx } from '../components/ui'
import { BatteryArt, Wordmark } from '../components/visuals'
import { AlertRow, ScanRow } from '../components/rows'
import { greeting, useFleetSummary, useUnreadAlerts } from '../lib/hooks'
import { useApp } from '../store/app'

export default function Home() {
  const nav = useNavigate()
  const { flags, avg, total, buckets, allScans, alerts } = useFleetSummary()
  const unread = useUnreadAlerts()
  const st = useApp()
  const first = st.settings.userName.split(' ')[0]
  const initials = st.settings.userName.split(' ').map((p) => p[0]).slice(0, 2).join('')
  useEffect(() => {
    st.markTour('open')
    const t = setTimeout(() => st.markTour('home'), 6000)
    const onScroll = () => window.scrollY > 300 && st.markTour('home')
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { clearTimeout(t); window.removeEventListener('scroll', onScroll) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const maxB = Math.max(1, ...buckets.map((b) => b.count))

  return (
    <>
      <header className="sticky top-0 z-30 bg-bg/90 pt-safe backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[480px] items-center justify-between px-4">
          <Wordmark />
          <div className="-mr-2 flex items-center">
            <IconButton label="Notifications" badge={unread.length} onClick={() => nav('/notifications')}><Bell className="h-[22px] w-[22px]" /></IconButton>
            <button aria-label="Profile" onClick={() => nav('/profile')} className="tap ml-1 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary-soft to-teal-soft text-sm font-bold text-primary-700 ring-1 ring-line">{initials}</button>
          </div>
        </div>
      </header>
      <Page>
        <div className="animate-fade-up pt-2">
          <p className="text-sm text-muted">{greeting()}, {first}</p>
          <h1 className="mt-0.5 text-[24px] font-bold leading-tight tracking-tight text-ink">Know your battery.<br />Trust its future.</h1>
        </div>

        {/* Main action */}
        <Card className="relative mt-5 overflow-hidden border-0 bg-gradient-to-br from-[#EAF3FF] via-white to-[#E6F7F4] p-5">
          <div className="pointer-events-none absolute right-3 top-5 w-[118px]"><BatteryArt level={0.78} flag="BLUE" scanning cells={5} /></div>
          <div className="relative max-w-[62%]">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-1 text-[11px] font-semibold text-primary-700 ring-1 ring-primary/15"><ShieldCheck className="h-3.5 w-3.5" />30-second check</span>
            <h2 className="mt-3 text-[19px] font-bold leading-snug text-ink">Check Your Battery Health</h2>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">Scan your battery and understand its health and safety indicators.</p>
          </div>
          <div className="relative mt-5 grid grid-cols-2 gap-2.5">
            <Button className="gap-1.5 px-2.5" onClick={() => nav('/scan')} icon={<ScanLine className="h-5 w-5" />}>Scan Battery</Button>
            <Button variant="secondary" className="gap-1.5 px-2.5" onClick={() => nav('/scan?mode=demo')} icon={<PlayCircle className="h-5 w-5 text-primary" />}>Try Demo</Button>
          </div>
        </Card>

        {/* Judge demo entry */}
        {!st.tourActive && (
          <button onClick={() => nav('/demo')} className="tap mt-3 flex w-full items-center gap-3 rounded-2xl bg-ink p-3.5 text-left text-white active:scale-[0.99]">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10"><Sparkles className="h-5 w-5 text-teal" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold">Explore Demo</span>
              <span className="block truncate text-[12.5px] text-white/65">Guided tour: scan → AI diagnosis → verified passport</span>
            </span>
            <ArrowRight className="h-5 w-5 text-white/70" />
          </button>
        )}

        {/* Overview */}
        <Section title="Battery overview" action={<LinkAction onClick={() => nav('/analytics')}>Analytics</LinkAction>}>
          <div className="grid grid-cols-2 gap-2.5">
            <Stat label="Batteries scanned" value={total} sub="in your fleet" onClick={() => nav('/fleet')} />
            <Stat label="Average health" value={`${avg.toFixed(0)}%`} sub="State of Health" tone="blue" onClick={() => nav("/analytics")} />
            <Stat label="No alerts" value={flags.GREEN} sub="no abnormality found" tone="green" onClick={() => nav('/fleet?f=GREEN')} />
            <Stat label="Need attention" value={flags.AMBER + flags.RED} sub={`${flags.RED} critical · ${flags.AMBER} amber`} tone={flags.RED ? 'red' : 'amber'} onClick={() => nav('/fleet?f=ALERT')} />
          </div>
        </Section>

        {/* Quick actions */}
        <Section title="Quick actions">
          <div className="grid grid-cols-4 gap-2">
            {[
              { l: 'Scan Battery', i: ScanLine, to: '/scan', c: 'bg-primary-soft text-primary-600' },
              { l: 'My Passports', i: BookOpenCheck, to: '/passports', c: 'bg-teal-soft text-teal-700' },
              { l: 'Verify Passport', i: QrCode, to: '/verify', c: 'bg-[#F1EDFF] text-[#6D4AE6]' },
              { l: 'Fleet Overview', i: Truck, to: '/fleet', c: 'bg-warn-soft text-warn-ink' },
            ].map((q) => (
              <button key={q.l} onClick={() => nav(q.to)} className="tap flex flex-col items-center gap-2 rounded-2xl py-2 active:bg-subtle">
                <span className={cx('flex h-14 w-14 items-center justify-center rounded-2xl', q.c)}><q.i className="h-6 w-6" /></span>
                <span className="text-center text-[11.5px] font-medium leading-tight text-ink">{q.l}</span>
              </button>
            ))}
          </div>
        </Section>

        {/* Alerts */}
        {alerts.length > 0 && (
          <Section title="Safety alerts" info="sos" action={alerts.length > 2 ? <LinkAction onClick={() => nav('/notifications')}>All {alerts.length}</LinkAction> : undefined}>
            <div className="space-y-2.5">{alerts.slice(0, 2).map((a) => <AlertRow key={a.id} a={a} />)}</div>
          </Section>
        )}

        {/* Recent */}
        <Section title="Recent scans" action={<LinkAction onClick={() => nav('/diagnoses')}>See all</LinkAction>}>
          <Divided>{allScans.slice(0, 4).map((s) => <ScanRow key={s.id} s={s} />)}</Divided>
        </Section>

        {/* Distribution */}
        <Section title="Health distribution" info="soh">
          <Card className="p-4">
            <div className="flex items-end justify-between gap-3">
              {buckets.map((b) => (
                <div key={b.label} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="text-xs font-semibold text-ink">{b.count}</span>
                  <div className="flex h-24 w-full items-end rounded-lg bg-subtle">
                    <div className="w-full rounded-lg transition-all duration-700" style={{ height: `${Math.max(6, (b.count / maxB) * 100)}%`, background: b.count ? b.color : '#E2E8F0' }} />
                  </div>
                  <span className="text-[11px] font-medium text-muted">{b.label}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-center text-xs text-muted">Batteries by estimated State of Health (%)</p>
          </Card>
        </Section>
      </Page>
    </>
  )
}

function Stat({ label, value, sub, tone = 'slate', onClick, info }: { label: string; value: string | number; sub: string; tone?: 'slate' | 'green' | 'amber' | 'red' | 'blue'; onClick?: () => void; info?: boolean }) {
  const dot = { slate: 'bg-faint', green: 'bg-ok', amber: 'bg-warn', red: 'bg-crit', blue: 'bg-primary' }[tone]
  return (
    <Card onClick={onClick} className="p-3.5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-muted"><span className={cx('h-2 w-2 rounded-full', dot)} />{label}</span>
        {info && <span onClick={(e) => e.stopPropagation()}><InfoButton k="soh" /></span>}
      </div>
      <div className="mt-2 text-[26px] font-bold leading-none tracking-tight text-ink tabular-nums">{value}</div>
      <div className="mt-1.5 truncate text-[12px] text-muted">{sub}</div>
    </Card>
  )
}
