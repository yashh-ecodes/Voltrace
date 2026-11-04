import { BadgeCheck, CheckCircle2, FileWarning, HelpCircle, Home, Info, Loader2, ShieldCheck, ShieldX, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Card, Divided, KV, StatusPill, cx } from '../components/ui'
import { Wordmark } from '../components/visuals'
import { decodeToken, refreshKeys, trustedKeys, verifySigned } from '../lib/passport'
import { api } from '../lib/api'
import { useApp } from '../store/app'
import { fmtDateTime, USAGE_META } from '../lib/format'
import type { VerifyResult as VR } from '../types'

export default function VerifyResult() {
  const { token, pid } = useParams()
  const nav = useNavigate()
  const st = useApp()
  const [res, setRes] = useState<VR | null>(null)
  const [hasLocal, setHasLocal] = useState(false)

  useEffect(() => {
    let alive = true
    const run = async () => {
      await new Promise((r) => setTimeout(r, 450)) // let the user see the check happen
      if (token) {
        const d = decodeToken(token)
        if (!d) return alive && setRes({ status: 'UNAVAILABLE', reason: 'This QR code could not be decoded as a Voltrace passport.' })
        // first visit on a new phone: fetch the issuer's published public keys if this one is unknown
        if (!trustedKeys().some((k) => k.kid === d.payload.kid)) await Promise.race([refreshKeys(), new Promise((r) => setTimeout(r, 4000))])
        const r = verifySigned(d)
        setHasLocal(!!useApp.getState().passports[d.payload.pid])
        return alive && setRes(r)
      }
      if (pid) {
        await Promise.race([refreshKeys(), new Promise((r) => setTimeout(r, 4000))])
        const local = useApp.getState().passports[pid]
        if (local) { setHasLocal(true); return alive && setRes(verifySigned(local)) }
        const remote = await api.getPassport(pid)
        if (remote) return alive && setRes(verifySigned(remote))
        return alive && setRes({ status: 'UNAVAILABLE', reason: `No passport with ID ${pid} was found on this device or the Voltrace server.` })
      }
    }
    setRes(null)
    run()
    return () => { alive = false }
  }, [token, pid])

  useEffect(() => {
    if (res?.status === 'VERIFIED' && res.payload) {
      const p = st.passports[res.payload.pid]
      const scan = p?.scanId ? st.scans[p.scanId] : undefined
      if (scan?.reading.profileId === 'faulty' && scan.id.startsWith('scan-u-')) st.markTour('verify')
    }
  }, [res]) // eslint-disable-line react-hooks/exhaustive-deps

  const P = res?.payload
  const S = res?.status
  const hero = S === 'VERIFIED'
    ? { icon: <ShieldCheck className="h-10 w-10" />, bg: 'bg-teal', soft: 'from-teal-soft', title: 'VERIFIED', text: 'The digital signature is valid.' }
    : S === 'INVALID'
      ? { icon: <ShieldX className="h-10 w-10" />, bg: 'bg-crit', soft: 'from-crit-soft', title: 'INVALID', text: 'The passport signature does not match the record.' }
      : { icon: <HelpCircle className="h-10 w-10" />, bg: 'bg-faint', soft: 'from-subtle', title: 'UNAVAILABLE', text: 'The passport cannot be found or verified.' }

  return (
    <div className={cx('min-h-[100dvh] bg-gradient-to-b to-bg to-40%', res ? hero.soft : 'from-primary-soft')}>
      <header className="pt-safe">
        <div className="mx-auto flex h-14 max-w-[480px] items-center justify-between px-4">
          <Wordmark />
          <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-muted ring-1 ring-line">Passport verification</span>
        </div>
      </header>
      <main className="mx-auto max-w-[480px] px-4 pb-safe-8">
        {!res ? (
          <div className="flex flex-col items-center py-20 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="mt-4 font-semibold text-ink">Checking signature…</p>
            <p className="mt-1 text-sm text-muted">SHA-256 fingerprint · Ed25519 signature</p>
          </div>
        ) : (
          <>
            <div className="flex animate-fade-up flex-col items-center pb-2 pt-6 text-center">
              <span className={cx('flex h-20 w-20 items-center justify-center rounded-full text-white shadow-lift', hero.bg)}>{hero.icon}</span>
              <p className={cx('mt-4 text-[26px] font-extrabold tracking-wide', S === 'VERIFIED' ? 'text-teal-700' : S === 'INVALID' ? 'text-crit-ink' : 'text-muted')}>{hero.title}</p>
              <p className="mt-1 text-[15px] font-medium text-ink">{hero.text}</p>
              <p className="mt-1 max-w-[320px] text-[13px] leading-relaxed text-muted">{res.reason}</p>
            </div>

            {res.demoKey && S === 'VERIFIED' && (
              <div className="mt-3 flex gap-2 rounded-xl border border-warn-line bg-white p-3 text-[12.5px] leading-relaxed text-warn-ink">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />Signed with Voltrace’s offline demonstration key. The record is intact, but this key is public and is not used for production trust.
              </div>
            )}
            {P?.demo && (
              <div className="mt-2 flex items-center gap-2 rounded-xl bg-warn-soft p-3 text-[12.5px] font-medium text-warn-ink"><FileWarning className="h-4 w-4 shrink-0" />Demonstration passport generated from simulated battery data.</div>
            )}

            {P && (
              <>
                <Card className="mt-4 p-1">
                  <div className="space-y-0.5 px-3 py-2">
                    {[
                      { ok: true, t: 'Record decoded' },
                      { ok: !!res.issuer, t: `Issuer key trusted${res.issuer ? ` · ${res.issuer}` : ''}` },
                      { ok: res.computedHash === res.claimedHash, t: 'SHA-256 fingerprint matches' },
                      { ok: S === 'VERIFIED', t: 'Ed25519 signature valid' },
                    ].map((c) => (
                      <p key={c.t} className="flex items-center gap-2 py-1.5 text-[13.5px] text-ink">
                        {c.ok ? <CheckCircle2 className="h-[18px] w-[18px] shrink-0 text-teal" /> : <XCircle className="h-[18px] w-[18px] shrink-0 text-crit" />}{c.t}
                      </p>
                    ))}
                  </div>
                </Card>
                <h2 className="mb-3 mt-6 text-[15px] font-semibold text-ink">Battery record</h2>
                <Divided>
                  <KV label="Passport ID" value={P.pid} mono />
                  <KV label="Battery ID" value={P.bid} />
                  <KV label="Battery" value={<span className="block max-w-[200px]">{P.bat.cat} · {P.bat.chem} {P.bat.cfg}</span>} />
                  <KV label="Issue date" value={fmtDateTime(P.iat)} />
                  <KV label="Health summary" value={`${P.soh.v}% SoH (${P.soh.lo}–${P.soh.hi}%)`} info="soh" />
                  <KV label="Safety status" value={<StatusPill flag={P.sos.f} size="sm" label={`${P.sos.f}${P.sos.c ? ` · cell ${P.sos.c}` : ''}`} />} info="sos" />
                  <KV label="Recommended use" value={USAGE_META[P.use]?.label ?? P.use} />
                  <KV label="Issuing platform" value={<span className="block max-w-[200px]">{P.iss}</span>} />
                  <KV label="Verification result" value={<span className={cx('font-bold', S === 'VERIFIED' ? 'text-teal-700' : 'text-crit-ink')}>{S}</span>} />
                </Divided>
                {res.computedHash && (
                  <Card className="mt-3 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">SHA-256 of this record</p>
                    <p className="mt-1 break-all font-mono text-[11.5px] leading-relaxed text-ink">{res.computedHash}</p>
                    {res.claimedHash && res.claimedHash !== res.computedHash && (
                      <>
                        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-crit-ink">Fingerprint that was signed</p>
                        <p className="mt-1 break-all font-mono text-[11.5px] leading-relaxed text-crit-ink">{res.claimedHash}</p>
                      </>
                    )}
                  </Card>
                )}
              </>
            )}

            <div className="mt-6 space-y-2">
              {P && hasLocal && S === 'VERIFIED' && <Button full variant="secondary" onClick={() => nav(`/tamper/${P.pid}`)} icon={<FileWarning className="h-5 w-5 text-crit" />}>Run tamper test</Button>}
              {P && hasLocal && <Button full variant="secondary" onClick={() => nav(`/passport/${P.pid}`)} icon={<BadgeCheck className="h-5 w-5 text-primary" />}>Open passport</Button>}
              <Button full variant={hasLocal ? 'ghost' : 'primary'} onClick={() => nav('/')} icon={<Home className="h-5 w-5" />}>{hasLocal ? 'Home' : 'Open Voltrace'}</Button>
            </div>
            <p className="mt-6 text-center text-[11.5px] leading-relaxed text-muted">Verification runs entirely on this device using Voltrace’s published public keys. Voltrace is a prototype screening tool; a passport is not a certified safety assessment.</p>
          </>
        )}
      </main>
    </div>
  )
}
