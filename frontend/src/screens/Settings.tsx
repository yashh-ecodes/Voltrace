import { CheckCircle2, CloudOff, Loader2, RefreshCw, Server } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Divided, Page, Section, Toggle, TopBar, toast } from '../components/ui'
import { useApp } from '../store/app'
import { api, type Health } from '../lib/api'
import { publicBase, refreshKeys } from '../lib/passport'
import { ResetSheet } from './Profile'

export default function Settings() {
  const st = useApp()
  const s = st.settings
  const nav = useNavigate()
  const [health, setHealth] = useState<Health | null | undefined>(undefined)
  const [url, setUrl] = useState(s.publicBaseUrl)
  const [reset, setReset] = useState(false)
  const check = async () => {
    setHealth(undefined)
    const h = await api.health(true)
    setHealth(h)
    if (h) refreshKeys()
  }
  useEffect(() => {
    check()
    if (window.location.hash.includes('#privacy')) setTimeout(() => document.getElementById('privacy')?.scrollIntoView({ behavior: 'smooth' }), 200)
  }, [])

  const Row = ({ title, sub, value, onChange }: { title: string; sub?: string; value: boolean; onChange: (v: boolean) => void }) => (
    <div className="flex min-h-[60px] items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1"><p className="text-[15px] font-medium text-ink">{title}</p>{sub && <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{sub}</p>}</div>
      <Toggle checked={value} onChange={onChange} label={title} />
    </div>
  )
  const Input = ({ label, k }: { label: string; k: 'userName' | 'organisation' | 'role' }) => (
    <label className="block px-4 py-3">
      <span className="text-[12.5px] font-medium text-muted">{label}</span>
      <input defaultValue={s[k]} onBlur={(e) => st.updateSettings({ [k]: e.target.value || s[k] })} className="mt-1 h-11 w-full rounded-xl border border-line bg-bg px-3 text-[15px] outline-none focus:border-primary" />
    </label>
  )

  return (
    <>
      <TopBar title="Settings" back />
      <Page>
        <Section title="Account" className="mt-2">
          <Divided><Input label="Name" k="userName" /><Input label="Organisation" k="organisation" /><Input label="Role" k="role" /></Divided>
        </Section>

        <Section title="Notifications">
          <Divided>
            <Row title="Safety alerts" sub="When a battery is flagged Amber or Red" value={s.notifySafety} onChange={(v) => st.updateSettings({ notifySafety: v })} />
            <Row title="Fleet risk changes" sub="When a pack’s risk rises between scans" value={s.notifyFleet} onChange={(v) => st.updateSettings({ notifyFleet: v })} />
            <Row title="Tips & reminders" sub="Re-scan reminders every 3 months" value={s.notifyTips} onChange={(v) => st.updateSettings({ notifyTips: v })} />
          </Divided>
        </Section>

        <Section title="Voltrace service">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${health ? 'bg-ok-soft text-ok-ink' : health === null ? 'bg-subtle text-muted' : 'bg-primary-soft text-primary'}`}>
                {health === undefined ? <Loader2 className="h-5 w-5 animate-spin" /> : health ? <Server className="h-5 w-5" /> : <CloudOff className="h-5 w-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-ink">{health === undefined ? 'Checking…' : health ? 'Connected' : 'Offline'}</p>
                <p className="truncate text-[12.5px] text-muted">{health ? `${health.models.soh} · ${health.store} · key ${health.kid}` : `API ${api.base} not reachable — on-device mode`}</p>
              </div>
              <button aria-label="Recheck" onClick={check} className="tap flex h-10 w-10 items-center justify-center rounded-full text-muted active:bg-subtle"><RefreshCw className="h-4 w-4" /></button>
            </div>
          </Card>
          <Divided>
            <Row title="Use cloud model service" sub="Run inference on the FastAPI service when reachable. Both use the same trained models." value={s.cloudInference} onChange={(v) => st.updateSettings({ cloudInference: v })} />
            <Row title="Offline demo signing" sub="If the signing server is unreachable, sign with the public demonstration key (clearly labelled)." value={s.offlineDemoSigning} onChange={(v) => st.updateSettings({ offlineDemoSigning: v })} />
          </Divided>
        </Section>

        <Section title="Passport QR links">
          <Card className="p-4">
            <p className="text-[13px] leading-relaxed text-muted">QR codes link to <span className="font-mono text-ink">{publicBase(s.publicBaseUrl)}</span>. Set the public HTTPS address where Voltrace is hosted so other phones can open verification links.</p>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://voltrace.example.app/" className="mt-3 h-11 w-full rounded-xl border border-line bg-bg px-3 text-[15px] outline-none focus:border-primary" inputMode="url" autoCapitalize="none" />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="secondary" size="sm" onClick={() => { setUrl(''); st.updateSettings({ publicBaseUrl: '' }); toast('Using this app’s address') }}>Use current</Button>
              <Button size="sm" onClick={() => {
                const v = url.trim()
                if (v && !/^https?:\/\//.test(v)) return toast('Enter a full http(s) URL', 'err')
                st.updateSettings({ publicBaseUrl: v })
                toast('Saved')
              }}>Save</Button>
            </div>
          </Card>
        </Section>

        <Section title="Privacy" className="scroll-mt-20">
          <div id="privacy" />
          <Card className="space-y-2 p-4 text-[13px] leading-relaxed text-muted">
            <p className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal" />Scans, fleet data and passports are stored on this device.</p>
            <p className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal" />Only engineered features are sent to the model service when cloud mode is on; passports are sent for signing.</p>
            <p className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal" />QR verification runs locally; camera images never leave the phone.</p>
          </Card>
          <Divided>
            <Row title="Share anonymised analytics" sub="Help improve models (off by default)" value={s.shareAnalytics} onChange={(v) => st.updateSettings({ shareAnalytics: v })} />
          </Divided>
          <Button variant="danger" full className="mt-3" onClick={() => setReset(true)}>Clear data & reset demo</Button>
        </Section>
      </Page>
      <ResetSheet open={reset} onClose={() => setReset(false)} onDone={() => { setReset(false); nav('/') }} />
    </>
  )
}
