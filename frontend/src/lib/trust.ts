/**
 * Trusted issuer registry used for offline verification. Public keys only.
 * Additional keys are fetched from GET /api/keys at runtime and cached.
 */
export interface TrustedKey { kid: string; pub: string; issuer: string; demo: boolean }

export const BUILTIN_KEYS: TrustedKey[] = [
  { kid: 'vt-srv-2026-01', pub: '1185374b4f8fce62897042bbbe5907eba7ad499c9a06d87dc916d8bc6cb15bfb', issuer: 'Voltrace Issuer (server)', demo: false },
  { kid: 'vt-demo-offline', pub: '49b42028b798d2f9dd2de2dfd068dc1c6c3dfc14bab2a05496e1770f05a8804d', issuer: 'Voltrace Demo Issuer (offline key)', demo: true },
]
