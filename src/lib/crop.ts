/**
 * 立ち絵画像のクロップ（切り抜き）。
 *
 * **出力CSS は無改修。** 切り抜きは取り込み済みの data URI に対して canvas で焼き込み、
 * 結果の data URI で `Preset.imageUrl` を差し替える（＝`generateCss` から見ると
 * ただ画像が変わっただけ）。**破壊的で、やり直しは再取り込み**（原本を持つと localStorage が倍になる）。
 *
 * アンカー（003）は「画像の外形」を基準に寄せるので、**透明余白を含んだ画像ではアンカーが
 * 余白の分だけズレる**。透明余白の自動トリムはアンカーが意図どおり効くための前提であり、
 * このモジュールの主役。
 *
 * ブラウザAPI（Image / canvas）に依存するのは {@link cropDataUri} / {@link detectTrimRect} だけで、
 * **判断のいる部分は純粋関数に寄せて単体テストの対象にする**
 * （`image.ts` が `computeResizeDimensions` を切り出しているのと同じ方針）。
 */

import type { Dimensions } from './image'

/** 切り抜く矩形（画像のピクセル座標。左上が原点）。 */
export interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * 矩形を画像内に収まる整数矩形へ正規化する。**canvas に渡す前に必ず通す**
 * （`drawImage` は範囲外を透明で埋めるので、はみ出した矩形は黙って透明の帯を作る）。
 *
 * - 小数は切り捨て/切り上げではなく **四捨五入**（ドラッグ操作の見た目に一番近い）
 * - 負の幅・高さは向きを正す（右上から左下へドラッグしても同じ矩形になる）
 * - 画像の外へはみ出した分はクランプする
 * - **画像と交わらない矩形は `null`**（＝切り抜けない。呼び手が理由を出す）
 *
 * 幅・高さは最低 1px を保証する（0px の canvas は例外になるため）。
 */
export function normalizeCropRect(rect: CropRect, dims: Dimensions): CropRect | null {
  const imgW = Math.floor(dims.width)
  const imgH = Math.floor(dims.height)
  if (!Number.isFinite(imgW) || !Number.isFinite(imgH) || imgW < 1 || imgH < 1) return null
  if (![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)) return null

  // 負の幅・高さは「逆向きにドラッグした」だけなので、辺の座標に直してから並べ替える。
  const x1 = Math.round(Math.min(rect.x, rect.x + rect.width))
  const x2 = Math.round(Math.max(rect.x, rect.x + rect.width))
  const y1 = Math.round(Math.min(rect.y, rect.y + rect.height))
  const y2 = Math.round(Math.max(rect.y, rect.y + rect.height))

  // 画像の内側へクランプ。
  const left = Math.min(Math.max(x1, 0), imgW)
  const right = Math.min(Math.max(x2, 0), imgW)
  const top = Math.min(Math.max(y1, 0), imgH)
  const bottom = Math.min(Math.max(y2, 0), imgH)

  // クランプ後に潰れた（＝画像と重なっていない / 幅か高さが 0）なら切り抜けない。
  if (right - left < 1 || bottom - top < 1) return null

  return { x: left, y: top, width: right - left, height: bottom - top }
}

/** {@link normalizeCropRect} を通した矩形が、画像全体と同じか（＝切り抜く意味がないか）。 */
export function isFullRect(rect: CropRect, dims: Dimensions): boolean {
  return (
    rect.x === 0 &&
    rect.y === 0 &&
    rect.width === Math.floor(dims.width) &&
    rect.height === Math.floor(dims.height)
  )
}

/**
 * RGBA ピクセル列から、透明な外周を落とした矩形を返す純粋関数。
 *
 * `pixels` は `getImageData().data` と同じ **RGBA 4バイト × width × height**（行優先）。
 *
 * - `alphaThreshold` **以下**のアルファを「余白」とみなす。既定 0 ＝ 完全透明だけを落とす
 *   （半透明の落ち影やアンチエイリアスを巻き込まないため）。
 * - **全面が余白なら `null`**。全部消してしまうより「トリムしない」に倒すほうが安全
 *   （真っ白な PNG を読み違えたときに画像が消える事故を避ける）。
 * - 余白が無ければ画像全体の矩形をそのまま返す（呼び手は {@link isFullRect} で「詰める余地なし」を判定できる）。
 */
export function computeTrimBounds(
  pixels: Uint8ClampedArray,
  dims: Dimensions,
  alphaThreshold = 0,
): CropRect | null {
  const w = Math.floor(dims.width)
  const h = Math.floor(dims.height)
  if (w < 1 || h < 1) return null
  // 寸法と実データが食い違っていたら、走査で範囲外を読むので手を出さない。
  if (pixels.length < w * h * 4) return null

  let left = w
  let right = -1
  let top = h
  let bottom = -1

  for (let y = 0; y < h; y++) {
    const row = y * w * 4
    for (let x = 0; x < w; x++) {
      // アルファは RGBA の4バイト目。
      if (pixels[row + x * 4 + 3] <= alphaThreshold) continue
      if (x < left) left = x
      if (x > right) right = x
      if (y < top) top = y
      if (y > bottom) bottom = y
    }
  }

  // 不透明な画素が1つも無い＝全面が余白。トリムしない（安全側）。
  if (right < 0 || bottom < 0) return null

  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 }
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
 * 画像を読んで RGBA を取り出す。
 *
 * **外部URLの画像は canvas を汚染して `getImageData` が例外になる**（CORS）。
 * 現行の取り込み経路は data URI 化してから保存するので通常は起きないが、
 * 起きたときに握り潰すと「なぜかクロップだけ効かない」になるので、理由を持った例外にする。
 */
async function readPixels(
  dataUrl: string,
): Promise<{ pixels: Uint8ClampedArray; dims: Dimensions }> {
  const img = await loadImage(dataUrl)
  const dims = { width: img.naturalWidth, height: img.naturalHeight }
  if (dims.width < 1 || dims.height < 1) {
    throw new Error('画像のサイズが取得できませんでした')
  }
  const canvas = document.createElement('canvas')
  canvas.width = dims.width
  canvas.height = dims.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('canvas が使えないため、この画像はクロップできません')
  ctx.drawImage(img, 0, 0)
  try {
    return { pixels: ctx.getImageData(0, 0, dims.width, dims.height).data, dims }
  } catch {
    // SecurityError（canvas 汚染）。data URI 以外を直に読んだときに起きる。
    throw new Error(
      'この画像は外部URLのまま参照しているためクロップできません（取り込み直してください）',
    )
  }
}

/** 画像の実寸（自然サイズ）を読む。 */
export async function readDimensions(dataUrl: string): Promise<Dimensions> {
  const img = await loadImage(dataUrl)
  if (img.naturalWidth < 1 || img.naturalHeight < 1) {
    throw new Error('画像のサイズが取得できませんでした')
  }
  return { width: img.naturalWidth, height: img.naturalHeight }
}

/**
 * 透明余白を落とす矩形を検出する。詰める余地が無い（全面不透明）／全面透明なら `null`。
 *
 * @param alphaThreshold この値**以下**のアルファを余白とみなす（既定 0 ＝ 完全透明のみ）
 */
export async function detectTrimRect(
  dataUrl: string,
  alphaThreshold = 0,
): Promise<CropRect | null> {
  const { pixels, dims } = await readPixels(dataUrl)
  const rect = computeTrimBounds(pixels, dims, alphaThreshold)
  if (!rect) return null
  // 全面不透明＝詰める余地なし。呼び手が「変わりません」と言えるように null に倒す。
  return isFullRect(rect, dims) ? null : rect
}

/**
 * 矩形で切り抜いた data URI を返す。**PNG 固定**（透過を保つため）で、**再リサイズはしない**。
 *
 * 元が JPEG/WebP でも PNG で出るので、写真的な画像では**逆に膨らむことがある**
 * （呼び手はクロップ後のサイズを出して気づけるようにすること）。
 */
export async function cropDataUri(
  dataUrl: string,
  rect: CropRect,
): Promise<{ dataUrl: string; rect: CropRect }> {
  const img = await loadImage(dataUrl)
  const dims = { width: img.naturalWidth, height: img.naturalHeight }
  const safe = normalizeCropRect(rect, dims)
  if (!safe) throw new Error('切り抜く範囲が画像の外です')

  const canvas = document.createElement('canvas')
  canvas.width = safe.width
  canvas.height = safe.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas が使えないため、この画像はクロップできません')
  ctx.drawImage(img, safe.x, safe.y, safe.width, safe.height, 0, 0, safe.width, safe.height)
  try {
    return { dataUrl: canvas.toDataURL('image/png'), rect: safe }
  } catch {
    throw new Error(
      'この画像は外部URLのまま参照しているためクロップできません（取り込み直してください）',
    )
  }
}

/** data URI のおおよそのバイト数（base64 の実データ長から逆算）。 */
export function dataUriBytes(dataUrl: string): number {
  const i = dataUrl.indexOf(',')
  if (i < 0) return 0
  const b64 = dataUrl.slice(i + 1)
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((b64.length * 3) / 4) - padding)
}
