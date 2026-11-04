/**
 * OFFLINE DEMONSTRATION SIGNER — NOT FOR PRODUCTION TRUST.
 *
 * Production passports are signed by the FastAPI service; that private key never
 * leaves the backend (backend/keys/issuer_ed25519.pem). So that the competition demo
 * still works when no backend is reachable, the app can fall back to this separate,
 * publicly-known demonstration key (kid "vt-demo-offline"). Passports signed with it
 * are always labelled "Demo key" during verification and can be disabled in Settings.
 */
export const DEMO_KID = 'vt-demo-offline'
export const DEMO_PRIVATE_KEY_HEX = '639431d940caa4b52ca05a459e18093051201084c29679f8dca84b532a248e25'
