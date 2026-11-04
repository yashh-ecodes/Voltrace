export type GlossaryKey =
  | 'soh' | 'soc' | 'sos' | 'confidence' | 'cycles' | 'cellVoltage' | 'spread' | 'resistance' | 'sag' | 'temperature'
  | 'drift' | 'iforest' | 'xgboost' | 'passport' | 'sha256' | 'signature' | 'remaining' | 'rated' | 'protection'
  | 'ageing' | 'secondLife' | 'nominal' | 'median'

export const GLOSSARY: Record<GlossaryKey, { title: string; text: string; why?: string; learn?: string }> = {
  soh: { title: 'State of Health', text: 'State of Health tells you how much usable capacity your battery retains compared with when it was new.', why: 'It decides range, resale value and whether the pack should stay in a vehicle.', learn: 'soh' },
  soc: { title: 'State of Charge', text: 'How full the battery is right now, like a fuel gauge. It is not the same as health.', learn: 'soc' },
  sos: { title: 'State of Safety', text: 'Voltrace’s screening flag. GREEN: no significant abnormality identified in available data. AMBER: abnormal behaviour, inspection recommended. RED: significant abnormality, prompt professional inspection required.', why: 'This is a prototype screening tool, not a certified safety assessment. It cannot guarantee a battery is safe.', learn: 'sos' },
  confidence: { title: 'Confidence range', text: 'The model predicts a range that should contain the true SoH 90% of the time. On held-out NASA test cells the range contained the true value 89% of the time.', why: 'A single number can look more certain than it is. The range shows the real uncertainty.', learn: 'xgboost' },
  cycles: { title: 'Cycle count', text: 'How many full charge-discharge cycles the BMS has counted. Two half-charges count as one cycle.', why: 'More cycles generally means more ageing, at a rate that depends on chemistry.', learn: 'degradation' },
  cellVoltage: { title: 'Cell voltage', text: 'The voltage of an individual cell. In a balanced pack all cells rest within a few millivolts of each other.', learn: 'cell-voltage' },
  spread: { title: 'Cell spread', text: 'The difference between the highest and lowest cell voltage. A resting spread above 50 mV is treated as abnormal.', learn: 'cell-voltage' },
  resistance: { title: 'Internal resistance', text: 'Estimated from the guided load test as R = ΔV ÷ ΔI. It rises as cells age or become damaged.', learn: 'internal-resistance' },
  sag: { title: 'Voltage sag', text: 'How far a cell’s voltage dips when the load is switched on, compared with its siblings.', learn: 'voltage-sag' },
  temperature: { title: 'Temperature deviation', text: 'How much warmer a cell is than the pack median. Localised heat can indicate internal resistance or a micro-short.', learn: 'battery-fires' },
  drift: { title: 'Voltage drift', text: 'How much a cell’s voltage changed between two scans compared with its siblings. A cell that keeps losing charge on its own shows abnormal self-discharge.', learn: 'battery-fires' },
  iforest: { title: 'Isolation Forest score', text: 'How easily a cell can be separated from its siblings (0–1). Higher means more unusual. Voltrace’s alert threshold is 0.65.', learn: 'isolation-forest' },
  xgboost: { title: 'XGBoost SoH model', text: 'A gradient-boosted tree model trained on NASA battery ageing data. It corrects the often optimistic capacity reported by low-cost BMS boards.', learn: 'xgboost' },
  passport: { title: 'Battery Passport', text: 'A digitally signed record of this battery’s identity, health and safety that anyone can verify by scanning its QR code.', learn: 'battery-passport' },
  sha256: { title: 'SHA-256 fingerprint', text: 'A 64-character fingerprint of the exact passport data. Changing any value changes the fingerprint completely.', learn: 'sha256' },
  signature: { title: 'Ed25519 signature', text: 'Created with Voltrace’s private key, which stays on the server. Anyone can check it with the public key, but nobody can forge it.', learn: 'digital-signatures' },
  remaining: { title: 'Remaining capacity', text: 'Estimated usable capacity today: rated capacity × State of Health.', learn: 'soh' },
  rated: { title: 'Rated capacity', text: 'The capacity the manufacturer specified when the battery was new, in ampere-hours (Ah).', learn: 'soh' },
  protection: { title: 'BMS protection events', text: 'Times the BMS switched the battery off to protect it, for example for over-current or a cell dropping too low.', learn: 'bms' },
  ageing: { title: 'Ageing indicator', text: 'A plain-language summary of how far the pack has aged, based on the estimated SoH.', learn: 'degradation' },
  secondLife: { title: 'Second-life use', text: 'Reusing an aged EV battery in gentler stationary storage after professional testing.', learn: 'second-life' },
  nominal: { title: 'Nominal voltage', text: 'The pack’s typical operating voltage, e.g. 16 LFP cells × 3.2 V = 51.2 V.', learn: 'lithium-ion' },
  median: { title: 'Pack median', text: 'The middle value across all cells. Comparing each cell with the median makes the method work for any brand without a big labelled dataset.', learn: 'isolation-forest' },
}
