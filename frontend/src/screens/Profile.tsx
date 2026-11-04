import { BarChart3, Bell, BookOpen, Brain, Building2, FlaskConical, GraduationCap, HelpCircle, Info, Lock, RotateCcw, Settings as Cog, Sparkles, Stethoscope } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Divided, ListRow, Page, Section, Sheet, TopBar, toast } from '../components/ui'
import { useApp } from '../store/app'
import { useUnreadAlerts } from '../lib/hooks'

export default function Profile() {
  const nav = useNavigate()
  const st = useApp()
  const unread = useUnreadAlerts()
  const [confirm, setConfirm] = useState(false)
  const s = st.settings
  const initials = s.userName.split(' ').map((p) => p[0]).slice(0, 2).join('')
  return (
    <>
      <TopBar large title="Profile" />
      <Page>
        <Card className="flex items-center gap-4 p-4" onClick={() => nav('/settings')}>
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-teal text-lg font-bold text-white">{initials}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[17px] font-semibold text-ink">{s.userName}</p>
            <p className="truncate text-[13px] text-muted">{s.role}</p>
            <p className="mt-0.5 flex items-center gap-1 truncate text-[13px] text-muted"><Building2 className="h-3.5 w-3.5" />{s.organisation}</p>
          </div>
        </Card>

        <Section title="Tools">
          <Divided>
            <ListRow icon={<Stethoscope />} title="Battery Diagnosis" subtitle="All scans and AI diagnoses" onClick={() => nav('/diagnoses')} />
            <ListRow icon={<BarChart3 />} tone="teal" title="Analytics" subtitle="Health, ageing and safety trends" onClick={() => nav('/analytics')} />
            <ListRow icon={<GraduationCap />} tone="amber" title="Learn & Understand" subtitle="16 topics in plain language" onClick={() => nav('/learn')} />
            <ListRow icon={<Brain />} tone="slate" title="Model card & validation" subtitle="How accurate is Voltrace?" onClick={() => nav('/model')} />
          </Divided>
        </Section>

        <Section title="Competition demo">
          <Divided>
            <ListRow icon={<Sparkles />} title="Explore Demo" subtitle={st.tourActive ? 'Guided tour in progress' : 'Guided 16-step judge walkthrough'} onClick={() => nav('/demo')} />
            <ListRow icon={<RotateCcw />} tone="red" title="Reset Demo" subtitle="Restore the original fleet and clear passports" onClick={() => setConfirm(true)} />
          </Divided>
        </Section>

        <Section title="Account">
          <Divided>
            <ListRow icon={<Cog />} tone="slate" title="Settings" onClick={() => nav('/settings')} />
            <ListRow icon={<Bell />} tone="slate" title="Notifications" subtitle={unread.length ? `${unread.length} unread alert${unread.length > 1 ? 's' : ''}` : 'No unread alerts'} onClick={() => nav('/notifications')} />
            <ListRow icon={<Lock />} tone="slate" title="Privacy" subtitle="Your data stays on this device" onClick={() => nav('/settings#privacy')} />
            <ListRow icon={<HelpCircle />} tone="slate" title="Help Centre" onClick={() => nav('/help')} />
            <ListRow icon={<Info />} tone="slate" title="About Voltrace" onClick={() => nav('/about')} />
          </Divided>
        </Section>
        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted"><FlaskConical className="h-3.5 w-3.5" />Voltrace prototype v1.0 · BITS Pilani InnoStorm 2026</p>
        <p className="mt-1 flex items-center justify-center gap-1.5 text-xs text-muted"><BookOpen className="h-3.5 w-3.5" />Not a certified battery safety assessment</p>
      </Page>
      <ResetSheet open={confirm} onClose={() => setConfirm(false)} onDone={() => { setConfirm(false); nav('/') }} />
    </>
  )
}

export function ResetSheet({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const reset = useApp((s) => s.resetDemo)
  return (
    <Sheet open={open} onClose={onClose} title="Reset demo?" footer={
      <div className="grid grid-cols-2 gap-2.5">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="danger" onClick={() => { reset(); toast('Demo reset'); onDone() }}>Reset</Button>
      </div>
    }>
      <p className="text-[15px] leading-relaxed text-muted">This restores the original demo fleet, removes your scans and passports and restarts the guided tour. Your public URL setting is kept.</p>
    </Sheet>
  )
}
