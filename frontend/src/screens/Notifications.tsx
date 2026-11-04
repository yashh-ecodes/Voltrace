import { BellOff, CheckCheck } from 'lucide-react'
import { useEffect } from 'react'
import { Empty, Page, TopBar } from '../components/ui'
import { AlertRow } from '../components/rows'
import { useFleetSummary } from '../lib/hooks'
import { useApp } from '../store/app'

export default function Notifications() {
  const { alerts } = useFleetSummary()
  const read = useApp((s) => s.readAlerts)
  const mark = useApp((s) => s.markAlertsRead)
  const unread = alerts.filter((a) => !read.includes(a.id))
  useEffect(() => {
    const t = setTimeout(() => mark(alerts.map((a) => a.id)), 1500)
    return () => clearTimeout(t)
  }, [alerts, mark])
  return (
    <>
      <TopBar title="Notifications" back right={unread.length ? <button onClick={() => mark(alerts.map((a) => a.id))} className="tap flex h-10 items-center gap-1 rounded-full px-3 text-sm font-semibold text-primary-600"><CheckCheck className="h-4 w-4" />Read all</button> : undefined} />
      <Page>
        {alerts.length ? (
          <div className="space-y-2.5">
            {alerts.map((a) => (
              <div key={a.id} className="relative">
                {!read.includes(a.id) && <span className="absolute -left-1.5 top-5 z-10 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-bg" />}
                <AlertRow a={a} />
              </div>
            ))}
          </div>
        ) : (
          <Empty icon={<BellOff />} title="All clear" text="No batteries currently need attention." />
        )}
      </Page>
    </>
  )
}
