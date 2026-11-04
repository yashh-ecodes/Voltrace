export type ArtKind = 'cell' | 'bms' | 'soh' | 'soc' | 'shield' | 'cells' | 'resistance' | 'sag' | 'fade' | 'fire' | 'trees' | 'forest' | 'passport' | 'hash' | 'signature' | 'secondlife'

export interface Topic {
  id: string
  title: string
  group: 'Battery basics' | 'Health & safety' | 'Voltrace AI' | 'Trust & reuse'
  art: ArtKind
  summary: string
  simple: string
  why: string
  how: string
  example: string
}

export const TOPICS: Topic[] = [
  {
    id: 'lithium-ion', title: 'Lithium-ion batteries', group: 'Battery basics', art: 'cell',
    summary: 'The rechargeable cells inside e-rickshaws, scooters and EVs.',
    simple: 'A lithium-ion cell stores energy by moving lithium ions between two electrodes. When you charge, ions move into the negative side; when you ride, they flow back and release electricity. An EV pack is simply many cells connected together — for example 16 cells in series for a 51.2 V e-rickshaw.',
    why: 'They are light and energy-dense, but every cell ages a little each time it is used, and a damaged cell can overheat.',
    how: 'Voltrace reads every cell in the pack individually, because problems almost always begin in one cell rather than the whole pack.',
    example: 'A 51.2 V, 100 Ah LFP e-rickshaw pack contains 16 cells of 3.2 V each, wired in a chain.',
  },
  {
    id: 'bms', title: 'Battery Management Systems', group: 'Battery basics', art: 'bms',
    summary: 'The small computer inside the pack that watches every cell.',
    simple: 'A Battery Management System (BMS) is an electronic board inside the battery. It measures each cell’s voltage, the current flowing in or out, and the temperature, and it switches the battery off if something goes outside safe limits.',
    why: 'The BMS already collects most of the data needed to judge a battery’s health — it is just hidden from the owner.',
    how: 'Voltrace connects to “smart” BMS boards over Bluetooth (JBD and Daly protocols first) and reads that hidden data. No extra hardware is needed.',
    example: 'Many Indian e-rickshaw packs use JBD or Daly BMS boards with a Bluetooth module that a phone can talk to.',
  },
  {
    id: 'soh', title: 'State of Health (SoH)', group: 'Health & safety', art: 'soh',
    summary: 'How much capacity the battery still has compared with when it was new.',
    simple: 'State of Health tells you how much usable capacity your battery retains compared with when it was new. A 100 Ah battery at 84% SoH can now store about 84 Ah.',
    why: 'SoH decides range, resale value and whether a pack should stay in a vehicle, move to second-life storage, or be recycled.',
    how: 'Voltrace estimates SoH with an XGBoost model from cycle count, internal resistance, voltage behaviour under load, temperature and the BMS’s own capacity figure — and shows a confidence range, not just one number.',
    example: 'An e-rickshaw battery at 72% SoH may still power a home inverter for years, even if it no longer gives enough range on the road.',
  },
  {
    id: 'soc', title: 'State of Charge (SoC)', group: 'Battery basics', art: 'soc',
    summary: 'How full the battery is right now — like a fuel gauge.',
    simple: 'State of Charge is the percentage of energy currently stored, from 0% (empty) to 100% (full). It changes every time you ride or charge.',
    why: 'SoC is not the same as health: a worn-out battery can show 100% charge, but 100% of a smaller tank.',
    how: 'Voltrace records SoC at scan time so that voltage readings are interpreted correctly, but it never uses SoC alone to judge health.',
    example: 'Two packs both show 80% SoC. One has 100 Ah capacity, the other 70 Ah — the first will go much further.',
  },
  {
    id: 'sos', title: 'State of Safety', group: 'Health & safety', art: 'shield',
    summary: 'A Green / Amber / Red screening flag for abnormal cell behaviour.',
    simple: 'State of Safety is Voltrace’s screening result. GREEN means no significant abnormality was identified in the available data. AMBER means abnormal behaviour was detected and an inspection is recommended. RED means a significant abnormality needs prompt professional inspection.',
    why: 'Most battery fires begin with one faulty cell. Catching the early signs gives owners time to act.',
    how: 'Voltrace compares every cell with its own siblings using an Isolation Forest model plus rule thresholds from battery-safety literature, and names the suspect cell.',
    example: 'Cell 11 rests 68 mV lower than the others, sags more under load and is 5 °C warmer — Voltrace flags RED and names cell 11.',
  },
  {
    id: 'cell-voltage', title: 'Cell voltage', group: 'Battery basics', art: 'cells',
    summary: 'The voltage of each individual cell — siblings should match closely.',
    simple: 'Every cell has its own voltage. In a healthy, balanced pack all cells sit within a few millivolts (thousandths of a volt) of each other when resting.',
    why: 'A cell that rests noticeably lower than its siblings may be losing charge internally — a classic early sign of an internal short.',
    how: 'Voltrace measures each cell’s deviation from the pack median. A spread above 50 mV at rest is treated as abnormal.',
    example: '15 cells read 3.305 V and one reads 3.237 V. That 68 mV gap is a warning sign.',
  },
  {
    id: 'internal-resistance', title: 'Internal resistance', group: 'Health & safety', art: 'resistance',
    summary: 'How much a cell “resists” delivering current. It grows with age.',
    simple: 'Internal resistance is like friction inside the battery. As cells age, resistance rises, so more energy turns into heat and voltage drops further under load.',
    why: 'Rising resistance means less power, more heat and reduced capacity. A single cell with much higher resistance than its siblings is suspicious.',
    how: 'During the 20-second guided load test Voltrace calculates resistance as R = ΔV ÷ ΔI (voltage drop divided by current change).',
    example: 'Voltage falls 0.37 V when 30 A is drawn: R = 0.37 ÷ 30 ≈ 12 mΩ for the pack.',
  },
  {
    id: 'voltage-sag', title: 'Voltage sag', group: 'Health & safety', art: 'sag',
    summary: 'The dip in voltage when a load is switched on.',
    simple: 'When you switch on a motor, the battery voltage dips for a moment — that dip is voltage sag. When the load is removed, voltage recovers.',
    why: 'Old or damaged cells sag more and recover differently from healthy ones.',
    how: 'Voltrace asks you to switch on the vehicle’s load for 20 seconds and records how each cell sags and recovers.',
    example: 'Most cells drop 30 mV under load, but cell 11 drops 42 mV — 40% more than its siblings.',
  },
  {
    id: 'degradation', title: 'Battery degradation', group: 'Health & safety', art: 'fade',
    summary: 'Why batteries slowly lose capacity over time.',
    simple: 'Each charge cycle causes tiny chemical changes inside the cell that permanently reduce how much lithium can move. Heat, fast charging and deep discharges speed this up.',
    why: 'Degradation decides how long a battery lasts in a vehicle and how much it is worth second-hand.',
    how: 'Voltrace tracks SoH across scans so fleet owners can see each pack’s ageing trend and plan replacements.',
    example: 'An LFP pack may lose about 20% capacity after ~3,000 cycles; an NMC pack after ~1,000.',
  },
  {
    id: 'battery-fires', title: 'Lithium battery fires', group: 'Health & safety', art: 'fire',
    summary: 'How fires start and the warning signs that come before them.',
    simple: 'If a cell develops an internal short, it can heat itself. Above a critical temperature the chemistry can run away (“thermal runaway”), spreading to neighbouring cells.',
    why: 'E-rickshaw and scooter fires in India have caused deaths. Early warning signs such as self-discharge, heat and voltage drift often appear days or weeks before.',
    how: 'Voltrace screens for those early signs. It is a decision-support tool: it cannot guarantee a battery is safe or predict exactly when a fire may occur.',
    example: 'If a battery is flagged RED: stop charging it, park the vehicle outdoors away from buildings, and call a qualified technician.',
  },
  {
    id: 'xgboost', title: 'XGBoost', group: 'Voltrace AI', art: 'trees',
    summary: 'The machine-learning model Voltrace uses to estimate health.',
    simple: 'XGBoost combines hundreds of small decision trees. Each tree asks simple questions (“Is resistance above X?”) and corrects the mistakes of the trees before it. Together they make an accurate prediction.',
    why: 'Cheap BMS boards often over-report capacity. A model trained on real ageing data can correct that optimism.',
    how: 'Voltrace’s model was trained on the NASA Prognostics Center battery ageing dataset (25 cells) and tested on cells it had never seen: mean error 3.6 SoH points. It predicts a 90% confidence range, not just one number.',
    example: 'The BMS claims 91% capacity; XGBoost estimates 83% (72–91%) from resistance, sag and cycle data.',
  },
  {
    id: 'isolation-forest', title: 'Isolation Forest', group: 'Voltrace AI', art: 'forest',
    summary: 'An anomaly detector that finds the “odd one out” among cells.',
    simple: 'Isolation Forest randomly splits data again and again. Normal points hide in the crowd and need many splits to separate; unusual points get isolated in just a few. Fewer splits = more anomalous.',
    why: 'There is no big labelled dataset of battery fires. Isolation Forest does not need one — it just asks which cell behaves unlike its siblings.',
    how: 'Voltrace describes each cell by its deviation from the pack median (resting voltage, sag, temperature, drift) and scores how easily it is isolated, then combines this with rule thresholds.',
    example: 'Cell 11 is isolated after only a few splits (score 0.77, alert threshold 0.65), so it is flagged as an outlier.',
  },
  {
    id: 'battery-passport', title: 'Battery Passports', group: 'Trust & reuse', art: 'passport',
    summary: 'A digital, verifiable health record for a battery.',
    simple: 'A Battery Passport is a digital certificate that records a battery’s identity, health and safety status. Anyone can scan its QR code to check it.',
    why: 'The EU Battery Passport becomes mandatory in February 2027, and India’s draft Battery Pack Aadhaar (BPAN) needs health data. Buyers, lenders and insurers need records they can trust.',
    how: 'Voltrace creates a passport after each scan, signs it digitally and encodes it in a QR code that any phone can verify — even offline.',
    example: 'A buyer scans the QR on a used e-rickshaw pack and instantly sees “83% SoH, RED — cell 11 abnormal, verified”.',
  },
  {
    id: 'sha256', title: 'SHA-256', group: 'Trust & reuse', art: 'hash',
    summary: 'A digital fingerprint that changes if even one character changes.',
    simple: 'SHA-256 turns any data into a 64-character “fingerprint”. The same data always gives the same fingerprint, but changing even one digit gives a completely different one.',
    why: 'It makes tampering obvious: if anyone edits a passport, its fingerprint no longer matches.',
    how: 'Voltrace converts each passport into a standard JSON text, then computes its SHA-256 fingerprint before signing.',
    example: 'Changing SoH from 83.4 to 93.4 changes the fingerprint from 7f3a… to c01e… — verification fails.',
  },
  {
    id: 'digital-signatures', title: 'Digital signatures', group: 'Trust & reuse', art: 'signature',
    summary: 'Proof that a record was issued by Voltrace and has not changed.',
    simple: 'A digital signature is created with a secret private key that only the issuer holds. Anyone can check it with the matching public key, but nobody can forge it.',
    why: 'Without a signature, anyone could print a fake “healthy battery” certificate.',
    how: 'Voltrace signs each passport fingerprint with an Ed25519 private key kept on its server. The app and verification page hold only the public key.',
    example: 'The verification page shows VERIFIED when the signature matches, and INVALID if the record was altered.',
  },
  {
    id: 'second-life', title: 'Second-life batteries', group: 'Trust & reuse', art: 'secondlife',
    summary: 'Giving retired EV batteries a useful second job.',
    simple: 'When a battery no longer gives enough range for a vehicle (often around 70–80% SoH), it can still store energy for homes, shops or solar systems, where demands are gentler.',
    why: 'Second-life use delays recycling, saves resources and lowers the cost of energy storage — but only for packs that are graded reliably and pass safety checks.',
    how: 'Voltrace flags healthy-but-aged packs as candidates for second-life evaluation. A professional must still test them before reuse.',
    example: 'A scooter pack at 67% SoH with consistent cells could power an inverter for a small shop after proper testing.',
  },
]

export const topicById = (id: string) => TOPICS.find((t) => t.id === id)
