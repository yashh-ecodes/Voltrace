import { ArrowUpDown, BadgeCheck, BookOpenCheck, Check, Download, Eye, MoreHorizontal, QrCode, Search, Share2, ShieldCheck, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Card, Empty, IconButton, Page, Sheet, StatusPill, TopBar, cx, toast } from '../components/ui'
import { SohRing } from '../components/visuals'
import { useApp } from '../store/app'
import { verifySigned } from '../lib/passport'
import { fmtDate, USAGE_META } from '../lib/format'
import type { SafetyFlag, SignedPassport } from '../types'
import { downloadPassport, sharePassport } from './PassportDetail'

type Filter = 'ALL' | SafetyFlag | 'DEMO'
type Sort = 'new' | 'old' | 'soh-asc' | 'soh-desc'
const SORTS: { v: Sort; l: string }[] = [
  { v: 'new', l: 'Newest first' },
  { v: 'old', l: 'Oldest first' },
  { v: 'soh-desc', l: 'Health: high to low' },
  { v: 'soh-asc', l: 'Health: low to high' },
]

export default function Passports() {
  const nav = useNavigate()
  const passports = useApp((s) => s.passports)
  const base = useApp((s) => s.settings.publicBaseUrl)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('ALL')
  const [sort, setSort] = useState<Sort>('new')
  const [sortOpen, setSortOpen] = useState(false)
  const [menu, setMenu] = useState<SignedPassport | null>(null)

  const list = useMemo(() => {
    const all = Object.values(passports).map((p) => ({ p, ok: verifySigned(p).status === 'VERIFIED' }))
    const needle = q.trim().toLowerCase()
    return all
      .filter(({ p }) => !needle || [p.payload.bid, p.payload.pid, p.payload.bat.veh, p.payload.bat.cat].some((x) => x.toLowerCase().includes(needle)))
      .filter(({ p }) => filter === 'ALL' || (filter === 'DEMO' ? p.payload.demo : p.payload.sos.f === filter))
      .sort((a, b) => {
        if (sort === 'new') return b.p.payload.iat.localeCompare(a.p.payload.iat)
        if (sort === 'old') return a.p.payload.iat.localeCompare(b.p.payload.iat)
        if (sort === 'soh-asc') return a.p.payload.soh.v - b.p.payload.soh.v
        return b.p.payload.soh.v - a.p.payload.soh.v
      })
  }, [passports, q, filter, sort])
  const total = Object.keys(passports).length

  return (
    <>
      <TopBar large title="Passports" subtitle={`${total} digital battery passport${total === 1 ? '' : 's'}`} right={<IconButton label="Verify a passport" onClick={() => nav('/verify')}><QrCode className="h-[22px] w-[22px]" /></IconButton>} />
      <Page>
        <Card onClick={() => nav('/verify')} className="flex items-center gap-3 border-0 bg-gradient-to-r from-[#F1EDFF] to-primary-soft p-3.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#6D4AE6]"><ShieldCheck className="h-5 w-5" /></span>
          <span className="flex-1"><span className="block text-sm font-semibold text-ink">Verify a passport</span><span className="block text-xs text-muted">Scan a QR, upload an image or enter a code</span></span>
        </Card>

        {total > 0 && (
          <>
            <div className="relative mt-4">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-faint" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search battery or passport ID" className="h-12 w-full rounded-xl border border-line bg-card pl-10 pr-10 text-[15px] outline-none placeholder:text-faint focus:border-primary" aria-label="Search passports" />
              {q && <button aria-label="Clear search" onClick={() => setQ('')} className="tap absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center text-faint"><X className="h-4 w-4" /></button>}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="-mx-4 flex flex-1 gap-2 overflow-x-auto px-4 no-scrollbar">
                {(['ALL', 'GREEN', 'AMBER', 'RED', 'DEMO'] as Filter[]).map((f) => (
                  <button key={f} onClick={() => setFilter(f)} className={cx('tap h-9 shrink-0 rounded-full px-3.5 text-[13px] font-semibold transition', filter === f ? 'bg-ink text-white' : 'bg-card text-muted ring-1 ring-line')}>
                    {f === 'ALL' ? 'All' : f === 'DEMO' ? 'Demo' : f === 'GREEN' ? 'Green' : f === 'AMBER' ? 'Attention' : 'Critical'}
                  </button>
                ))}
              </div>
              <button onClick={() => setSortOpen(true)} aria-label="Sort" className="tap flex h-9 shrink-0 items-center gap-1 rounded-full bg-card px-3 text-[13px] font-semibold text-ink ring-1 ring-line"><ArrowUpDown className="h-4 w-4" />Sort</button>
            </div>
          </>
        )}

        <div className="mt-4 space-y-3">
          {list.map(({ p, ok }) => (
            <Card key={p.payload.pid} className="overflow-hidden">
              <button onClick={() => nav(`/passport/${p.payload.pid}`)} className="tap flex w-full items-center gap-3 p-4 text-left active:bg-subtle/60">
                <SohRing value={p.payload.soh.v} size={52} stroke={6} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[16px] font-semibold text-ink">{p.payload.bid}</span>
                    {ok && <BadgeCheck className="h-4 w-4 shrink-0 text-teal" aria-label="Verified" />}
                  </div>
                  <p className="truncate font-mono text-[11.5px] text-muted">{p.payload.pid}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <StatusPill flag={p.payload.sos.f} size="sm" />
                    {p.payload.demo && <Badge tone="amber">Demo</Badge>}
                  </div>
                </div>
              </button>
              <div className="flex items-center justify-between border-t border-line/70 py-1 pl-4 pr-1">
                <span className="text-xs text-muted">{fmtDate(p.payload.iat)} · {USAGE_META[p.payload.use].label}</span>
                <IconButton label="Passport actions" onClick={() => setMenu(p)}><MoreHorizontal className="h-5 w-5 text-muted" /></IconButton>
              </div>
            </Card>
          ))}
        </div>

        {total === 0 && (
          <Empty icon={<BookOpenCheck />} title="No passports yet" text="Scan a battery, review its diagnosis and generate a signed Battery Passport." action={<Button onClick={() => nav('/scan')}>Scan a battery</Button>} />
        )}
        {total > 0 && list.length === 0 && <Empty icon={<Search />} title="No matches" text="Try another search or filter." />}
      </Page>

      <Sheet open={sortOpen} onClose={() => setSortOpen(false)} title="Sort passports">
        <div className="-mx-2">
          {SORTS.map((s) => (
            <button key={s.v} onClick={() => { setSort(s.v); setSortOpen(false) }} className="tap flex h-12 w-full items-center justify-between rounded-xl px-3 text-[15px] active:bg-subtle">
              {s.l}{sort === s.v && <Check className="h-5 w-5 text-primary" />}
            </button>
          ))}
        </div>
      </Sheet>
      <Sheet open={!!menu} onClose={() => setMenu(null)} title={menu?.payload.bid}>
        {menu && (
          <div className="-mx-2">
            {[
              { i: Eye, l: 'View passport', f: () => nav(`/passport/${menu.payload.pid}`) },
              { i: Download, l: 'Download PDF', f: () => downloadPassport(menu, base).then(() => toast('PDF downloaded')) },
              { i: Share2, l: 'Share', f: () => sharePassport(menu, base) },
              { i: ShieldCheck, l: 'Verify authenticity', f: () => nav(`/verify/id/${menu.payload.pid}`) },
            ].map((a) => (
              <button key={a.l} onClick={() => { setMenu(null); a.f() }} className="tap flex h-12 w-full items-center gap-3 rounded-xl px-3 text-[15px] text-ink active:bg-subtle">
                <a.i className="h-5 w-5 text-primary" />{a.l}
              </button>
            ))}
          </div>
        )}
      </Sheet>
    </>
  )
}
