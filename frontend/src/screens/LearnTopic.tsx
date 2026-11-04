import { ArrowLeft, ArrowRight, Cpu, Lightbulb, Sparkles, Target } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Card, Empty, Page, TopBar } from '../components/ui'
import { TopicArt } from '../components/TopicArt'
import { TOPICS, topicById } from '../data/learn'

export default function LearnTopic() {
  const { topicId } = useParams()
  const nav = useNavigate()
  const t = topicById(topicId ?? '')
  if (!t) return (<><TopBar title="Learn" back /><Page><Empty icon={<Lightbulb />} title="Topic not found" text="" /></Page></>)
  const i = TOPICS.indexOf(t)
  const prev = TOPICS[i - 1]
  const next = TOPICS[i + 1]
  const blocks = [
    { icon: Lightbulb, title: 'In simple words', text: t.simple, tone: 'bg-primary-soft text-primary-600' },
    { icon: Target, title: 'Why it matters', text: t.why, tone: 'bg-warn-soft text-warn-ink' },
    { icon: Cpu, title: 'How Voltrace uses it', text: t.how, tone: 'bg-teal-soft text-teal-700' },
    { icon: Sparkles, title: 'Practical example', text: t.example, tone: 'bg-[#F1EDFF] text-[#6D4AE6]' },
  ]
  return (
    <>
      <TopBar title={t.title} subtitle={t.group} back="/learn" />
      <Page className="animate-fade-up" key={t.id}>
        <TopicArt kind={t.art} className="w-full rounded-2xl" />
        <h1 className="mt-4 text-[24px] font-bold leading-tight tracking-tight text-ink">{t.title}</h1>
        <p className="mt-1 text-[15px] text-muted">{t.summary}</p>
        <div className="mt-5 space-y-3">
          {blocks.map((b) => (
            <Card key={b.title} className="p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink"><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${b.tone}`}><b.icon className="h-4 w-4" /></span>{b.title}</p>
              <p className="mt-2 text-[15px] leading-relaxed text-ink/85">{b.text}</p>
            </Card>
          ))}
        </div>
        <div className="mt-6 grid grid-cols-2 gap-2.5">
          <Button variant="secondary" disabled={!prev} onClick={() => prev && nav(`/learn/${prev.id}`, { replace: true })} icon={<ArrowLeft className="h-4 w-4" />}>Previous</Button>
          <Button variant="secondary" disabled={!next} onClick={() => next && nav(`/learn/${next.id}`, { replace: true })}>Next<ArrowRight className="h-4 w-4" /></Button>
        </div>
        <p className="mt-3 text-center text-xs text-muted">Topic {i + 1} of {TOPICS.length}</p>
      </Page>
    </>
  )
}
