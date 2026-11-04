import { Camera, CameraOff, ImageUp, KeyRound, Loader2, ScanLine, ShieldCheck, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Page, Segmented, TopBar, cx, toast } from '../components/ui'
import { decodeCanvas, decodeFile, openCamera, type CameraState } from '../lib/qrscan'
import { parseVerificationInput } from '../lib/passport'
import { useApp } from '../store/app'

type Mode = 'camera' | 'upload' | 'code'

export default function Verify() {
  const [mode, setMode] = useState<Mode>('camera')
  const nav = useNavigate()
  const handle = (text: string) => {
    const r = parseVerificationInput(text)
    if (r.token) nav(`/v/${r.token}`)
    else if (r.pid) nav(`/verify/id/${r.pid}`)
    else toast('That does not look like a Voltrace passport QR or code', 'err')
  }
  return (
    <>
      <TopBar title="Verify passport" back />
      <Page>
        <p className="text-[15px] leading-relaxed text-muted">Check that a Battery Passport is genuine and unaltered. Verification runs on this phone using Voltrace’s public key.</p>
        <Segmented className="mt-4" value={mode} onChange={setMode} options={[
          { value: 'camera', label: <><Camera className="h-4 w-4" />Camera</> },
          { value: 'upload', label: <><ImageUp className="h-4 w-4" />Image</> },
          { value: 'code', label: <><KeyRound className="h-4 w-4" />Code</> },
        ]} />
        <div className="mt-4 animate-fade-up" key={mode}>
          {mode === 'camera' && <CameraScan onResult={handle} onFallback={setMode} />}
          {mode === 'upload' && <UploadScan onResult={handle} />}
          {mode === 'code' && <CodeEntry onSubmit={handle} />}
        </div>
      </Page>
    </>
  )
}

function CameraScan({ onResult, onFallback }: { onResult: (t: string) => void; onFallback: (m: Mode) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const [state, setState] = useState<CameraState>('idle')
  const [msg, setMsg] = useState('')
  const timer = useRef<number | null>(null)

  const stop = () => {
    if (timer.current) window.clearTimeout(timer.current)
    stream.current?.getTracks().forEach((t) => t.stop())
    stream.current = null
  }
  useEffect(() => stop, [])

  const start = async () => {
    setState('starting')
    const r = await openCamera(video.current!)
    if ('error' in r) { setState(r.error); setMsg(r.message); return }
    stream.current = r.stream
    setState('live')
    const tick = async () => {
      const v = video.current
      const c = canvas.current
      if (!v || !c || !stream.current) return
      if (v.videoWidth) {
        const side = Math.min(v.videoWidth, v.videoHeight)
        const s = Math.min(1, 900 / side)
        c.width = Math.round(side * s)
        c.height = Math.round(side * s)
        c.getContext('2d', { willReadFrequently: true })!.drawImage(v, (v.videoWidth - side) / 2, (v.videoHeight - side) / 2, side, side, 0, 0, c.width, c.height)
        const text = await decodeCanvas(c)
        if (text) {
          navigator.vibrate?.(40)
          stop()
          onResult(text)
          return
        }
      }
      timer.current = window.setTimeout(tick, 160)
    }
    tick()
  }

  return (
    <div>
      <div className="relative aspect-square w-full overflow-hidden rounded-3xl bg-[#0B1730]">
        <video ref={video} muted playsInline className={cx('h-full w-full object-cover', state !== 'live' && 'opacity-0')} />
        <canvas ref={canvas} className="hidden" />
        {state === 'live' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative h-[68%] w-[68%]">
              {['left-0 top-0 border-l-4 border-t-4 rounded-tl-2xl', 'right-0 top-0 border-r-4 border-t-4 rounded-tr-2xl', 'left-0 bottom-0 border-l-4 border-b-4 rounded-bl-2xl', 'right-0 bottom-0 border-r-4 border-b-4 rounded-br-2xl'].map((c) => <span key={c} className={cx('absolute h-10 w-10 border-white', c)} />)}
              <span className="absolute inset-x-3 top-0 h-0.5 animate-sweep bg-teal shadow-[0_0_12px_2px_rgba(20,184,166,.7)]" />
            </div>
            <p className="absolute bottom-4 rounded-full bg-black/40 px-3 py-1.5 text-xs font-medium text-white">Point at a Voltrace passport QR code</p>
          </div>
        )}
        {state !== 'live' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
              {state === 'starting' ? <Loader2 className="h-8 w-8 animate-spin" /> : ['denied', 'nocamera', 'unsupported', 'error'].includes(state) ? <CameraOff className="h-8 w-8" /> : <ScanLine className="h-8 w-8" />}
            </span>
            <p className="mt-4 text-[15px] font-semibold">{state === 'starting' ? 'Requesting camera…' : state === 'idle' ? 'Scan a passport QR code' : 'Camera unavailable'}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-white/70">{state === 'idle' ? 'Voltrace will ask for permission to use your camera. Images never leave your phone.' : msg}</p>
          </div>
        )}
        {state === 'live' && (
          <button aria-label="Stop camera" onClick={() => { stop(); setState('idle') }} className="tap absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white"><X className="h-5 w-5" /></button>
        )}
      </div>
      {state !== 'live' && (
        <Button size="lg" full className="mt-4" onClick={start} disabled={state === 'starting'} icon={<Camera className="h-5 w-5" />}>
          {state === 'idle' ? 'Open camera' : 'Try again'}
        </Button>
      )}
      {['denied', 'nocamera', 'unsupported', 'error'].includes(state) && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => onFallback('upload')} icon={<ImageUp className="h-4 w-4" />}>Upload image</Button>
          <Button variant="secondary" onClick={() => onFallback('code')} icon={<KeyRound className="h-4 w-4" />}>Enter code</Button>
        </div>
      )}
    </div>
  )
}

function UploadScan({ onResult }: { onResult: (t: string) => void }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const pick = async (f?: File) => {
    if (!f) return
    setBusy(true)
    setErr('')
    try {
      const t = await decodeFile(f)
      if (t) onResult(t)
      else setErr('No QR code was found in this image. Try a sharper, well-lit photo or a screenshot.')
    } catch {
      setErr('This image could not be read.')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }
  return (
    <div>
      <button onClick={() => input.current?.click()} className="tap flex w-full flex-col items-center rounded-3xl border-2 border-dashed border-line bg-card px-6 py-12 text-center active:bg-subtle">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary-600">{busy ? <Loader2 className="h-7 w-7 animate-spin" /> : <ImageUp className="h-7 w-7" />}</span>
        <span className="mt-3 text-[15px] font-semibold text-ink">{busy ? 'Reading QR code…' : 'Choose a photo or screenshot'}</span>
        <span className="mt-1 text-[13px] text-muted">PNG or JPG containing a Voltrace passport QR</span>
      </button>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      {err && <p className="mt-3 rounded-xl bg-warn-soft p-3 text-[13px] text-warn-ink">{err}</p>}
    </div>
  )
}

function CodeEntry({ onSubmit }: { onSubmit: (t: string) => void }) {
  const [v, setV] = useState('')
  const passports = useApp((s) => s.passports)
  const recent = Object.values(passports).sort((a, b) => b.payload.iat.localeCompare(a.payload.iat)).slice(0, 3)
  return (
    <div>
      <label htmlFor="code" className="text-sm font-semibold text-ink">Passport ID or verification link</label>
      <input id="code" value={v} onChange={(e) => setV(e.target.value)} placeholder="VTP-XXXX-XXXX" autoCapitalize="characters" className="mt-1.5 h-12 w-full rounded-xl border border-line bg-card px-3.5 font-mono text-[15px] uppercase tracking-wide outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-faint focus:border-primary" onKeyDown={(e) => e.key === 'Enter' && v && onSubmit(v)} />
      <Button size="lg" full className="mt-3" disabled={!v.trim()} onClick={() => onSubmit(v)} icon={<ShieldCheck className="h-5 w-5" />}>Verify</Button>
      <p className="mt-3 text-[12.5px] leading-relaxed text-muted">The Passport ID is printed under the QR code and on the PDF. Codes are looked up on this device first, then on the Voltrace server.</p>
      {recent.length > 0 && (
        <Card className="mt-5 divide-y divide-line/80">
          <p className="px-4 pb-2 pt-3 text-xs font-semibold uppercase tracking-wide text-muted">Your recent passports</p>
          {recent.map((p) => (
            <button key={p.payload.pid} onClick={() => setV(p.payload.pid)} className="tap flex h-12 w-full items-center justify-between px-4 text-left active:bg-subtle">
              <span className="font-mono text-sm text-ink">{p.payload.pid}</span><span className="text-xs text-muted">{p.payload.bid}</span>
            </button>
          ))}
        </Card>
      )}
    </div>
  )
}
