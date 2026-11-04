// Renders the brand mark to every icon/splash asset (PWA + Android). Run: npx tsx scripts/gen-icons.ts
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'
import { readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { markSvg } from '../src/lib/brand'
const { chromium } = createRequire(import.meta.url)('playwright') // globally installed in this environment

const root = new URL('..', import.meta.url).pathname
writeFileSync(join(root, 'public/icons/logo.svg'), markSvg('fav'))
const res = join(root, 'android/app/src/main/res')
const bg = '#F8FAFC'

const browser = await chromium.launch()
const page = await browser.newPage()
async function render(file: string, w: number, h: number, body: string, transparent = false) {
  await page.setViewportSize({ width: w, height: h })
  await page.setContent(`<html><body style="margin:0;width:${w}px;height:${h}px;overflow:hidden;background:${transparent ? 'transparent' : bg}">${body}</body></html>`)
  await page.screenshot({ path: file, omitBackground: transparent })
}
const tile = (size: number, opts: { bleed?: boolean; round?: boolean; pad?: number } = {}) => {
  const pad = opts.pad ?? 0
  const s = size - pad * 2
  return `<div style="position:absolute;left:${pad}px;top:${pad}px;width:${s}px;height:${s}px;${opts.round ? 'border-radius:50%;overflow:hidden;' : ''}">${markSvg('i', { bleed: opts.bleed || opts.round }).replace('<svg ', `<svg width="${s}" height="${s}" `)}</div>`
}
// PWA
await render(join(root, 'public/icons/icon-192.png'), 192, 192, tile(192, { pad: 4 }), true)
await render(join(root, 'public/icons/icon-512.png'), 512, 512, tile(512, { pad: 10 }), true)
// maskable: full bleed tile, content already within the 80% safe zone
await render(join(root, 'public/icons/maskable-512.png'), 512, 512, tile(512, { bleed: true }))
await render(join(root, 'public/icons/apple-touch-icon.png'), 180, 180, tile(180, { bleed: true }))
// Android launcher icons
const dens: [string, number][] = [['mdpi', 48], ['hdpi', 72], ['xhdpi', 96], ['xxhdpi', 144], ['xxxhdpi', 192]]
for (const [d, px] of dens) {
  const dir = join(res, `mipmap-${d}`)
  await render(join(dir, 'ic_launcher.png'), px, px, tile(px, { pad: Math.round(px * 0.04) }), true)
  await render(join(dir, 'ic_launcher_round.png'), px, px, tile(px, { round: true, pad: Math.round(px * 0.04) }), true)
  const fg = Math.round((px * 108) / 48)
  await render(join(dir, 'ic_launcher_foreground.png'), fg, fg, tile(fg, { bleed: true }))
}
// Android splash screens: keep each existing size
for (const dir of readdirSync(res).filter((d) => d.startsWith('drawable'))) {
  const file = join(res, dir, 'splash.png')
  let dims = ''
  try { dims = execSync(`python3 -c "from PIL import Image;print(*Image.open('${file}').size)"`).toString().trim() } catch { continue }
  const [w, h] = dims.split(' ').map(Number)
  const m = Math.round(Math.min(w, h) * 0.26)
  await render(file, w, h, `<div style="position:absolute;left:${(w - m) / 2}px;top:${(h - m) / 2}px">${tile(m)}</div>`)
}
await browser.close()
console.log('icons generated')
