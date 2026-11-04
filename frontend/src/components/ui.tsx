import { clsx } from 'clsx'
import { ChevronLeft, ChevronRight, Info, X } from 'lucide-react'
import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { create } from 'zustand'
import type { SafetyFlag } from '../types'
import { FLAG_META } from '../lib/format'
import { GLOSSARY, type GlossaryKey } from '../data/glossary'
import { useApp } from '../store/app'

export const cx = clsx

// ---------- layout ----------
export function Page({ children, className, noTabs }: { children: ReactNode; className?: string; noTabs?: boolean }) {
  const guide = useApp((s) => s.tourActive && !s.tourMinimised)
  return (
    <main className={cx('mx-auto w-full max-w-[480px] px-4', noTabs ? 'pb-safe-8' : 'pb-tabbar', className)} style={guide ? { paddingBottom: 'calc(var(--tabbar-h) + var(--sab) + 170px)' } : undefined}>
      {children}
    </main>
  )
}

export function TopBar({ title, subtitle, back, right, large, onBack, transparent }: {
  title?: ReactNode
  subtitle?: ReactNode
  back?: boolean | string
  right?: ReactNode
  large?: boolean
  onBack?: () => void
  transparent?: boolean
}) {
  const nav = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 4)
    f()
    window.addEventListener('scroll', f, { passive: true })
    return () => window.removeEventListener('scroll', f)
  }, [])
  const goBack = () => {
    if (onBack) return onBack()
    if (typeof back === 'string') return nav(back)
    if (window.history.length > 1) nav(-1)
    else nav('/')
  }
  return (
    <header className={cx('sticky top-0 z-30 pt-safe transition-colors', transparent && !scrolled ? 'bg-transparent' : 'bg-bg/90 backdrop-blur-md', scrolled && !transparent && 'border-b border-line/70')}>
      <div className="mx-auto flex h-14 max-w-[480px] items-center gap-1 px-2">
        {back ? (
          <button onClick={goBack} aria-label="Back" className="tap flex h-11 w-11 items-center justify-center rounded-full text-ink active:bg-subtle">
            <ChevronLeft className="h-6 w-6" />
          </button>
        ) : (
          <div className="w-2" />
        )}
        <div className="min-w-0 flex-1">
          {!large && title && <h1 className="truncate text-[17px] font-semibold text-ink">{title}</h1>}
          {!large && subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-1 pr-1">{right}</div>
      </div>
      {large && (
        <div className="mx-auto max-w-[480px] px-4 pb-3">
          <h1 className="text-[28px] font-bold leading-tight tracking-tight text-ink">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
      )}
    </header>
  )
}

export function Card({ children, className, onClick, as = 'div' }: { children: ReactNode; className?: string; onClick?: () => void; as?: 'div' | 'button' }) {
  const C = onClick ? 'button' : as
  return (
    <C onClick={onClick} className={cx('block w-full rounded-2xl border border-line/80 bg-card text-left shadow-card', onClick && 'tap transition active:scale-[0.99] active:bg-subtle/60', className)}>
      {children}
    </C>
  )
}

export function Section({ title, action, children, className, info }: { title: ReactNode; action?: ReactNode; children: ReactNode; className?: string; info?: GlossaryKey }) {
  return (
    <section className={cx('mt-6', className)}>
      <div className="mb-3 flex items-center justify-between gap-2 px-0.5">
        <h2 className="flex items-center gap-1.5 text-[15px] font-semibold text-ink">
          {title}
          {info && <InfoButton k={info} />}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export function LinkAction({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="tap -mr-2 flex h-9 items-center gap-0.5 rounded-full px-2 text-sm font-medium text-primary-600 active:bg-primary-soft">
      {children}
      <ChevronRight className="h-4 w-4" />
    </button>
  )
}

// ---------- buttons ----------
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'soft' | 'ghost' | 'danger' | 'teal' | 'dark'
  size?: 'md' | 'lg' | 'sm'
  icon?: ReactNode
  full?: boolean
}
export function Button({ variant = 'primary', size = 'md', icon, full, className, children, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      className={cx(
        'tap inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl [&>svg]:shrink-0 font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
        size === 'lg' && 'h-[52px] px-5 text-[15px]',
        size === 'md' && 'h-12 px-4 text-[15px]',
        size === 'sm' && 'h-10 px-3.5 text-sm',
        variant === 'primary' && 'bg-primary text-white shadow-[0_6px_16px_-6px_rgba(59,130,246,.6)] active:bg-primary-600',
        variant === 'teal' && 'bg-teal text-white shadow-[0_6px_16px_-6px_rgba(20,184,166,.6)] active:bg-teal-600',
        variant === 'secondary' && 'border border-line bg-card text-ink active:bg-subtle',
        variant === 'soft' && 'bg-primary-soft text-primary-700 active:bg-[#dbeafe]',
        variant === 'ghost' && 'text-primary-600 active:bg-primary-soft',
        variant === 'danger' && 'bg-crit-soft text-crit-ink active:bg-[#fee2e2]',
        variant === 'dark' && 'bg-ink text-white active:bg-[#0f1f3a]',
        full && 'w-full',
        className,
      )}
    >
      {icon}
      {children}
    </button>
  )
}

export function IconButton({ children, label, onClick, badge, className }: { children: ReactNode; label: string; onClick?: () => void; badge?: number; className?: string }) {
  return (
    <button aria-label={label} onClick={onClick} className={cx('tap relative flex h-11 w-11 items-center justify-center rounded-full text-ink active:bg-subtle', className)}>
      {children}
      {!!badge && (
        <span className="absolute right-1.5 top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-crit px-1 text-[10px] font-bold text-white ring-2 ring-bg">{badge}</span>
      )}
    </button>
  )
}

// ---------- status ----------
export function StatusPill({ flag, size = 'md', label }: { flag: SafetyFlag; size?: 'sm' | 'md'; label?: string }) {
  const m = FLAG_META[flag]
  return (
    <span className={cx('inline-flex shrink-0 items-center gap-1.5 rounded-full font-semibold', m.bg, m.text, size === 'sm' ? 'h-6 px-2 text-[11px]' : 'h-7 px-2.5 text-xs')}>
      <span className={cx('h-1.5 w-1.5 rounded-full', m.dot)} />
      {label ?? m.label}
    </span>
  )
}

export function Badge({ children, tone = 'slate', className }: { children: ReactNode; tone?: 'slate' | 'blue' | 'teal' | 'amber' | 'red' | 'green'; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-semibold',
        tone === 'slate' && 'bg-subtle text-muted',
        tone === 'blue' && 'bg-primary-soft text-primary-700',
        tone === 'teal' && 'bg-teal-soft text-teal-700',
        tone === 'amber' && 'bg-warn-soft text-warn-ink',
        tone === 'red' && 'bg-crit-soft text-crit-ink',
        tone === 'green' && 'bg-ok-soft text-ok-ink',
        className,
      )}
    >
      {children}
    </span>
  )
}

export function DemoBadge() {
  return <Badge tone="amber">Demo data</Badge>
}

// ---------- sheet ----------
export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', k)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', k)
      document.body.style.overflow = prev
    }
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 animate-fade bg-ink/35" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-h-[88dvh] max-w-[480px] animate-sheet-up overflow-hidden rounded-t-3xl bg-card shadow-lift">
        <div className="flex justify-center pt-2.5"><div className="h-1.5 w-10 rounded-full bg-line" /></div>
        <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-3">
          <div className="min-w-0 flex-1 text-[17px] font-semibold text-ink">{title}</div>
          <button onClick={onClose} aria-label="Close" className="tap -mr-2 -mt-1 flex h-10 w-10 items-center justify-center rounded-full text-muted active:bg-subtle"><X className="h-5 w-5" /></button>
        </div>
        <div className="max-h-[calc(88dvh-120px)] overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
        {footer && <div className="border-t border-line px-5 pb-safe-4 pt-3">{footer}</div>}
        {!footer && <div className="pb-safe-4" />}
      </div>
    </div>,
    document.body,
  )
}

// ---------- info / glossary ----------
export function InfoButton({ k, className }: { k: GlossaryKey; className?: string }) {
  const [open, setOpen] = useState(false)
  const nav = useNavigate()
  const g = GLOSSARY[k]
  return (
    <>
      <button
        aria-label={`What is ${g.title}?`}
        onClick={(e) => { e.stopPropagation(); setOpen(true) }}
        className={cx('tap -m-2 inline-flex h-8 w-8 items-center justify-center rounded-full text-faint active:bg-subtle active:text-primary', className)}
      >
        <Info className="h-4 w-4" />
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={g.title}
        footer={g.learn ? <Button variant="soft" full onClick={() => { setOpen(false); nav(`/learn/${g.learn}`) }}>Learn more</Button> : undefined}
      >
        <p className="text-[15px] leading-relaxed text-ink">{g.text}</p>
        {g.why && (
          <div className="mt-4 rounded-xl bg-subtle p-3.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Why it matters</p>
            <p className="mt-1 text-sm leading-relaxed text-ink">{g.why}</p>
          </div>
        )}
      </Sheet>
    </>
  )
}

// ---------- form controls ----------
export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; className?: string }) {
  return (
    <div className={cx('flex rounded-xl bg-subtle p-1', className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx('tap flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 truncate rounded-[10px] px-2 text-sm font-semibold transition', value === o.value ? 'bg-card text-ink shadow-card' : 'text-muted')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx('tap relative h-7 w-12 shrink-0 rounded-full transition', checked ? 'bg-primary' : 'bg-[#CBD5E1]')}
    >
      <span className={cx('absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
    </button>
  )
}

export function ListRow({ icon, title, subtitle, right, onClick, tone = 'blue', chevron = true }: {
  icon?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  right?: ReactNode
  onClick?: () => void
  tone?: 'blue' | 'teal' | 'amber' | 'red' | 'slate' | 'green'
  chevron?: boolean
}) {
  const C = onClick ? 'button' : 'div'
  return (
    <C onClick={onClick} className={cx('flex min-h-[60px] w-full items-center gap-3 px-4 py-3 text-left', onClick && 'tap active:bg-subtle/70')}>
      {icon && <IconTile tone={tone}>{icon}</IconTile>}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-medium text-ink">{title}</div>
        {subtitle && <div className="mt-0.5 truncate text-[13px] text-muted">{subtitle}</div>}
      </div>
      {right}
      {onClick && chevron && <ChevronRight className="h-5 w-5 shrink-0 text-faint" />}
    </C>
  )
}

export function IconTile({ children, tone = 'blue', size = 'md' }: { children: ReactNode; tone?: 'blue' | 'teal' | 'amber' | 'red' | 'slate' | 'green'; size?: 'md' | 'lg' }) {
  return (
    <span
      className={cx(
        'flex shrink-0 items-center justify-center rounded-xl [&>svg]:h-5 [&>svg]:w-5',
        size === 'md' ? 'h-10 w-10' : 'h-12 w-12 [&>svg]:h-6 [&>svg]:w-6',
        tone === 'blue' && 'bg-primary-soft text-primary-600',
        tone === 'teal' && 'bg-teal-soft text-teal-700',
        tone === 'amber' && 'bg-warn-soft text-warn-ink',
        tone === 'red' && 'bg-crit-soft text-crit-ink',
        tone === 'green' && 'bg-ok-soft text-ok-ink',
        tone === 'slate' && 'bg-subtle text-muted',
      )}
    >
      {children}
    </span>
  )
}

export function Divided({ children }: { children: ReactNode }) {
  return <Card className="divide-y divide-line/80 overflow-hidden">{children}</Card>
}

export function KV({ label, value, info, mono }: { label: ReactNode; value: ReactNode; info?: GlossaryKey; mono?: boolean }) {
  return (
    <div className="flex min-h-[48px] items-center justify-between gap-3 px-4 py-2.5">
      <span className="flex items-center gap-1 text-sm text-muted">
        {label}
        {info && <InfoButton k={info} />}
      </span>
      <span className={cx('text-right text-sm font-semibold text-ink', mono && 'font-mono text-[13px]')}>{value}</span>
    </div>
  )
}

export function Empty({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <IconTile tone="slate" size="lg">{icon}</IconTile>
      <p className="mt-4 text-base font-semibold text-ink">{title}</p>
      <p className="mt-1 text-sm text-muted">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

// ---------- toast ----------
const useToastStore = create<{ msg: string | null; tone: 'ok' | 'err'; show: (m: string, tone?: 'ok' | 'err') => void }>((set) => ({
  msg: null,
  tone: 'ok',
  show: (msg, tone = 'ok') => {
    set({ msg, tone })
    window.clearTimeout((window as unknown as { __vtT?: number }).__vtT)
    ;(window as unknown as { __vtT?: number }).__vtT = window.setTimeout(() => set({ msg: null }), 2600)
  },
}))
export const toast = (m: string, tone?: 'ok' | 'err') => useToastStore.getState().show(m, tone)
export function Toaster() {
  const { msg, tone } = useToastStore()
  if (!msg) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex justify-center pt-safe">
      <div className={cx('mt-3 max-w-[90%] animate-fade-up rounded-full px-4 py-2.5 text-sm font-medium text-white shadow-lift', tone === 'ok' ? 'bg-ink' : 'bg-crit-ink')}>{msg}</div>
    </div>
  )
}
