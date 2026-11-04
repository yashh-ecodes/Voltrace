import { AlertTriangle, Brain, ShieldCheck } from 'lucide-react'
import { Badge, Card, Divided, KV, Page, Section, TopBar, cx } from '../components/ui'
import soh from '../ml/models/soh_model_card.json'
import iforest from '../ml/models/iforest_model_card.json'

const FEAT_LABEL: Record<string, string> = {
  bms_soh: 'BMS-reported capacity', avg_temp_c: 'Average temperature', cycle_frac: 'Cycle count (vs rated life)',
  slope_rel: 'Voltage curve slope', r_growth: 'Internal resistance', recovery_ratio: 'Voltage recovery',
}

export default function ModelCard() {
  const imp = Object.entries(soh.feature_importance_gain as Record<string, number>)
  const det = iforest.detection_rate as Record<string, Record<string, Record<string, number>>>
  const fa = iforest.false_alarm_rate_per_pack as Record<string, number>
  return (
    <>
      <TopBar title="Model card & validation" back />
      <Page>
        <p className="text-[14px] leading-relaxed text-muted">Real numbers from Voltrace’s training and validation runs, following the validation plan in the project proposal.</p>

        <Section title={<span className="flex items-center gap-2"><Brain className="h-4 w-4 text-primary" />State of Health model</span>}>
          <Card className="p-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-teal-soft p-2.5"><p className="text-[22px] font-bold text-teal-700">{soh.mae_pct_points}</p><p className="text-[11px] text-muted">MAE (pts)</p></div>
              <div className="rounded-xl bg-primary-soft p-2.5"><p className="text-[22px] font-bold text-primary-700">{Math.round(soh.interval_coverage_90 * 100)}%</p><p className="text-[11px] text-muted">90% range coverage</p></div>
              <div className="rounded-xl bg-subtle p-2.5"><p className="text-[22px] font-bold text-ink">{soh.baseline_bms_only_mae}</p><p className="text-[11px] text-muted">BMS-only MAE</p></div>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-muted">{soh.algorithm}. Trained on {soh.cells_train} NASA cells ({soh.samples_train} cycles) and tested on {soh.cells_test} unseen cells ({soh.samples_test} cycles). Proposal target: MAE below 3 points — current result {soh.mae_pct_points}.</p>
          </Card>
          <Divided>
            <KV label="Dataset" value={<span className="block max-w-[200px]">NASA PCoE Li-ion ageing</span>} />
            <KV label="Split" value="By battery (no leakage)" />
            <KV label="Test cells" value={<span className="font-mono text-xs">{soh.test_cells.join(', ')}</span>} />
            <KV label="RMSE" value={`${soh.rmse_pct_points} pts`} />
            <KV label="MAE without BMS input" value={`${soh.mae_without_bms_feature} pts`} />
          </Divided>
          <Card className="mt-3 p-4">
            <p className="text-sm font-semibold text-ink">Feature importance (gain)</p>
            <div className="mt-3 space-y-2.5">
              {imp.map(([k, v]) => (
                <div key={k}>
                  <div className="flex justify-between text-[12.5px]"><span className="text-ink">{FEAT_LABEL[k] ?? k}</span><span className="tabular-nums text-muted">{(v * 100).toFixed(0)}%</span></div>
                  <div className="mt-1 h-2 rounded-full bg-subtle"><div className="h-2 rounded-full bg-gradient-to-r from-primary to-teal" style={{ width: `${v * 100}%` }} /></div>
                </div>
              ))}
            </div>
          </Card>
        </Section>

        <Section title={<span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-teal" />Safety screening</span>}>
          <Card className="p-4">
            <p className="text-[13px] leading-relaxed text-muted">{iforest.algorithm}. {iforest.validation}.</p>
            <p className="mt-3 text-sm font-semibold text-ink">Detection rate · hybrid (IF + rules)</p>
            <table className="mt-2 w-full text-[12.5px]">
              <thead><tr className="text-muted"><th className="py-1 text-left font-medium">Injected fault</th><th className="font-medium">Low</th><th className="font-medium">Med</th><th className="font-medium">High</th></tr></thead>
              <tbody>
                {Object.entries(det.hybrid).map(([k, v]) => (
                  <tr key={k} className="border-t border-line/70">
                    <td className="py-2 capitalize text-ink">{k.replace('_', ' ')}</td>
                    {['low', 'medium', 'high'].map((s) => <td key={s} className={cx('text-center font-semibold tabular-nums', v[s] >= 0.9 ? 'text-teal-700' : v[s] >= 0.5 ? 'text-warn-ink' : 'text-muted')}>{Math.round(v[s] * 100)}%</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-sm font-semibold text-ink">Isolation Forest alone</p>
            <table className="mt-2 w-full text-[12.5px]">
              <tbody>
                {Object.entries(det.iforest_only).map(([k, v]) => (
                  <tr key={k} className="border-t border-line/70">
                    <td className="py-2 capitalize text-ink">{k.replace('_', ' ')}</td>
                    {['low', 'medium', 'high'].map((s) => <td key={s} className="text-center tabular-nums text-muted">{Math.round(v[s] * 100)}%</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge tone="amber">False alarms: {Math.round(fa.hybrid * 1000) / 10}% of healthy packs</Badge>
              <Badge>Alert score ≥ {iforest.threshold_amber}</Badge>
            </div>
            <p className="mt-3 text-[12.5px] leading-relaxed text-muted">Why hybrid: Isolation Forest catches multi-signal outliers, but misses faults that show up in one signal only (e.g. a pure hotspot). Rule thresholds cover those cases.</p>
          </Card>
          <Card className="mt-3 p-4">
            <p className="text-sm font-semibold text-ink">Rule thresholds</p>
            <ul className="mt-2 space-y-1.5 text-[13px] text-muted">{(iforest.rules as string[]).map((r) => <li key={r}>• {r}</li>)}</ul>
          </Card>
        </Section>

        <Section title={<span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warn" />Limitations</span>}>
          <Card className="space-y-2 p-4 text-[13px] leading-relaxed text-muted">
            {(soh.notes as string[]).map((n) => <p key={n}>• {n}</p>)}
            <p>• Safety models were validated on simulated fault injection, not on real failing packs.</p>
            <p>• Voltrace is a screening tool; it cannot guarantee safety or predict fires.</p>
          </Card>
        </Section>
      </Page>
    </>
  )
}
