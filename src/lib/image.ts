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
 * 画像の実サイズ（幅 px）を測る。読めない・空 URL なら null。
 *
 * 幅を「原寸」にしているプリセットでも、名前ラベルの行揃えには**数値の幅**が要る
 * （CSS からは `content: url(...)` で描いた画像の実寸を参照できない）。そこでアプリ側で測り、
 * 出力CSSに焼き込むために使う。
 */
export async function measureNaturalWidth(
  url: string,
  timeoutMs = 8000,
): Promise<number | null> {
  if (!url) return null
  try {
    // 応答しないホストだと onload / onerror のどちらも来ないので、待ち続けない。
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs))
    const img = await Promise.race([loadImage(url), timeout])
    return img ? img.naturalWidth || null : null
  } catch {
    return null
  }
}

/**
 * data URI（または画像として読める URL）を `maxWidth` に収まるよう canvas で縮小して data URI を返す。
 * リサイズ不要（未指定 / 既に収まっている）なら入力をそのまま返す。
 * アップロード経路（{@link fileToDataUri}）と URL→dataURI 変換経路（imageSource）で共用する。
 */
export async function resizeDataUri(
  dataUrl: string,
  options: ResizeOptions = {},
): Promise<string> {
  const { maxWidth, mimeType = 'image/png', quality = 0.92 } = options
  if (!maxWidth || maxWidth <= 0) {
    return dataUrl
  }

  const img = await loadImage(dataUrl)
  const target = computeResizeDimensions(
    { width: img.naturalWidth, height: img.naturalHeight },
    maxWidth,
  )
  if (target.width === img.naturalWidth && target.height === img.naturalHeight) {
    return dataUrl
  }

  const canvas = document.createElement('canvas')
  canvas.width = target.width
  canvas.height = target.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  ctx.drawImage(img, 0, 0, target.width, target.height)
  return canvas.toDataURL(mimeType, quality)
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
  return resizeDataUri(original, options)
}
