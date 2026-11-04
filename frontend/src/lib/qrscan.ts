import jsQR from 'jsqr'

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> }

let detector: Detector | null | undefined
async function nativeDetector(): Promise<Detector | null> {
  if (detector !== undefined) return detector
  const BD = (window as unknown as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> } }).BarcodeDetector
  try {
    if (BD && (await BD.getSupportedFormats?.())?.includes('qr_code')) detector = new BD({ formats: ['qr_code'] })
    else detector = null
  } catch { detector = null }
  return detector
}

/** Decode a QR code from a canvas (native BarcodeDetector first, jsQR fallback). */
export async function decodeCanvas(canvas: HTMLCanvasElement): Promise<string | null> {
  const d = await nativeDetector()
  if (d) {
    try {
      const r = await d.detect(canvas)
      if (r[0]?.rawValue) return r[0].rawValue
    } catch { /* fall through */ }
  }
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  return jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' })?.data ?? null
}

/** Decode a QR from an uploaded image, trying several scales. */
export async function decodeFile(file: Blob): Promise<string | null> {
  const bmp = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  for (const target of [1200, 800, 1800, 500]) {
    const s = Math.min(1, target / Math.max(bmp.width, bmp.height))
    canvas.width = Math.round(bmp.width * s)
    canvas.height = Math.round(bmp.height * s)
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    const r = await decodeCanvas(canvas)
    if (r) return r
  }
  return null
}

export type CameraState = 'idle' | 'starting' | 'live' | 'denied' | 'nocamera' | 'unsupported' | 'error'

export async function openCamera(video: HTMLVideoElement): Promise<{ stream: MediaStream } | { error: CameraState; message: string }> {
  if (!navigator.mediaDevices?.getUserMedia) return { error: 'unsupported', message: 'Camera access needs a secure (HTTPS) connection and a browser that supports it.' }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
    video.srcObject = stream
    video.setAttribute('playsinline', 'true')
    await video.play()
    return { stream }
  } catch (e) {
    const n = (e as Error).name
    if (n === 'NotAllowedError' || n === 'SecurityError') return { error: 'denied', message: 'Camera permission was denied. Allow camera access for this site in your browser settings, or use image upload / code entry below.' }
    if (n === 'NotFoundError' || n === 'OverconstrainedError') return { error: 'nocamera', message: 'No camera was found on this device.' }
    return { error: 'error', message: (e as Error).message || 'The camera could not be started.' }
  }
}
