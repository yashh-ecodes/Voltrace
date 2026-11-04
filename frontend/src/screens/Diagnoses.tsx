import { Stethoscope } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Divided, Empty, Page, Segmented, TopBar } from '../components/ui'
import { ScanRow } from '../components/rows'
import { useFleetSummary } from '../lib/hooks'
import { relTime } from '../lib/format'

export default function Diagnoses() {
  const { allScans } = useFleetSummary()
  const nav = useNavigate()
  const [f, setF] = useState<'all' | 'mine' | 'alerts'>('all')
  const list = useMemo(() => allScans.filter((s) => f === 'all' || (f === 'mine' ? s.id.startsWith('scan-u-') : s.diagnosis.safety.flag !== 'GREEN')), [allScans, f])
  return (
    <>
      <TopBar title="Battery Diagnosis" subtitle={`${allScans.length} scans`} back />
      <Page>
        <Segmented value={f} onChange={setF} options={[{ value: 'all', label: 'All scans' }, { value: 'mine', label: 'My scans' }, { value: 'alerts', label: 'Flagged' }]} />
        <div className="mt-4">
          {list.length ? (
            <Divided>{list.map((s) => <ScanRow key={s.id} s={s} onClick={() => nav(`/battery/${s.id}/diagnosis`)} sub={`${s.reading.vehicleType} · ${s.diagnosis.soh.value.toFixed(0)}% · ${relTime(s.createdAt)}`} />)}</Divided>
          ) : (
            <Empty icon={<Stethoscope />} title="No scans here yet" text="Scan a battery to see its AI diagnosis." action={<Button onClick={() => nav('/scan')}>Scan battery</Button>} />
          )}
        </div>
      </Page>
    </>
  )
}
