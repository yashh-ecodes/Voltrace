import { BookOpenCheck, Home, Truck, User, ScanLine, X, ChevronUp, Check, ArrowRight, Sparkles } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { TOUR_STEPS, useApp } from '../store/app'
import { cx } from './ui'

const TABS = [
  { to: '/', label: 'Home', icon: Home, match: (p: string) => p === '/' },
  { to: '/passports', label: 'Passports', icon: BookOpenCheck, match: (p: string) => p.startsWith('/passport') || p.startsWith('/verify') || p.startsWith('/tamper') },
  { to: '/scan', label: 'Scan', icon: ScanLine, match: (p: string) => p.startsWith('/scan') },
  { to: '/fleet', label: 'Fleet', icon: Truck, match: (p: string) => p.startsWith('/fleet') },
  { to: '/profile', label: 'Profile', icon: User, match: (p: string) => ['/profile', '/settings', '/help', '/about', '/learn', '/analytics', '/model', '/notifications', '/demo', '/diagnoses'].some((x) => p.startsWith(x)) },
]

export function TabBar() {
  const { pathname } = useLocation()
  const nav = useNavigate()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[480px] border-t border-line/80 bg-white/95 backdrop-blur-md" style={{ paddingBottom: 'var(--sab)' }} aria-label="Primary">
      <div className="grid h-[68px] grid-cols-5 items-end px-1">
        {TABS.map((t) => {
          const active = t.match(pathname)
          const Icon = t.icon
          if (t.label === 'Scan')
            return (
              <button key={t.to} onClick={() => nav(t.to)} aria-label="Scan battery" className="tap relative flex h-full flex-col items-center justify-end pb-2">
                <span className={cx('absolute -top-5 flex h-[60px] w-[60px] items-center justify-center rounded-[20px] bg-gradient-to-br from-primary to-teal text-white shadow-fab ring-4 ring-white transition active:scale-95', active && 'scale-105')}>
                  <ScanLine className="h-7 w-7" strokeWidth={2.2} />
                </span>
                <span className={cx('text-[11px] font-semibold', active ? 'text-primary-600' : 'text-muted')}>Scan</span>
              </button>
            )
          return (
            <button key={t.to} onClick={() => nav(t.to)} aria-current={active ? 'page' : undefined} className="tap flex h-full flex-col items-center justify-center gap-1">
              <span className={cx('flex h-8 w-14 items-center justify-center rounded-full transition', active && 'bg-primary-soft')}>
                <Icon className={cx('h-[22px] w-[22px]', active ? 'text-primary-600' : 'text-muted')} strokeWidth={active ? 2.3 : 1.9} />
              </span>
              <span className={cx('text-[11px] font-semibold', active ? 'text-primary-600' : 'text-muted')}>{t.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

/** Floating judge guide. Steps complete automatically as the judge uses the app. */
export function TourGuide({ withTabs }: { withTabs: boolean }) {
  const st = useApp()
  const nav = useNavigate()
  const { pathname } = useLocation()
  if (!st.tourActive || pathname.startsWith('/scan/run') || pathname.startsWith('/scan/live') || pathname.startsWith('/verify/camera')) return null
  const idx = TOUR_STEPS.findIndex((s) => !st.tourDone.includes(s.id))
  const done = idx === -1
  const step = done ? null : TOUR_STEPS[idx]
  const progress = (st.tourDone.length / TOUR_STEPS.length) * 100

  const userFaulty = Object.values(st.scans).filter((s) => s.id.startsWith('scan-u-') && s.reading.profileId === 'faulty').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  const pid = userFaulty?.passportId
  const go = () => {
    if (!step) return
    switch (step.id) {
      case 'open': case 'home': nav('/'); st.markTour('home'); break
      case 'scan': case 'faulty': case 'start': case 'watch': nav('/scan'); break
      case 'diagnosis': case 'cell': case 'safety': if (userFaulty) nav(`/battery/${userFaulty.id}/diagnosis`); else nav('/scan'); break
      case 'advice': case 'passport': if (userFaulty) nav(`/battery/${userFaulty.id}/advice`); else nav('/scan'); break
      case 'qr': case 'phone': case 'verify': if (pid) nav(`/passport/${pid}`); else if (userFaulty) nav(`/battery/${userFaulty.id}/advice`); break
      case 'tamper': if (pid) nav(`/tamper/${pid}`); break
      case 'fleet': nav('/fleet'); break
    }
  }
  const pos = withTabs ? 'bottom-tabbar' : 'bottom-safe'
  // screens with their own sticky bottom action: stack a compact guide above it
  const ctaOffset = pathname === '/scan' ? 64 : pathname.startsWith('/tamper') ? 92 : 0
  const compact = ctaOffset > 0 || pathname.startsWith('/passport/')
  if (compact && !st.tourMinimised)
    return (
      <div className="fixed inset-x-0 z-40 mx-auto max-w-[480px] px-4" style={{ bottom: `calc(var(--tabbar-h) + var(--sab) + 12px + ${ctaOffset}px)` }}>
        <div className="flex h-12 animate-fade-up items-center gap-2.5 rounded-full bg-ink pl-2 pr-1 text-white shadow-lift">
          <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-white/10 px-1.5 text-[11px] font-bold">{done ? <Check className="h-4 w-4 text-teal" /> : `${idx + 1}/${TOUR_STEPS.length}`}</span>
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{done ? 'Demo complete' : step!.hint}</span>
          <button aria-label="Minimise guide" onClick={() => st.setTourMinimised(true)} className="tap flex h-10 w-10 items-center justify-center rounded-full text-white/70 active:bg-white/10"><X className="h-4 w-4" /></button>
        </div>
      </div>
    )

  if (st.tourMinimised)
    return (
      <button onClick={() => st.setTourMinimised(false)} className={cx('tap fixed right-4 z-40 flex h-11 items-center gap-2 rounded-full bg-ink pl-3 pr-4 text-sm font-semibold text-white shadow-lift', pos)}>
        <Sparkles className="h-4 w-4 text-teal" />
        Guide {Math.min(idx === -1 ? TOUR_STEPS.length : idx + 1, TOUR_STEPS.length)}/{TOUR_STEPS.length}
        <ChevronUp className="h-4 w-4" />
      </button>
    )

  return (
    <div className={cx('fixed inset-x-0 z-40 mx-auto max-w-[480px] px-3', pos)}>
      <div className="animate-fade-up overflow-hidden rounded-2xl bg-ink text-white shadow-lift">
        <div className="h-1 bg-white/10"><div className="h-1 bg-gradient-to-r from-primary to-teal transition-all duration-500" style={{ width: `${progress}%` }} /></div>
        <div className="flex items-start gap-3 p-3.5">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold">
            {done ? <Check className="h-4 w-4 text-teal" /> : `${idx + 1}/${TOUR_STEPS.length}`}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold leading-snug">{done ? 'Demo complete — thank you!' : step!.title}</p>
            <p className="mt-0.5 text-[13px] leading-snug text-white/70">{done ? 'You have seen the full flow from scan to verified passport. Reset the demo from Profile at any time.' : step!.hint}</p>
            <div className="mt-2.5 flex items-center gap-2">
              {!done && (
                <button onClick={go} className="tap flex h-9 items-center gap-1 rounded-full bg-white px-3.5 text-[13px] font-semibold text-ink active:scale-95">
                  Take me there <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
              {!done && (step!.id === 'phone' || step!.id === 'safety' || step!.id === 'open' || step!.id === 'home') && (
                <button onClick={() => st.markTour(step!.id)} className="tap h-9 rounded-full bg-white/10 px-3.5 text-[13px] font-semibold active:bg-white/20">
                  {step!.id === 'phone' ? 'Skip / done' : 'Next'}
                </button>
              )}
              {done && <button onClick={st.stopTour} className="tap h-9 rounded-full bg-white px-3.5 text-[13px] font-semibold text-ink">Close guide</button>}
            </div>
          </div>
          <div className="flex flex-col">
            <button aria-label="Minimise guide" onClick={() => st.setTourMinimised(true)} className="tap -mr-1 -mt-1 flex h-9 w-9 items-center justify-center rounded-full text-white/70 active:bg-white/10">
              <ChevronUp className="h-5 w-5 rotate-180" />
            </button>
            <button aria-label="Exit guide" onClick={st.stopTour} className="tap -mr-1 flex h-9 w-9 items-center justify-center rounded-full text-white/70 active:bg-white/10">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
