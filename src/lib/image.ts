/**
 * 画像取り込み。File → data URI 化（任意で最大幅リサイズして CSS 肥大を抑える）。
 *
 * ブラウザAPI（FileReader / Image / canvas）に依存するのは `fileToDataUri` だけで、
 * 寸法計算 `computeResizeDimensions` は純粋関数として切り出し、単体テストの対象にする。
 */

export interface ResizeOptions {
  /** 最大幅(px)。未指定・0 以下ならリサイズしない。 */
  maxWidth?: number
  /** リサイズ時の出力形式。 */
  mimeType?: 'image/png' | 'image/jpeg' | 'image/webp'
  /** JPEG/WebP の品質(0–1)。 */
  quality?: number
}

export interface Dimensions {
  width: number
  height: number
}

/**
 * `maxWidth` を超える場合だけアスペクト比を保って縮小した寸法を返す純粋関数。
 * 拡大はしない。端数は四捨五入し、最低 1px を保証する。
 */
export function computeResizeDimensions(
  source: Dimensions,
  maxWidth?: number,
): Dimensions {
  const { width, height } = source
  if (!maxWidth || maxWidth <= 0 || width <= maxWidth) {
    return { width, height }
  }
  const scale = maxWidth / width
  return {
    width: maxWidth,
    height: Math.max(1, Math.round(height * scale)),
  }
}

/** ファイルサイズが上限を超えていないか（既定 8MB）。超えたら理由付きで false。 */
export function isWithinSizeLimit(file: File, maxBytes = 8 * 1024 * 1024): boolean {
  return file.size <= maxBytes
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('画像の読み込みに失敗しました'))
    reader.readAsDataURL(file)
  })
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('画像のデコードに失敗しました'))
    img.src = dataUrl
  })
}

/**
 * File を data URI に変換する。`maxWidth` を指定すると、それを超える画像だけ canvas で縮小して埋め込む。
 * リサイズ不要（未指定 / 収まっている）ならファイルをそのまま base64 化して原本を保つ。
 */
export async function fileToDataUri(
  file: File,
  options: ResizeOptions = {},
): Promise<string> {
  const original = await readAsDataUrl(file)
  const { maxWidth, mimeType = 'image/png', quality = 0.92 } = options

  if (!maxWidth || maxWidth <= 0) {
    return original
  }

  const img = await loadImage(original)
  const target = computeResizeDimensions(
    { width: img.naturalWidth, height: img.naturalHeight },
    maxWidth,
  )
  if (target.width === img.naturalWidth && target.height === img.naturalHeight) {
    return original
  }

  const canvas = document.createElement('canvas')
  canvas.width = target.width
  canvas.height = target.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return original
  ctx.drawImage(img, 0, 0, target.width, target.height)
  return canvas.toDataURL(mimeType, quality)
}
