/** Deterministic PRNG so every demo battery is reproducible. */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function seeded(seed: number) {
  const r = mulberry32(seed)
  const gauss = (mu = 0, sigma = 1) => {
    const u = Math.max(r(), 1e-9)
    const v = r()
    return mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }
  return { next: r, gauss, pick: <T,>(a: T[]) => a[Math.floor(r() * a.length)] }
}

export function hashString(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b)
  const n = s.length
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2
}

export const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / Math.max(v.length, 1)
export const round = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
