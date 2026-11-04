import type { ScanRecord, UsageCategory } from '../types'

export interface Recommendation {
  category: UsageCategory
  title: string
  detected: string
  why: string
  todo: string[]
  inspection: { level: 'Required' | 'Recommended' | 'Routine'; text: string }
}

export interface Extra { title: string; text: string; tone: 'blue' | 'amber' | 'red' | 'teal' }

export function buildRecommendation(scan: ScanRecord): { main: Recommendation; extras: Extra[] } {
  const { diagnosis: d, reading: r } = scan
  const soh = d.soh.value
  const cell = d.safety.suspectCell
  const top = d.safety.findings.slice(0, 3).map((f) => f.title.toLowerCase())
  let main: Recommendation
  switch (d.usage) {
    case 'RECYCLE':
      main = d.safety.flag === 'RED'
        ? {
            category: 'RECYCLE',
            title: 'Remove from service and arrange a professional inspection',
            detected: `Cell ${cell} behaves very differently from the other ${r.seriesCells - 1} cells: ${top.join('; ')}. Overall health is ${soh.toFixed(0)}%, but one bad cell can make the whole pack unsafe.`,
            why: 'Internal shorts usually start in a single cell that slowly drifts away from its siblings. If it continues, the cell can overheat. Catching this early is the best chance to prevent a fire.',
            todo: [
              'Stop charging the battery and avoid riding the vehicle.',
              'Park it outdoors, away from buildings, doorways and other vehicles.',
              'Contact an authorised service centre or qualified battery technician promptly.',
              `Ask them to test cell ${cell}. If the fault is confirmed, the pack should go to an authorised battery recycler or have the faulty module replaced by a certified repairer.`,
            ],
            inspection: { level: 'Required', text: 'Yes — prompt professional inspection is required before any further use.' },
          }
        : {
            category: 'RECYCLE',
            title: 'Refer to an authorised battery recycler',
            detected: `Estimated health is ${soh.toFixed(0)}%, below the level where the pack can usefully store energy.`,
            why: 'At this level of degradation a pack delivers little energy and may heat up more under load. Recycling recovers lithium, cobalt and other materials safely.',
            todo: ['Stop using the pack for daily operation.', 'Contact an authorised battery recycler (EPR-registered in India).', 'Keep the passport with the pack so the recycler has its history.'],
            inspection: { level: 'Recommended', text: 'A technician should confirm the result before the pack is handed over.' },
          }
      break
    case 'INSPECT':
      main = {
        category: 'INSPECT',
        title: 'Book a professional inspection',
        detected: `${cell ? `Cell ${cell}` : 'The pack'} shows unusual behaviour: ${top.join('; ') || 'statistical outlier among sibling cells'}.`,
        why: 'This is not necessarily dangerous, but abnormal cells can deteriorate. An inspection confirms whether it is a measurement quirk, a balancing issue or an early fault.',
        todo: ['Arrange an inspection with a qualified technician within the next few days.', 'Avoid fast charging and do not leave the battery charging unattended.', 'Re-scan after inspection or within 7 days to see whether the deviation is growing.'],
        inspection: { level: 'Recommended', text: 'Yes — an inspection is recommended before relying on this battery.' },
      }
      break
    case 'SECOND_LIFE':
      main = {
        category: 'SECOND_LIFE',
        title: 'Evaluate for stationary second-life use after appropriate testing',
        detected: `Estimated health is ${soh.toFixed(0)}% (range ${d.soh.low.toFixed(0)}–${d.soh.high.toFixed(0)}%). Range on the road is reduced, but no significant cell abnormality was found in the available data.`,
        why: 'Packs below ~80% health often no longer meet vehicle range needs, yet they can serve for years in gentler stationary storage such as inverters or solar backup. This keeps value in use and delays recycling.',
        todo: ['Plan replacement of the vehicle battery.', 'Have a certified refurbisher run a full capacity and insulation test.', 'If it passes, the pack can be graded for second-life storage using this passport.'],
        inspection: { level: 'Required', text: 'Yes — second-life reuse must only follow professional testing. This scan alone is not enough.' },
      }
      break
    default:
      main = {
        category: 'CONTINUE',
        title: 'Continue in vehicle, subject to normal inspection',
        detected: `Estimated health is ${soh.toFixed(0)}% and all ${r.seriesCells} cells behave consistently (spread ${d.safety.spreadMv} mV).`,
        why: 'Consistent cells and good capacity are what you want to see. Regular scans catch changes early and build a trustworthy history for resale.',
        todo: ['Keep using the battery normally.', 'Avoid leaving it at 100% charge in hot weather for long periods.', 'Re-scan every 3 months, or after an impact, water exposure or overheating.'],
        inspection: { level: 'Routine', text: 'Not urgently — routine servicing is enough. No screening can rule out every fault.' },
      }
  }

  const extras: Extra[] = []
  const over = d.soh.bmsReported - soh
  if (over > 4) extras.push({ tone: 'blue', title: `BMS over-reports capacity by ${over.toFixed(0)} points`, text: `The BMS claims ${d.soh.bmsReported.toFixed(0)}% capacity; Voltrace’s model estimates ${soh.toFixed(0)}%. Low-cost BMS boards rarely re-learn capacity, so buyers should rely on the corrected figure.` })
  for (const e of r.protectionEvents) extras.push({ tone: 'amber', title: `${e.label} · ${e.count}×`, text: e.code === 'COT' || e.code === 'DOT' ? 'Check that the charger and ventilation are appropriate for this pack.' : e.code === 'DOC' ? 'The pack was asked for more current than allowed. Check the controller settings and wiring.' : 'The BMS protected a cell from going too low. Avoid running the battery completely flat.' })
  if (d.features.cycle_frac > 0.8 && d.usage === 'CONTINUE') extras.push({ tone: 'teal', title: 'Approaching rated cycle life', text: 'Start planning a replacement and consider second-life options within the next year.' })
  if (!r.loadTest) extras.push({ tone: 'amber', title: 'No load test recorded', text: 'Resistance and sag could not be measured, so the health estimate is less certain. Repeat the scan with the guided load test.' })
  return { main, extras }
}
