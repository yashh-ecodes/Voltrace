export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  }
}

/** Native share sheet when available (with the PDF attached if supported), else copy link. */
export async function shareLink(opts: { title: string; text: string; url: string; file?: Blob; filename?: string }): Promise<'shared' | 'copied' | 'cancelled'> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  try {
    if (opts.file && opts.filename && nav.canShare) {
      const file = new File([opts.file], opts.filename, { type: 'application/pdf' })
      if (nav.canShare({ files: [file] })) {
        await nav.share({ title: opts.title, text: `${opts.text}\n${opts.url}`, files: [file] })
        return 'shared'
      }
    }
    if (nav.share) {
      await nav.share({ title: opts.title, text: opts.text, url: opts.url })
      return 'shared'
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return 'cancelled'
  }
  await copyText(opts.url)
  return 'copied'
}
