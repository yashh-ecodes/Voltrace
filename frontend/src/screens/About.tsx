import { Leaf, Recycle, ShieldCheck, Scale } from 'lucide-react'
import { Card, Divided, KV, Page, Section, TopBar } from '../components/ui'
import { LogoMark, Logotype } from '../components/visuals'

export default function About() {
  return (
    <>
      <TopBar title="About Voltrace" back />
      <Page>
        <div className="flex flex-col items-center pt-4 text-center">
          <LogoMark size={96} />
          <h1 className="mt-5"><Logotype height={24} /></h1>
          <p className="mt-2 text-[15px] text-muted">Know Your Battery. Trust Its Future.</p>
          <p className="mt-4 max-w-[340px] text-[14px] leading-relaxed text-ink/80">An AI battery passport that checks the health and fire risk of lithium EV batteries in about 30 seconds, using only a phone and the smart BMS already inside the pack.</p>
        </div>
        <Section title="Why it matters">
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { i: ShieldCheck, t: 'Safety', d: 'Catch faulty cells before they cause fires.' },
              { i: Scale, t: 'Trust', d: 'Price used batteries on verified data.' },
              { i: Recycle, t: 'Circularity', d: 'Grade packs for reuse instead of scrapping.' },
              { i: Leaf, t: 'Regulation', d: 'Feeds EU Battery Passport & India BPAN data.' },
            ].map((x) => (
              <Card key={x.t} className="p-3.5">
                <x.i className="h-5 w-5 text-primary" />
                <p className="mt-2 text-sm font-semibold text-ink">{x.t}</p>
                <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{x.d}</p>
              </Card>
            ))}
          </div>
        </Section>
        <Section title="Technology">
          <Divided>
            <KV label="App" value="React · TypeScript · PWA" />
            <KV label="Android" value="Capacitor + native BLE" />
            <KV label="BMS protocols" value="JBD · Daly" />
            <KV label="SoH model" value="XGBoost (NASA PCoE)" />
            <KV label="Safety model" value="Isolation Forest + rules" />
            <KV label="Trust" value="SHA-256 · Ed25519 · QR" />
            <KV label="Backend" value="FastAPI · Supabase" />
            <KV label="Version" value="1.0.0 prototype" />
          </Divided>
        </Section>
        <Card className="mt-6 p-4 text-[12.5px] leading-relaxed text-muted">
          Voltrace is a prototype screening and decision-support tool developed for BITS Pilani InnoStorm 2026. It is not a certified battery safety assessment, does not guarantee that a battery is safe and cannot predict fires. Training data: NASA Prognostics Center of Excellence Li-ion Battery Aging Dataset.
        </Card>
      </Page>
    </>
  )
}
