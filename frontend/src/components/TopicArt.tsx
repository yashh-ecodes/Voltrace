import type { ArtKind } from '../data/learn'

const B = '#3B82F6'
const T = '#14B8A6'
const I = '#172B4D'
const R = '#EF4444'
const A = '#F59E0B'
const L = '#CBD5E1'

/** Simple explanatory illustrations for Learn topics (viewBox 200x120). */
export function TopicArt({ kind, className }: { kind: ArtKind; className?: string }) {
  return (
    <svg viewBox="0 0 200 120" className={className} aria-hidden>
      <rect width="200" height="120" rx="16" fill="#F4F8FF" />
      {ART[kind]}
    </svg>
  )
}

const cellsRow = (n: number, bad?: number, y = 38) =>
  Array.from({ length: n }).map((_, i) => (
    <g key={i}>
      <rect x={28 + i * 19} y={y} width="14" height="44" rx="4" fill="#fff" stroke={i === bad ? R : L} strokeWidth="1.5" />
      <rect x={30 + i * 19} y={y + (i === bad ? 22 : 10)} width="10" height={i === bad ? 20 : 32} rx="3" fill={i === bad ? R : T} opacity=".85" />
    </g>
  ))

const ART: Record<ArtKind, React.ReactNode> = {
  cell: (
    <g>
      <rect x="70" y="20" width="60" height="84" rx="10" fill="#fff" stroke={L} strokeWidth="2" />
      <rect x="88" y="12" width="24" height="10" rx="3" fill={L} />
      <rect x="78" y="30" width="18" height="66" rx="5" fill={B} opacity=".25" />
      <rect x="104" y="30" width="18" height="66" rx="5" fill={T} opacity=".25" />
      {[44, 58, 72].map((y) => <circle key={y} cx="96" cy={y} r="3.5" fill={B}><animate attributeName="cx" values="88;112;88" dur="3s" repeatCount="indefinite" begin={`${y / 40}s`} /></circle>)}
      <text x="40" y="66" fontSize="20" fontWeight="700" fill={B}>−</text>
      <text x="150" y="66" fontSize="20" fontWeight="700" fill={T}>+</text>
    </g>
  ),
  bms: (
    <g>
      {cellsRow(4, undefined, 52)}
      <rect x="110" y="30" width="66" height="56" rx="8" fill={I} />
      {[40, 52, 64, 76].map((y) => <rect key={y} x="118" y={y} width="20" height="4" rx="2" fill="#fff" opacity=".4" />)}
      <circle cx="160" cy="44" r="6" fill={T} />
      <path d="M152 70c4-6 12-6 16 0M156 75c2-3 6-3 8 0" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M100 58h10M100 74h10" stroke={L} strokeWidth="2" />
    </g>
  ),
  soh: (
    <g>
      <rect x="30" y="36" width="60" height="48" rx="8" fill="#fff" stroke={L} strokeWidth="2" />
      <rect x="34" y="40" width="52" height="40" rx="5" fill={T} />
      <text x="60" y="100" textAnchor="middle" fontSize="10" fill="#64748B">New · 100%</text>
      <path d="M98 60h10" stroke={L} strokeWidth="2" strokeDasharray="3 3" />
      <rect x="114" y="36" width="60" height="48" rx="8" fill="#fff" stroke={L} strokeWidth="2" />
      <rect x="118" y="47" width="52" height="33" rx="5" fill={T} opacity=".8" />
      <rect x="118" y="40" width="52" height="7" rx="3" fill="#E2E8F0" />
      <text x="144" y="100" textAnchor="middle" fontSize="10" fill="#64748B">Today · 84%</text>
    </g>
  ),
  soc: (
    <g>
      <path d="M50 92a50 50 0 0 1 100 0" stroke="#E2E8F0" strokeWidth="12" fill="none" strokeLinecap="round" />
      <path d="M50 92a50 50 0 0 1 86-35" stroke={B} strokeWidth="12" fill="none" strokeLinecap="round" />
      <text x="100" y="88" textAnchor="middle" fontSize="22" fontWeight="700" fill={I}>72%</text>
      <text x="100" y="108" textAnchor="middle" fontSize="10" fill="#64748B">charge right now</text>
    </g>
  ),
  shield: (
    <g>
      <path d="M100 16 140 30v28c0 24-17 40-40 46-23-6-40-22-40-46V30l40-14Z" fill="#fff" stroke={L} strokeWidth="2" />
      {[[T, 46], [A, 64], [R, 82]].map(([c, y]) => <circle key={y as number} cx="100" cy={y as number} r="7" fill={c as string} />)}
      <text x="150" y="50" fontSize="10" fill="#64748B">Green</text>
      <text x="150" y="68" fontSize="10" fill="#64748B">Amber</text>
      <text x="150" y="86" fontSize="10" fill="#64748B">Red</text>
    </g>
  ),
  cells: <g>{cellsRow(8, 5)}<text x="100" y="104" textAnchor="middle" fontSize="10" fill="#64748B">one cell rests lower than its siblings</text></g>,
  resistance: (
    <g>
      <path d="M30 60h30l6-12 10 24 10-24 10 24 10-24 10 24 6-12h38" stroke={I} strokeWidth="3" fill="none" strokeLinejoin="round" />
      <circle cx="30" cy="60" r="5" fill={B} />
      <circle cx="170" cy="60" r="5" fill={T} />
      <text x="100" y="98" textAnchor="middle" fontSize="13" fontWeight="600" fill={B}>R = ΔV ÷ ΔI</text>
    </g>
  ),
  sag: (
    <g>
      <path d="M24 40h40l4 26c10 6 30 8 46 10h16l4-24h42" stroke={B} strokeWidth="3" fill="none" />
      <path d="M24 40h40l4 40c10 4 30 6 46 8h16l4-30h42" stroke={R} strokeWidth="2.5" fill="none" strokeDasharray="4 3" />
      <rect x="64" y="96" width="70" height="6" rx="3" fill={L} />
      <text x="99" y="114" textAnchor="middle" fontSize="9" fill="#64748B">load on (20 s)</text>
    </g>
  ),
  fade: (
    <g>
      <path d="M26 96V20M26 96h150" stroke={L} strokeWidth="2" />
      <path d="M30 30c30 4 60 12 80 22s40 26 62 40" stroke={T} strokeWidth="3" fill="none" />
      <path d="M26 66h150" stroke={A} strokeDasharray="4 4" strokeWidth="1.5" />
      <text x="170" y="62" textAnchor="end" fontSize="9" fill={A}>80%</text>
      <text x="100" y="112" textAnchor="middle" fontSize="9" fill="#64748B">charge cycles →</text>
    </g>
  ),
  fire: (
    <g>
      {cellsRow(6, 3)}
      <path d="M93 34c-6-8 0-16 4-20 0 6 6 8 6 14 4-2 4-6 4-6 4 6 4 14-2 18" fill={A} opacity=".9" transform="translate(-5 -10)" />
      <text x="100" y="104" textAnchor="middle" fontSize="10" fill="#64748B">heat starts in one cell, then spreads</text>
    </g>
  ),
  trees: (
    <g>
      {[40, 100, 160].map((x, k) => (
        <g key={x}>
          <circle cx={x} cy="30" r="7" fill={B} />
          <path d={`M${x} 37l-16 20M${x} 37l16 20`} stroke={L} strokeWidth="2" />
          <circle cx={x - 16} cy="62" r="6" fill={T} />
          <circle cx={x + 16} cy="62" r="6" fill={k === 1 ? A : T} />
          <path d={`M${x + 16} 68l-8 14M${x + 16} 68l8 14`} stroke={L} strokeWidth="2" />
          <rect x={x + 2} y="84" width="12" height="10" rx="3" fill={I} opacity=".7" />
          <rect x={x + 18} y="84" width="12" height="10" rx="3" fill={I} opacity=".4" />
        </g>
      ))}
      <text x="70" y="110" fontSize="10" fill="#64748B">+</text>
      <text x="130" y="110" fontSize="10" fill="#64748B">+ … = SoH</text>
    </g>
  ),
  forest: (
    <g>
      {Array.from({ length: 22 }).map((_, i) => <circle key={i} cx={60 + ((i * 37) % 60)} cy={40 + ((i * 23) % 44)} r="3.5" fill={T} />)}
      <circle cx="160" cy="34" r="5" fill={R} />
      <path d="M140 18v84M124 52h70" stroke={B} strokeWidth="1.5" strokeDasharray="4 3" />
      <text x="160" y="22" textAnchor="middle" fontSize="9" fill={R}>isolated</text>
    </g>
  ),
  passport: (
    <g>
      <rect x="44" y="16" width="112" height="88" rx="10" fill="#fff" stroke={L} strokeWidth="2" />
      <rect x="54" y="26" width="46" height="6" rx="3" fill={B} />
      {[42, 54, 66].map((y) => <rect key={y} x="54" y={y} width="44" height="5" rx="2.5" fill="#E2E8F0" />)}
      <rect x="110" y="30" width="36" height="36" rx="4" fill={I} opacity=".85" />
      <rect x="116" y="36" width="10" height="10" rx="2" fill="#fff" />
      <rect x="130" y="50" width="10" height="10" rx="2" fill="#fff" />
      <circle cx="74" cy="88" r="9" fill={T} />
      <path d="m70 88 3 3 6-6" stroke="#fff" strokeWidth="2" fill="none" />
    </g>
  ),
  hash: (
    <g>
      <rect x="20" y="40" width="54" height="40" rx="8" fill="#fff" stroke={L} strokeWidth="2" />
      <text x="47" y="64" textAnchor="middle" fontSize="10" fill={I}>{'{data}'}</text>
      <path d="M78 60h20" stroke={B} strokeWidth="2" />
      <rect x="100" y="44" width="34" height="32" rx="8" fill={B} />
      <text x="117" y="64" textAnchor="middle" fontSize="9" fill="#fff" fontWeight="700">SHA</text>
      <path d="M138 60h10" stroke={B} strokeWidth="2" />
      <text x="150" y="56" fontSize="9" fill={I} fontFamily="monospace">7f3a…</text>
      <text x="150" y="70" fontSize="9" fill="#64748B" fontFamily="monospace">e91c…</text>
    </g>
  ),
  signature: (
    <g>
      <rect x="22" y="44" width="40" height="30" rx="6" fill={I} />
      <circle cx="42" cy="56" r="4" fill="#fff" />
      <rect x="40" y="58" width="4" height="9" rx="1" fill="#fff" />
      <text x="42" y="90" textAnchor="middle" fontSize="9" fill="#64748B">private key</text>
      <path d="M68 59h26" stroke={L} strokeWidth="2" />
      <path d="M100 66c8-14 14-14 16 0s10 10 16-6 10-6 14 4" stroke={B} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M152 59h10" stroke={L} strokeWidth="2" />
      <circle cx="176" cy="59" r="12" fill={T} />
      <path d="m170 59 4 4 8-8" stroke="#fff" strokeWidth="2.5" fill="none" />
    </g>
  ),
  secondlife: (
    <g>
      <rect x="22" y="44" width="54" height="34" rx="8" fill="#fff" stroke={L} strokeWidth="2" />
      <circle cx="34" cy="86" r="7" fill={I} />
      <circle cx="66" cy="86" r="7" fill={I} />
      <path d="M86 61c10-14 24-14 34 0" stroke={T} strokeWidth="2.5" fill="none" />
      <path d="m116 56 4 5-6 2" stroke={T} strokeWidth="2.5" fill="none" />
      <path d="M134 50 156 34l22 16v40h-44Z" fill="#fff" stroke={L} strokeWidth="2" />
      <rect x="146" y="62" width="20" height="22" rx="3" fill={T} opacity=".8" />
      <path d="m158 66-4 7h5l-3 7" stroke="#fff" strokeWidth="1.5" fill="none" />
    </g>
  ),
}
