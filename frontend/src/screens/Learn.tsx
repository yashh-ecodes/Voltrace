import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Page, Section, TopBar, cx } from '../components/ui'
import { TopicArt } from '../components/TopicArt'
import { TOPICS, type Topic } from '../data/learn'

const GROUPS: Topic['group'][] = ['Battery basics', 'Health & safety', 'Voltrace AI', 'Trust & reuse']

export default function Learn() {
  const [open, setOpen] = useState<string | null>(null)
  const nav = useNavigate()
  return (
    <>
      <TopBar large title="Learn & Understand" subtitle="Battery science and Voltrace’s AI, explained simply" back />
      <Page>
        <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary-soft to-teal-soft p-4">
          <p className="text-[15px] font-semibold text-ink">No technical knowledge needed</p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">16 short topics. Tap a card for a quick explanation, or open it for examples and illustrations. Look for the ⓘ icon next to any metric in the app.</p>
        </Card>
        {GROUPS.map((g) => (
          <Section key={g} title={g}>
            <div className="space-y-2.5">
              {TOPICS.filter((t) => t.group === g).map((t) => {
                const isOpen = open === t.id
                return (
                  <Card key={t.id} className="overflow-hidden">
                    <button onClick={() => setOpen(isOpen ? null : t.id)} aria-expanded={isOpen} className="tap flex w-full items-center gap-3 p-3 text-left active:bg-subtle/60">
                      <TopicArt kind={t.art} className="h-14 w-[86px] shrink-0 rounded-xl" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-semibold text-ink">{t.title}</span>
                        <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">{t.summary}</span>
                      </span>
                      <ChevronDown className={cx('h-5 w-5 shrink-0 text-faint transition', isOpen && 'rotate-180')} />
                    </button>
                    {isOpen && (
                      <div className="animate-fade-up border-t border-line/70 px-4 pb-4 pt-3">
                        <p className="text-sm leading-relaxed text-ink">{t.simple}</p>
                        <button onClick={() => nav(`/learn/${t.id}`)} className="tap mt-3 flex h-10 items-center gap-1 text-sm font-semibold text-primary-600">Why it matters, how Voltrace uses it & example<ChevronRight className="h-4 w-4" /></button>
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          </Section>
        ))}
      </Page>
    </>
  )
}
