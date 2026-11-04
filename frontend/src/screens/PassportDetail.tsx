import { AlertTriangle, BadgeCheck, Copy, Download, FileWarning, Link2, Loader2, Search, Share2, ShieldCheck, Smartphone } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Badge, Button, Card, Divided, Empty, InfoButton, KV, Page, Section, StatusPill, TopBar, IconButton, cx, toast } from '../components/ui'
import { LogoMark, Logotype, QRArt } from '../components/visuals'
import { useApp } from '../store/app'
import { METHODOLOGIES, USAGE_TEXT, verifySigned, verifyUrl, publicBase } from '../lib/passport'
import { passportPdf } from '../lib/pdf'
import { copyText, downloadBlob, shareLink } from '../lib/share'
import { FLAG_META, fmtDateTime, USAGE_META } from '../lib/format'
import type { SignedPassport } from '../types'

export async function downloadPassport(p: SignedPassport, base?: string) {
  const blob = await passportPdf(p, base)
  downloadBlob(blob, `Voltrace-Passport-${p.payload.pid}.pdf`)
}

export async function sharePassport(p: SignedPassport, base?: string) {
  const url = verifyUrl(p, base)
  const blob = await passportPdf(p, base).catch(() => undefined)
  const r = await shareLink({ title: `Battery Passport ${p.payload.pid}`, text: `Voltrace Battery Passport for ${p.payload.bid}: SoH ${p.payload.soh.v}%, safety ${p.payload.sos.f}. Verify:`, url, file: blob, filename: `Voltrace-Passport-${p.payload.pid}.pdf` })
  if (r === 'copied') toast('Verification link copied')
}

export default function PassportDetail() {
  const { pid } = useParams()
  const nav = useNavigate()
  const st = useApp()
  const p = pid ? st.passports[pid] : undefined
  const [busy, setBusy] = useState<string | null>(null)
  const base = st.settings.publicBaseUrl
  const check = useMemo(() => (p ? verifySigned(p) : null), [p])
  const scan = p?.scanId ? st.scans[p.scanId] : undefined
  const isTour = scan?.reading.profileId === 'faulty' && scan.id.startsWith('scan-u-')
  useEffect(() => { if (isTour) st.markTour('qr') }, [isTour]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!p)
    return (
      <>
        <TopBar title="Battery Passport" back />
        <Page><Empty icon={<Search />} title="Passport not found" text="It may have been removed by a demo reset." action={<Button onClick={() => nav('/passports')}>My passports</Button>} /></Page>
      </>
    )

  const P = p.payload
  const url = verifyUrl(p, base)
  const pb = publicBase(base)
  const localOnly = /localhost|127\.0\.0\.1|capacitor:|file:/.test(pb)
  const flag = FLAG_META[P.sos.f]

  const act = async (k: string, fn: () => Promise<unknown>) => {
    setBusy(k)
    try { await fn() } finally { setBusy(null) }
  }

  return (
    <>
      <TopBar title="Battery Passport" back right={<IconButton label="Share" onClick={() => act('share', () => sharePassport(p, base))}><Share2 className="h-5 w-5" /></IconButton>} />
      <Page>
        {/* Certificate */}
        <div className="relative overflow-hidden rounded-3xl border border-line bg-card shadow-lift">
          <div className="relative bg-gradient-to-br from-[#2563EB] via-[#3B82F6] to-[#14B8A6] px-5 pb-6 pt-5 text-white">
            <svg className="absolute inset-0 h-full w-full opacity-[0.12]" aria-hidden><defs><pattern id="gp" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M22 0H0V22" fill="none" stroke="#fff" strokeWidth="1" /></pattern></defs><rect width="100%" height="100%" fill="url(#gp)" /></svg>
            <div className="relative flex items-center justify-between">
              <span className="flex items-center gap-2.5"><LogoMark size={30} /><Logotype height={13} color="#FFFFFF" /></span>
              {check?.status === 'VERIFIED' ? (
                <span className="flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-semibold backdrop-blur"><BadgeCheck className="h-3.5 w-3.5" />Signature valid</span>
              ) : (
                <span className="rounded-full bg-crit px-2.5 py-1 text-[11px] font-semibold">Invalid</span>
              )}
            </div>
            <p className="relative mt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/75">Digital Battery Passport</p>
            <p className="relative mt-1 text-[26px] font-bold leading-tight tracking-tight">{P.bid}</p>
            <p className="relative mt-0.5 text-[13px] text-white/80">{P.bat.cat} · {P.bat.veh}</p>
          </div>
          {P.demo && <div className="flex items-center justify-center gap-1.5 bg-warn-soft py-2 text-[12px] font-semibold text-warn-ink"><FileWarning className="h-3.5 w-3.5" />Demonstration passport · simulated data</div>}

          <div className="grid grid-cols-2 gap-px bg-line">
            <div className="bg-card p-4">
              <p className="flex items-center gap-0.5 text-xs text-muted">State of Health<InfoButton k="soh" /></p>
              <p className="text-[28px] font-bold leading-none tracking-tight text-ink">{P.soh.v.toFixed(0)}<span className="text-base">%</span></p>
              <p className="mt-1 text-xs text-muted">90% range {P.soh.lo.toFixed(0)}–{P.soh.hi.toFixed(0)}%</p>
            </div>
            <div className="bg-card p-4">
              <p className="flex items-center gap-0.5 text-xs text-muted">State of Safety<InfoButton k="sos" /></p>
              <div className="mt-1"><StatusPill flag={P.sos.f} label={flag.short} /></div>
              <p className="mt-1.5 text-xs text-muted">{P.sos.c ? `Suspect cell ${P.sos.c}` : 'No suspect cell'}</p>
            </div>
          </div>

          <div className="flex flex-col items-center border-t border-dashed border-line px-5 pb-5 pt-5">
            <div className="rounded-2xl bg-white p-2 shadow-card ring-1 ring-line"><QRArt value={url} size={232} /></div>
            <p className="mt-3 flex items-center gap-1.5 text-[13px] font-medium text-ink"><Smartphone className="h-4 w-4 text-primary" />Scan with any phone camera to verify</p>
            <p className="mt-1 font-mono text-[12px] tracking-wide text-muted">{P.pid}</p>
            {localOnly && (
              <button onClick={() => nav('/settings')} className="tap mt-3 flex items-start gap-2 rounded-xl bg-warn-soft p-3 text-left text-[12px] leading-snug text-warn-ink">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                This QR points to {pb.replace(/\/$/, '')}, which other phones cannot open. Tap to set a public app URL in Settings.
              </button>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-line bg-subtle/60 px-4 py-3">
            <span className="text-xs text-muted">Recommended use</span>
            <span className="text-[13px] font-semibold text-ink">{USAGE_META[P.use].label}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <Button variant="primary" disabled={busy === 'pdf'} onClick={() => act('pdf', () => downloadPassport(p, base).then(() => toast('PDF downloaded')))} icon={busy === 'pdf' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}>Download PDF</Button>
          <Button variant="secondary" disabled={busy === 'share'} onClick={() => act('share', () => sharePassport(p, base))} icon={<Share2 className="h-5 w-5 text-primary" />}>Share</Button>
          <Button variant="secondary" onClick={async () => { await copyText(url); toast('Verification link copied') }} icon={<Link2 className="h-5 w-5 text-primary" />}>Copy link</Button>
          <Button variant="teal" onClick={() => nav(`/v/${url.split('#/v/')[1]}`)} icon={<ShieldCheck className="h-5 w-5" />}>Verify</Button>
        </div>
        <button onClick={() => nav(`/tamper/${P.pid}`)} className="tap mt-2.5 flex w-full items-center gap-3 rounded-2xl border border-crit-line bg-crit-soft/60 p-3.5 text-left active:scale-[0.99]">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-crit"><FileWarning className="h-5 w-5" /></span>
          <span className="flex-1"><span className="block text-sm font-semibold text-ink">Tamper test</span><span className="block text-xs text-muted">Edit this record and watch verification fail</span></span>
        </button>

        <Section title="Battery specifications">
          <Divided>
            <KV label="Battery ID" value={P.bid} />
            <KV label="Passport ID" value={P.pid} mono />
            <KV label="Chemistry" value={`${P.bat.chem} · ${P.bat.cfg}`} />
            <KV label="Nominal voltage" value={`${P.bat.vn} V`} info="nominal" />
            <KV label="Rated capacity" value={`${P.bat.ah} Ah`} info="rated" />
            <KV label="Cycle count" value={P.bat.cyc} info="cycles" />
          </Divided>
        </Section>

        <Section title="Health & safety">
          <Divided>
            <KV label="State of Health" value={`${P.soh.v}%`} info="soh" />
            <KV label="Confidence interval" value={`${P.soh.lo}–${P.soh.hi}%`} info="confidence" />
            <KV label="Safety status" value={<StatusPill flag={P.sos.f} size="sm" />} info="sos" />
            <KV label="Finding" value={<span className="block max-w-[190px]">{P.sos.n}</span>} />
            <KV label="Cell summary" value={`${P.cells.n} cells · spread ${P.cells.spr} mV`} info="spread" />
            <KV label="Min / max cell" value={`${(P.cells.min / 1000).toFixed(3)} / ${(P.cells.max / 1000).toFixed(3)} V`} />
            <KV label="Recommended usage" value={<span className="block max-w-[190px]">{USAGE_TEXT[P.use]}</span>} />
          </Divided>
        </Section>

        <Section title="Provenance & verification">
          <Divided>
            <KV label="Issued" value={fmtDateTime(P.iat)} />
            <KV label="Issuer" value={<span className="block max-w-[190px]">{P.iss}</span>} />
            <KV label="Key ID" value={P.kid} mono info="signature" />
            <KV label="Data source" value={P.src} mono />
            <KV label="Verification" value={check?.status === 'VERIFIED' ? <Badge tone="green"><BadgeCheck className="h-3 w-3" />Verified</Badge> : <Badge tone="red">Invalid</Badge>} />
            <button onClick={async () => { await copyText(p.hash); toast('SHA-256 copied') }} className="tap flex w-full items-center justify-between gap-3 px-4 py-3 text-left active:bg-subtle">
              <span className="flex items-center gap-1 text-sm text-muted">SHA-256<InfoButton k="sha256" /></span>
              <span className="flex items-center gap-1.5 font-mono text-[12px] text-ink">{p.hash.slice(0, 10)}…{p.hash.slice(-6)}<Copy className="h-3.5 w-3.5 text-faint" /></span>
            </button>
          </Divided>
          <Card className="mt-3 p-4">
            <p className="text-sm font-semibold text-ink">Diagnostic methodology</p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">{METHODOLOGIES[P.meth] ?? P.meth}</p>
            <p className={cx('mt-3 text-[12px] leading-relaxed', p.signer === 'server' ? 'text-muted' : 'text-warn-ink')}>
              {p.signer === 'server' ? 'Signed by the Voltrace server. The private signing key never leaves the backend.' : 'Signed offline with Voltrace’s publicly-known demonstration key because the signing server was unreachable. Integrity can be verified, but this is not production-grade trust.'}
            </p>
          </Card>
          {scan && <Button variant="ghost" full className="mt-2" onClick={() => nav(`/battery/${scan.id}/diagnosis`)}>Open full diagnosis</Button>}
        </Section>
      </Page>
    </>
  )
}
