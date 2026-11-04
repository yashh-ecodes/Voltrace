/**
 * Voltrace brand mark — single source of truth (vector redraw of the supplied logo).
 * Glass tile with blue→green scan brackets around a navy battery with a gradient bolt.
 * Used by the app UI, the PDF passport, the QR centre, and the PWA / Android icons.
 */
export const BRAND = {
  navy: '#0F2A4A',
  blue: '#2F6BF2',
  cyan: '#38BDF8',
  teal: '#14C9A8',
  green: '#22D69A',
  tagline: 'Know Your Battery. Trust Its Future.',
}

/** @param p unique id prefix (required when several marks share a page) */
export function markSvg(p = 'vt', opts: { tile?: boolean; bleed?: boolean } = {}) {
  const tile = opts.tile ?? true
  const r = opts.bleed ? 0 : 28
  const tileSvg = tile
    ? `<clipPath id="${p}c"><rect width="120" height="120" rx="${r}"/></clipPath>
  <g clip-path="url(#${p}c)">
    <rect width="120" height="120" fill="url(#${p}bg)"/>
    <path d="M-8 76 C 16 68, 44 84, 56 106 L 60 128 L -8 128 Z" fill="url(#${p}wave)" opacity=".78"/>
    <path d="M-8 96 C 22 90, 42 104, 48 128 L -8 128 Z" fill="${BRAND.cyan}" opacity=".28"/>
    <ellipse cx="106" cy="10" rx="34" ry="28" fill="${BRAND.cyan}" opacity=".14"/>
    <path d="M58 -6 C 84 10, 96 30, 128 34 L128 -6 Z" fill="#fff" opacity=".45"/>
  </g>
  ${opts.bleed ? '' : `<rect x=".75" y=".75" width="118.5" height="118.5" rx="${r - 0.75}" fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="1.5"/>`}`
    : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <defs>
    <linearGradient id="${p}bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".55" stop-color="#F2F8FF"/><stop offset="1" stop-color="#E4F2FF"/></linearGradient>
    <linearGradient id="${p}wave" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${BRAND.green}"/><stop offset="1" stop-color="${BRAND.cyan}"/></linearGradient>
    <linearGradient id="${p}br" gradientUnits="userSpaceOnUse" x1="24" y1="24" x2="96" y2="96"><stop offset="0" stop-color="${BRAND.blue}"/><stop offset=".45" stop-color="${BRAND.cyan}"/><stop offset="1" stop-color="${BRAND.green}"/></linearGradient>
    <linearGradient id="${p}bolt" gradientUnits="userSpaceOnUse" x1="54" y1="45" x2="64" y2="78"><stop offset="0" stop-color="#1D4ED8"/><stop offset=".55" stop-color="#1E40AF"/><stop offset="1" stop-color="#0E9F8E"/></linearGradient>
    <radialGradient id="${p}glow" cx=".5" cy=".55" r=".6"><stop offset="0" stop-color="${BRAND.teal}" stop-opacity=".22"/><stop offset="1" stop-color="${BRAND.teal}" stop-opacity="0"/></radialGradient>
  </defs>
  ${tileSvg}
  <g fill="none" stroke="url(#${p}br)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
    <path d="M26 46 V36 Q26 26 36 26 H46"/>
    <path d="M74 26 H84 Q94 26 94 36 V46"/>
    <path d="M26 74 V84 Q26 94 36 94 H46"/>
    <path d="M94 74 V84 Q94 94 84 94 H74"/>
  </g>
  <rect x="48" y="39" width="24" height="44" rx="6" fill="url(#${p}glow)"/>
  <rect x="48" y="39" width="24" height="44" rx="6" fill="none" stroke="${BRAND.navy}" stroke-width="4.2"/>
  <rect x="54.5" y="33.5" width="11" height="6" rx="1.6" fill="none" stroke="${BRAND.navy}" stroke-width="3.2"/>
  <path d="M64 45 L51.8 63.8 H59.2 L56 77.5 L68.6 57.8 H61 Z" fill="url(#${p}bolt)" stroke="${BRAND.navy}" stroke-width="1.1" stroke-linejoin="round"/>
</svg>`
}

/** The distinctive crossbar-less "A" with its teal triangle, as SVG paths in a 78×72 box. */
export const A_GLYPH = {
  outline: 'M0 72 L31 0 H47 L78 72 H62.5 L39 17 L15.5 72 Z',
  notch: 'M24.5 72 L37.5 44 L46 66 Z',
}

/** Browser-only: render mark + logotype to a PNG data URL (used in the PDF header). */
export async function brandLockupPng(scale = 4): Promise<{ url: string; w: number; h: number }> {
  const H = 48
  const W = 220
  const c = document.createElement('canvas')
  c.width = W * scale
  c.height = H * scale
  const ctx = c.getContext('2d')!
  ctx.scale(scale, scale)
  const img = new Image()
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markSvg('pdf'))}`
  await img.decode()
  ctx.drawImage(img, 0, 0, H, H)
  try { await document.fonts.load('600 30px "Outfit Variable"') } catch { /* fallback font */ }
  const cap = 17
  const fs = cap / 0.7
  ctx.font = `600 ${fs}px "Outfit Variable", Outfit, "Inter Variable", sans-serif`
  ctx.fillStyle = BRAND.navy
  ctx.textBaseline = 'alphabetic'
  const base = H / 2 + cap / 2
  const track = fs * 0.035
  let x = H + 14
  const draw = (t: string) => { for (const ch of t) { ctx.fillText(ch, x, base); x += ctx.measureText(ch).width + track } }
  draw('VOLTR')
  const aw = (cap * 78) / 72
  ctx.save()
  ctx.translate(x, base - cap)
  ctx.scale(cap / 72, cap / 72)
  ctx.fillStyle = BRAND.navy
  ctx.fill(new Path2D(A_GLYPH.outline))
  ctx.fillStyle = BRAND.teal
  ctx.fill(new Path2D(A_GLYPH.notch))
  ctx.restore()
  x += aw + track * 2
  draw('CE')
  return { url: c.toDataURL('image/png'), w: W, h: H }
}
