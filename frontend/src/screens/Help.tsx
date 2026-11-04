import { ChevronDown, Mail, MessageCircle } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Divided, ListRow, Page, Section, TopBar, cx } from '../components/ui'

const FAQ = [
  ['Which batteries can Voltrace scan?', 'Lithium-ion packs with a Bluetooth “smart” BMS. JBD (Xiaoxiang) and Daly protocols are supported first. Packs without a Bluetooth BMS, including lead-acid batteries, are not covered yet; a low-cost clip-on reader is on the roadmap.'],
  ['Why does Bluetooth not work in my browser?', 'Web Bluetooth works in Chrome and Edge on Android and desktop, over HTTPS. iOS browsers and Firefox do not support it. The Voltrace Android app uses native Bluetooth instead.'],
  ['What is the guided load test?', 'After connecting, Voltrace asks you to switch a load on for 20 seconds (for example lights and the motor with wheels raised). It measures how each cell’s voltage sags and recovers, which reveals internal resistance.'],
  ['Is a GREEN result a guarantee of safety?', 'No. GREEN means no significant abnormality was identified in the available data. Voltrace is a prototype screening and decision-support tool, not a certified safety assessment, and cannot predict fires.'],
  ['What should I do if a battery is RED?', 'Stop charging and using it, park the vehicle outdoors away from buildings, and contact a qualified battery technician or authorised service centre promptly.'],
  ['How accurate is the health estimate?', 'On NASA test cells the model was never trained on, mean error was 3.6 SoH points, and the 90% range contained the true value 89% of the time. Accuracy on Indian packs will be confirmed through field validation.'],
  ['How can someone check a passport is real?', 'Scan its QR code with any phone camera. The verification page recomputes the SHA-256 fingerprint and checks the Ed25519 signature. Any edit makes verification fail.'],
  ['What is demo mode?', 'Three reproducible battery profiles (healthy, aged and faulty) let you try Voltrace without hardware. All results from demo data are clearly labelled.'],
]

export default function Help() {
  const [open, setOpen] = useState<number | null>(0)
  const nav = useNavigate()
  return (
    <>
      <TopBar title="Help Centre" back />
      <Page>
        <Section title="Frequently asked questions" className="mt-2">
          <Card className="divide-y divide-line/80 overflow-hidden">
            {FAQ.map(([q, a], i) => (
              <div key={q}>
                <button onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i} className="tap flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left active:bg-subtle/60">
                  <span className="flex-1 text-[15px] font-medium text-ink">{q}</span>
                  <ChevronDown className={cx('h-5 w-5 shrink-0 text-faint transition', open === i && 'rotate-180')} />
                </button>
                {open === i && <p className="animate-fade-up px-4 pb-4 text-sm leading-relaxed text-muted">{a}</p>}
              </div>
            ))}
          </Card>
        </Section>
        <Section title="Still need help?">
          <Divided>
            <ListRow icon={<MessageCircle />} title="Learn & Understand" subtitle="Battery concepts explained simply" onClick={() => nav('/learn')} />
            <ListRow icon={<Mail />} tone="teal" title="Contact the Voltrace team" subtitle="support@voltrace.example" onClick={() => { window.location.href = 'mailto:support@voltrace.example?subject=Voltrace%20support' }} />
          </Divided>
        </Section>
      </Page>
    </>
  )
}
