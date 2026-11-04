import type { PassportPayload, SohFeatures } from '../types'
import type { TrustedKey } from './trust'

/**
 * Client for the Voltrace FastAPI service. Base URL comes from VITE_API_BASE
 * (default: same origin, proxied to :8000 by Vite in development).
 * Every call fails soft (returns null) so the app keeps working offline.
 */
const BASE = (import.meta.env?.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ?? ''

async function call<T>(path: string, init?: RequestInit, timeoutMs = 4000): Promise<T | null> {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const res = await fetch(`${BASE}${path}`, { ...init, signal: ctl.signal, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } })
    if (!res.ok) return null
    const ct = res.headers.get('content-type') ?? ''
    if (!ct.includes('application/json')) return null // static host returned index.html
    return (await res.json()) as T
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

export interface Health { ok: boolean; store: string; kid: string; models: { soh: string; safety: string } }

let healthCache: { at: number; value: Health | null } | null = null

export const api = {
  base: BASE || '(same origin)',
  async health(force = false) {
    if (!force && healthCache && Date.now() - healthCache.at < 15000) return healthCache.value
    const value = await call<Health>('/api/health', undefined, 2500)
    healthCache = { at: Date.now(), value: value?.ok ? value : null }
    return healthCache.value
  },
  keys: () => call<{ keys: TrustedKey[] }>('/api/keys'),
  modelCard: () => call<Record<string, unknown>>('/api/model-card'),
  diagnose: async (features: SohFeatures, cells: number[][]) => {
    if (!(await api.health())) return null
    return call<{ soh: { p05: number; p50: number; p95: number; model: string }; safety: { cells: { score: number }[]; model: string } }>(
      '/api/diagnose',
      { method: 'POST', body: JSON.stringify({ soh_features: features, cells }) },
    )
  },
  issuePassport: async (payload: Omit<PassportPayload, 'pid' | 'iat' | 'iss' | 'kid'>) => {
    if (!(await api.health())) return null
    return call<{ pid: string; payload: PassportPayload; hash: string; sig: string; kid: string }>(
      '/api/passports',
      { method: 'POST', body: JSON.stringify({ payload }) },
      8000,
    )
  },
  getPassport: (pid: string) => call<{ payload: PassportPayload; hash: string; sig: string; kid: string }>(`/api/passports/${encodeURIComponent(pid)}`),
}
