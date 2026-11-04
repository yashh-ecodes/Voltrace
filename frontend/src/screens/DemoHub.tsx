import { Check, Play, RotateCcw, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Page, Section, TopBar, cx } from '../components/ui'
import { TOUR_STEPS, useApp } from '../store/app'
import { ResetSheet } from './Profile'

export default function DemoHub() {
  const nav = useNavigate()
  const st = useApp()
  const [reset, setReset] = useState(false)
  return (
    <>
      <TopBar title="Explore Demo" back />
      <Page>
        <Card className="overflow-hidden border-0 bg-ink p-5 text-white">
          <Sparkles className="h-7 w-7 text-teal" />
          <h1 className="mt-3 text-[22px] font-bold leading-tight">See the full Voltrace story in 3 minutes</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-white/70">No battery or BMS needed. A floating guide walks you from scanning a faulty battery to AI diagnosis, a signed passport, verification on a second phone and tamper detection.</p>
          <Button variant="secondary" size="lg" full className="mt-5 border-0" onClick={() => { st.startTour(); nav('/') }} icon={<Play className="h-5 w-5 text-primary" />}>
            {st.tourActive ? 'Restart guided demo' : 'Start guided demo'}
          </Button>
        </Card>

        <Section title="The 16 steps">
          <Card className="p-2">
            <ol>
              {TOUR_STEPS.map((s, i) => {
                const done = st.tourDone.includes(s.id)
                return (
                  <li key={s.id} className="flex items-start gap-3 rounded-xl px-2 py-2.5">
                    <span className={cx('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold', done ? 'bg-teal text-white' : 'bg-subtle text-muted')}>{done ? <Check className="h-3.5 w-3.5" /> : i + 1}</span>
                    <span>
                      <span className="block text-sm font-semibold text-ink">{s.title}</span>
                      <span className="block text-[12.5px] leading-snug text-muted">{s.hint}</span>
                    </span>
                  </li>
                )
              })}
            </ol>
          </Card>
        </Section>

        <Section title="Tips for judges">
          <Card className="space-y-2 p-4 text-[13px] leading-relaxed text-muted">
            <p>• Step 13 needs a second phone: point its camera at the passport QR. If the app runs on localhost, set a public URL in Settings first.</p>
            <p>• All demo data is reproducible: the faulty battery always flags cell 11, and its fleet record updates when you scan it.</p>
            <p>• Results from demo profiles are labelled as demonstration data throughout.</p>
          </Card>
        </Section>
        <Button variant="danger" full className="mt-6" onClick={() => setReset(true)} icon={<RotateCcw className="h-4 w-4" />}>Reset Demo</Button>
      </Page>
      <ResetSheet open={reset} onClose={() => setReset(false)} onDone={() => { setReset(false); nav('/demo') }} />
    </>
  )
}
