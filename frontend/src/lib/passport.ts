import { ed25519 } from '@noble/curves/ed25519'
import { sha256 } from '@noble/hashes/sha256'
import { deflateSync, inflateSync } from 'fflate'
import type { PassportPayload, ScanRecord, SignedPassport, VerifyResult } from '../types'
import { api } from './api'
import { b64url, canonicalJson, fromB64url, fromHex, fromUtf8, toHex, utf8 } from './canonical'
import { DEMO_KID, DEMO_PRIVATE_KEY_HEX } from './demoSigner'
import { BUILTIN_KEYS, type TrustedKey } from './trust'

export const METHOD_CODE = 'VT-M1'
export const METHODOLOGIES: Record<string, string> = {
  'VT-M1': 'Smart-BMS data + 20 s guided load test. SoH: XGBoost quantile regression trained on NASA PCoE ageing data (90% interval). Safety: Isolation Forest on per-cell deviations + rule thresholds.',
}

export function sha256Hex(payload: unknown) {
  return toHex(sha256(utf8(canonicalJson(payload))))
}

// ---------- trusted keys ----------
const KEY_CACHE = 'voltrace.keys.v1'
export function trustedKeys(): TrustedKey[] {
  let extra: TrustedKey[] = []
  try {
    extra = JSON.parse(localStorage.getItem(KEY_CACHE) ?? '[]')
  } catch { /* ignore */ }
  const map = new Map<string, TrustedKey>()
  for (const k of [...BUILTIN_KEYS, ...extra]) map.set(k.kid, k)
  return [...map.values()]
}
export async function refreshKeys() {
  const res = await api.keys()
  if (res?.keys?.length) {
    try { localStorage.setItem(KEY_CACHE, JSON.stringify(res.keys)) } catch { /* ignore */ }
  }
}

// ---------- build ----------
export function buildPayload(scan: ScanRecord): Omit<PassportPayload, 'pid' | 'iat' | 'iss' | 'kid'> {
  const r = scan.reading
  const d = scan.diagnosis
  const cells = r.cellsMv
  return {
    v: 1,
    bid: r.batteryId,
    demo: r.source === 'demo',
    src: r.source === 'demo' ? `demo-profile:${r.profileId ?? 'fleet'}` : `ble:${(r.protocol ?? 'bms').toLowerCase()}`,
    bat: { cat: r.category, chem: r.chemistry, cfg: `${r.seriesCells}S${r.parallel}P`, vn: r.nominalV, ah: r.ratedAh, cyc: r.cycles, veh: r.vehicleType },
    soh: { v: d.soh.value, lo: d.soh.low, hi: d.soh.high, m: d.soh.model },
    sos: { f: d.safety.flag, c: d.safety.suspectCell, m: d.safety.model, n: d.safety.findings[0]?.title ?? 'No abnormality identified' },
    cells: { n: cells.length, min: Math.min(...cells), max: Math.max(...cells), med: Math.round(d.safety.medianMv), spr: d.safety.spreadMv },
    use: d.usage,
    meth: METHOD_CODE,
  }
}

const ALPHA = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
function newPid() {
  const b = crypto.getRandomValues(new Uint8Array(8))
  const s = Array.from(b, (x) => ALPHA[x % ALPHA.length]).join('')
  return `VTP-${s.slice(0, 4)}-${s.slice(4)}`
}

/** Sign with the backend issuer key; fall back to the labelled offline demo key if allowed. */
export async function issuePassport(scan: ScanRecord, allowOfflineDemo: boolean): Promise<SignedPassport | { error: string }> {
  const base = buildPayload(scan)
  const server = await api.issuePassport(base)
  if (server) {
    if (!trustedKeys().some((k) => k.kid === server.payload.kid)) await refreshKeys()
    return { payload: server.payload, hash: server.hash, sig: server.sig, scanId: scan.id, signer: 'server' }
  }
  if (!allowOfflineDemo) return { error: 'The Voltrace signing service is unreachable and offline demo signing is disabled in Settings.' }
  const payload: PassportPayload = {
    ...base,
    pid: newPid(),
    iat: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    iss: 'Voltrace Demo Issuer (offline key)',
    kid: DEMO_KID,
  }
  const hash = sha256Hex(payload)
  const sig = toHex(ed25519.sign(fromHex(hash), fromHex(DEMO_PRIVATE_KEY_HEX)))
  return { payload, hash, sig, scanId: scan.id, signer: 'demo-offline' }
}

// ---------- QR encoding ----------
export function publicBase(custom?: string) {
  const env = import.meta.env?.VITE_PUBLIC_URL as string | undefined
  const b = (custom?.trim() || env || window.location.href.split('#')[0]).replace(/#.*$/, '')
  return b
}

export function encodeToken(p: { payload: PassportPayload; hash: string; sig: string }) {
  const body = b64url(deflateSync(utf8(canonicalJson(p.payload)), { level: 9 }))
  return `${body}.${b64url(fromHex(p.hash))}.${b64url(fromHex(p.sig))}`
}

export function verifyUrl(p: { payload: PassportPayload; hash: string; sig: string }, base?: string) {
  return `${publicBase(base)}#/v/${encodeToken(p)}`
}

export function decodeToken(token: string): { payload: PassportPayload; hash: string; sig: string } | null {
  try {
    const [body, h, s] = token.trim().split('.')
    if (!body || !h || !s) return null
    const payload = JSON.parse(fromUtf8(inflateSync(fromB64url(body)))) as PassportPayload
    return { payload, hash: toHex(fromB64url(h)), sig: toHex(fromB64url(s)) }
  } catch {
    return null
  }
}

/** Extract a token or passport id from anything a QR / user might give us. */
export function parseVerificationInput(text: string): { token?: string; pid?: string } {
  const t = text.trim()
  const m = t.match(/#\/v\/([A-Za-z0-9_\-.]+)/)
  if (m) return { token: m[1] }
  if (/^[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{40,}$/.test(t)) return { token: t }
  const pid = t.toUpperCase().replace(/\s+/g, '').match(/VTP-?[2-9A-HJ-NP-Z]{4}-?[2-9A-HJ-NP-Z]{4}/)
  if (pid) {
    const raw = pid[0].replace(/-/g, '')
    return { pid: `VTP-${raw.slice(3, 7)}-${raw.slice(7, 11)}` }
  }
  return {}
}

// ---------- verification ----------
export function verifySigned(p: { payload: PassportPayload; hash?: string; sig: string }): VerifyResult {
  const key = trustedKeys().find((k) => k.kid === p.payload?.kid)
  if (!p.payload || typeof p.payload !== 'object') return { status: 'UNAVAILABLE', reason: 'The passport record could not be read.' }
  if (!key) return { status: 'UNAVAILABLE', reason: `The issuer key "${p.payload.kid}" is not in the trusted registry.`, payload: p.payload }
  const computed = sha256Hex(p.payload)
  if (p.hash && p.hash !== computed) {
    return { status: 'INVALID', reason: 'The record has been changed: its SHA-256 fingerprint no longer matches the fingerprint that was signed.', payload: p.payload, computedHash: computed, claimedHash: p.hash, issuer: key.issuer, demoKey: key.demo }
  }
  let ok = false
  try {
    ok = ed25519.verify(fromHex(p.sig), fromHex(computed), fromHex(key.pub))
  } catch { ok = false }
  return ok
    ? { status: 'VERIFIED', reason: 'The Ed25519 digital signature is valid for this exact record.', payload: p.payload, computedHash: computed, claimedHash: p.hash ?? computed, issuer: key.issuer, demoKey: key.demo }
    : { status: 'INVALID', reason: 'The passport signature does not match the record.', payload: p.payload, computedHash: computed, claimedHash: p.hash, issuer: key.issuer, demoKey: key.demo }
}

export const USAGE_TEXT: Record<PassportPayload['use'], string> = {
  CONTINUE: 'Continue in vehicle, subject to normal inspection',
  INSPECT: 'Professional inspection recommended',
  SECOND_LIFE: 'Evaluate for stationary second-life use after appropriate testing',
  RECYCLE: 'Remove from service; refer to an authorised battery recycler after inspection',
}
