/** テキストを .css ファイルとしてダウンロードさせる。 */
export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/css;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** クリップボードにコピー。フォールバックで execCommand も試す。 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  } catch {
    return false
  }
}

/** 表示名 or ID から安全な css ファイル名を作る（日本語などの Unicode 文字は残す）。 */
export function cssFilename(nameOrId: string): string {
  const base =
    nameOrId
      .trim()
      .replace(/[^\p{L}\p{N}._-]+/gu, '_')
      .replace(/^_+|_+$/g, '') || 'streamkit'
  return `streamkit-${base}.css`
}
