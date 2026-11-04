import QRCode from 'qrcode'
import type { SignedPassport } from '../types'
import { METHODOLOGIES, USAGE_TEXT, verifyUrl } from './passport'
import { brandLockupPng } from './brand'

const INK: [number, number, number] = [23, 43, 77]
const MUTED: [number, number, number] = [100, 116, 139]
const LINE: [number, number, number] = [226, 232, 240]
const TEAL: [number, number, number] = [20, 184, 166]
const FLAG: Record<string, { fg: [number, number, number]; bg: [number, number, number]; label: string }> = {
  GREEN: { fg: [21, 128, 61], bg: [236, 253, 243], label: 'GREEN — No significant abnormality identified' },
  AMBER: { fg: [180, 83, 9], bg: [255, 248, 235], label: 'AMBER — Abnormal behaviour; inspection recommended' },
  RED: { fg: [185, 28, 28], bg: [254, 242, 242], label: 'RED — Significant abnormality; prompt inspection required' },
}

/** Build a printable A4 passport PDF (vector text + QR image). */
export async function passportPdf(p: SignedPassport, baseUrl?: string): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const P = p.payload
  const url = verifyUrl(p, baseUrl)
  const W = 210
  const M = 16

  // header: brand lockup (vector logo rasterised at 4x)
  try {
    const logo = await brandLockupPng()
    const lh = 13
    doc.addImage(logo.url, 'PNG', M, 13, (logo.w / logo.h) * lh, lh)
  } catch {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.setTextColor(...INK)
    doc.text('VOLTRACE', M, 22)
  }
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...MUTED)
  doc.text('Know Your Battery. Trust Its Future.', M, 30.5)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  doc.text('DIGITAL BATTERY PASSPORT', W - M, 18, { align: 'right' })
  doc.setFontSize(13)
  doc.setTextColor(...INK)
  doc.text(P.pid, W - M, 24.5, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...MUTED)
  doc.text(`Issued ${new Date(P.iat).toUTCString().replace('GMT', 'UTC')}`, W - M, 29, { align: 'right' })
  doc.setDrawColor(...LINE)
  doc.line(M, 35, W - M, 35)

  let y = 41
  if (P.demo) {
    doc.setFillColor(255, 248, 235)
    doc.setDrawColor(253, 230, 138)
    doc.roundedRect(M, y, W - 2 * M, 10, 2, 2, 'FD')
    doc.setTextColor(180, 83, 9)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.text('DEMONSTRATION PASSPORT — generated from simulated battery data. Not a real battery assessment.', W / 2, y + 6.2, { align: 'center' })
    y += 15
  }

  // battery id
  doc.setTextColor(...MUTED)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Battery ID (BPAN / temporary Voltrace ID)', M, y + 3)
  doc.setTextColor(...INK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text(P.bid, M, y + 12)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...MUTED)
  doc.text(`${P.bat.cat} · ${P.bat.veh}`, M, y + 18)
  y += 26

  // three summary boxes
  const bw = (W - 2 * M - 8) / 3
  const box = (x: number, title: string, big: string, sub: string, fg: [number, number, number], bg: [number, number, number]) => {
    doc.setFillColor(...bg)
    doc.roundedRect(x, y, bw, 30, 3, 3, 'F')
    doc.setTextColor(...MUTED)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.text(title.toUpperCase(), x + 5, y + 7)
    doc.setTextColor(...fg)
    doc.setFontSize(big.length > 8 ? 13 : 20)
    doc.text(big, x + 5, y + 17.5)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...MUTED)
    doc.text(doc.splitTextToSize(sub, bw - 10), x + 5, y + 23.5)
  }
  const f = FLAG[P.sos.f]
  box(M, 'State of Health', `${P.soh.v.toFixed(1)}%`, `90% range ${P.soh.lo.toFixed(0)}–${P.soh.hi.toFixed(0)}%`, [15, 118, 110], [230, 247, 244])
  box(M + bw + 4, 'State of Safety', P.sos.f, P.sos.c ? `Suspect cell ${P.sos.c}` : 'No suspect cell', f.fg, f.bg)
  const useShort = { CONTINUE: 'Continue', INSPECT: 'Inspect', SECOND_LIFE: 'Second life', RECYCLE: 'Remove' }[P.use]
  box(M + 2 * (bw + 4), 'Recommended use', useShort, USAGE_TEXT[P.use], [29, 78, 216], [234, 243, 255])
  y += 38

  // left column table
  const colW = 108
  const rows: [string, string][] = [
    ['Category', P.bat.cat],
    ['Chemistry / configuration', `${P.bat.chem} · ${P.bat.cfg}`],
    ['Nominal voltage', `${P.bat.vn} V`],
    ['Rated capacity', `${P.bat.ah} Ah`],
    ['Cycle count', `${P.bat.cyc}`],
    ['State of Health', `${P.soh.v.toFixed(1)}% (90% range ${P.soh.lo}–${P.soh.hi}%)`],
    ['Safety status', f.label],
    ['Primary finding', P.sos.n],
    ['Cells', `${P.cells.n} cells · min ${(P.cells.min / 1000).toFixed(3)} V · max ${(P.cells.max / 1000).toFixed(3)} V`],
    ['Cell spread / median', `${P.cells.spr} mV / ${(P.cells.med / 1000).toFixed(3)} V`],
    ['Recommended usage', USAGE_TEXT[P.use]],
    ['Data source', P.src],
    ['SoH model', P.soh.m],
    ['Safety model', P.sos.m],
  ]
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...INK)
  doc.text('Battery record', M, y)
  let ty = y + 4
  for (const [k, v] of rows) {
    const lines = doc.splitTextToSize(v, colW - 50)
    const h = Math.max(6.4, lines.length * 3.6 + 2.8)
    doc.setDrawColor(...LINE)
    doc.line(M, ty + h, M + colW, ty + h)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.2)
    doc.setTextColor(...MUTED)
    doc.text(k, M, ty + 4.3)
    doc.setTextColor(...INK)
    doc.setFont('helvetica', 'bold')
    doc.text(lines, M + 48, ty + 4.3)
    ty += h
  }

  // QR column
  const qx = M + colW + 10
  const qw = W - M - qx
  const qr = await QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 1, width: 480, color: { dark: '#172B4D', light: '#FFFFFF' } })
  doc.setDrawColor(...LINE)
  doc.roundedRect(qx, y - 4, qw, qw + 24, 3, 3, 'S')
  doc.addImage(qr, 'PNG', qx + 4, y, qw - 8, qw - 8)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(...INK)
  doc.text('Scan to verify', qx + qw / 2, y + qw - 1, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...MUTED)
  doc.text(doc.splitTextToSize(`Or enter code ${P.pid} in the Voltrace app → Verify`, qw - 8), qx + qw / 2, y + qw + 4, { align: 'center' })
  doc.setFillColor(230, 247, 244)
  doc.roundedRect(qx + 4, y + qw + 9.5, qw - 8, 7, 2, 2, 'F')
  doc.setTextColor(15, 118, 110)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.text(p.signer === 'server' ? 'Signed · Voltrace issuer key' : 'Signed · offline DEMO key', qx + qw / 2, y + qw + 14, { align: 'center' })

  y = Math.max(ty, y + qw + 24) + 8
  // methodology
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...INK)
  doc.text('Diagnostic methodology', M, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.2)
  doc.setTextColor(...MUTED)
  const meth = doc.splitTextToSize(METHODOLOGIES[P.meth] ?? P.meth, W - 2 * M)
  doc.text(meth, M, y + 5)
  y += 6 + meth.length * 3.6 + 4

  // verification block
  doc.setFillColor(248, 250, 252)
  doc.roundedRect(M, y, W - 2 * M, 31, 3, 3, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...INK)
  doc.text('Cryptographic verification', M + 5, y + 6.5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...MUTED)
  doc.text(`Issuer: ${P.iss}   ·   Key ID: ${P.kid}   ·   Algorithm: SHA-256 + Ed25519`, M + 5, y + 11.5)
  doc.setFont('courier', 'normal')
  doc.setFontSize(7.2)
  doc.setTextColor(...INK)
  doc.text(`SHA-256  ${p.hash}`, M + 5, y + 17.5)
  const sig = doc.splitTextToSize(`Ed25519  ${p.sig}`, W - 2 * M - 10)
  doc.text(sig, M + 5, y + 23)
  y += 36

  // footer
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...MUTED)
  const disc = doc.splitTextToSize('Voltrace is a prototype screening and decision-support tool. This passport is not a certified battery safety assessment, does not guarantee that a battery is safe and cannot predict a fire. Any change to the recorded data invalidates the digital signature. Field mapping to India BPAN dynamic data and EU Battery Regulation 2023/1542 Art. 77 (State of Health) is indicative.', W - 2 * M)
  doc.text(disc, M, Math.min(Math.max(y, 268), 284))
  doc.setDrawColor(...TEAL)
  doc.setLineWidth(1.2)
  doc.line(0, 296, W, 296)
  return doc.output('blob')
}
