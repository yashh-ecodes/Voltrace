import { CheckCircle2, Minus, Plus, QrCode, RotateCcw, ShieldCheck, ShieldX, Wand2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Card, Empty, Page, Section, Segmented, Sheet, TopBar, cx } from '../components/ui'
import { QRArt } from '../components/visuals'
import { useApp } from '../store/app'
import { sha256Hex, verifySigned, verifyUrl } from '../lib/passport'
import type { PassportPayload, SafetyFlag, UsageCategory } from '../types'
import { USAGE_META } from '../lib/format'

export default function Tamper() {
  const { pid } = useParams()
  const nav = useNavigate()
  const st = useApp()
  const p = pid ? st.passports[pid] : undefined
  const [edit, setEdit] = useState<PassportPayload | null>(p ? structuredClone(p.payload) : null)
  const [qrOpen, setQrOpen] = useState(false)

  const result = useMemo(() => (p && edit ? verifySigned({ payload: edit, hash: p.hash, sig: p.sig }) : null), [p, edit])
  const changed = useMemo(() => {
    if (!p || !edit) return []
    const out: string[] = []
    if (edit.bid !== p.payload.bid) out.push(`Battery ID: ${p.payload.bid} → ${edit.bid}`)
    if (edit.soh.v !== p.payload.soh.v) out.push(`SoH: ${p.payload.soh.v}% → ${edit.soh.v}%`)
    if (edit.sos.f !== p.payload.sos.f) out.push(`Safety: ${p.payload.sos.f} → ${edit.sos.f}`)
    if (edit.bat.cyc !== p.payload.bat.cyc) out.push(`Cycles: ${p.payload.bat.cyc} → ${edit.bat.cyc}`)
    if (edit.use !== p.payload.use) out.push(`Use: ${USAGE_META[p.payload.use].label} → ${USAGE_META[edit.use].label}`)
    return out
  }, [p, edit])

  const scan = p?.scanId ? st.scans[p.scanId] : undefined
  useEffect(() => {
    if (result?.status === 'INVALID' && scan?.reading.profileId === 'faulty' && scan.id.startsWith('scan-u-')) st.markTour('tamper')
  }, [result?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!p || !edit || !result)
    return (
      <>
        <TopBar title="Tamper test" back />
        <Page><Empty icon={<ShieldX />} title="Passport not found" text="Generate a passport first, then run the tamper test on it." action={<Button onClick={() => nav('/passports')}>My passports</Button>} /></Page>
      </>
    )

  const ok = result.status === 'VERIFIED'
  const set = (fn: (d: PassportPayload) => void) => setEdit((e) => { const n = structuredClone(e!); fn(n); return n })
  const computed = sha256Hex(edit)

  return (
    <>
      <TopBar title="Tamper test" subtitle={p.payload.pid} back />
      <Page className="!pb-[280px]">
        <p className="text-[15px] leading-relaxed text-muted">Play the fraudster. Change any value in this passport. Voltrace recomputes its SHA-256 fingerprint and checks it against the original Ed25519 signature.</p>

        <Card className="mt-4 p-4">
          <Field label="Battery ID">
            <input value={edit.bid} onChange={(e) => set((d) => { d.bid = e.target.value })} className="h-11 w-full rounded-xl border border-line bg-bg px-3 font-semibold outline-none focus:border-primary" />
          </Field>
          <Field label="State of Health (%)">
            <div className="flex items-center gap-2">
              <button aria-label="Decrease" onClick={() => set((d) => { d.soh.v = Math.max(0, Math.round((d.soh.v - 1) * 10) / 10) })} className="tap flex h-11 w-11 items-center justify-center rounded-xl bg-subtle"><Minus className="h-4 w-4" /></button>
              <span className="flex-1 text-center text-[22px] font-bold tabular-nums">{edit.soh.v.toFixed(1)}%</span>
              <button aria-label="Increase" onClick={() => set((d) => { d.soh.v = Math.min(100, Math.round((d.soh.v + 1) * 10) / 10) })} className="tap flex h-11 w-11 items-center justify-center rounded-xl bg-subtle"><Plus className="h-4 w-4" /></button>
            </div>
          </Field>
          <Field label="Safety status">
            <Segmented value={edit.sos.f} onChange={(v: SafetyFlag) => set((d) => { d.sos.f = v })} options={[{ value: 'GREEN', label: 'Green' }, { value: 'AMBER', label: 'Amber' }, { value: 'RED', label: 'Red' }]} />
          </Field>
          <Field label="Cycle count">
            <input inputMode="numeric" value={edit.bat.cyc} onChange={(e) => set((d) => { d.bat.cyc = Number(e.target.value.replace(/\D/g, '')) || 0 })} className="h-11 w-full rounded-xl border border-line bg-bg px-3 font-semibold outline-none focus:border-primary" />
          </Field>
          <Field label="Recommended use" last>
            <select value={edit.use} onChange={(e) => set((d) => { d.use = e.target.value as UsageCategory })} className="h-11 w-full rounded-xl border border-line bg-bg px-3 font-semibold outline-none focus:border-primary">
              {(['CONTINUE', 'INSPECT', 'SECOND_LIFE', 'RECYCLE'] as UsageCategory[]).map((u) => <option key={u} value={u}>{USAGE_META[u].label}</option>)}
            </select>
          </Field>
        </Card>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="danger" onClick={() => set((d) => { d.soh.v = 96.5; d.sos.f = 'GREEN'; d.sos.c = null; d.use = 'CONTINUE' })} icon={<Wand2 className="h-4 w-4" />}>Fake “healthy”</Button>
          <Button variant="secondary" onClick={() => setEdit(structuredClone(p.payload))} icon={<RotateCcw className="h-4 w-4" />}>Reset</Button>
        </div>

        <Section title="Fingerprints">
          <Card className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Signed fingerprint (original)</p>
            <Hash value={p.hash} />
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">Fingerprint of current record</p>
            <Hash value={computed} against={p.hash} />
            <p className="mt-3 text-[12.5px] leading-relaxed text-muted">{ok ? 'Identical — the record is exactly what Voltrace signed.' : 'Even a tiny edit produces a completely different fingerprint, so the signature no longer matches.'}</p>
          </Card>
        </Section>
        {changed.length > 0 && (
          <Section title="Your edits">
            <Card className="divide-y divide-line/80">
              {changed.map((c) => <p key={c} className="px-4 py-3 text-sm text-ink">{c}</p>)}
            </Card>
          </Section>
        )}
      </Page>

      {/* live result */}
      <div className="fixed inset-x-0 z-30 mx-auto max-w-[480px] px-4" style={{ bottom: 'calc(var(--tabbar-h) + var(--sab) + 12px)' }}>
        <div className={cx('rounded-2xl p-3.5 text-white shadow-lift transition-colors', ok ? 'bg-teal-700' : 'bg-crit-ink')}>
          <div className="flex items-center gap-3">
            {ok ? <ShieldCheck className="h-8 w-8 shrink-0" /> : <ShieldX className="h-8 w-8 shrink-0" />}
            <div className="min-w-0 flex-1">
              <p className="text-[17px] font-extrabold tracking-wide">{ok ? 'VERIFIED' : 'INVALID'}</p>
              <p className="text-[12.5px] leading-snug text-white/85">{ok ? 'Untouched record. Signature valid.' : 'Tampering detected. Signature does not match.'}</p>
            </div>
            {!ok && <button onClick={() => setQrOpen(true)} className="tap flex h-10 items-center gap-1.5 rounded-full bg-white px-3 text-[13px] font-semibold text-crit-ink"><QrCode className="h-4 w-4" />QR</button>}
          </div>
        </div>
      </div>

      <Sheet open={qrOpen} onClose={() => setQrOpen(false)} title="Tampered passport QR">
        <p className="text-sm leading-relaxed text-muted">This QR carries your edited record with the original signature. Scan it with another phone: the verification page will show <b className="text-crit-ink">INVALID</b>.</p>
        <div className="mt-4 flex justify-center rounded-2xl bg-crit-soft p-4"><QRArt value={verifyUrl({ payload: edit, hash: p.hash, sig: p.sig }, st.settings.publicBaseUrl)} size={220} tone="red" /></div>
        <Button full variant="secondary" className="mt-4" onClick={() => nav(`/v/${verifyUrl({ payload: edit, hash: p.hash, sig: p.sig }).split('#/v/')[1]}`)} icon={<CheckCircle2 className="h-4 w-4" />}>Open verification on this phone</Button>
      </Sheet>
    </>
  )
}

function Field({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={cx(!last && 'mb-4')}>
      <p className="mb-1.5 text-[13px] font-semibold text-muted">{label}</p>
      {children}
    </div>
  )
}

function Hash({ value, against }: { value: string; against?: string }) {
  return (
    <p className="mt-1 break-all font-mono text-[11.5px] leading-relaxed">
      {value.split('').map((c, i) => (
        <span key={i} className={against && against[i] !== c ? 'rounded-[2px] bg-crit-soft text-crit-ink' : 'text-ink'}>{c}</span>
      ))}
    </p>
  )
}
