import type { Dimensions } from './image'

/** 縦横比の差がこの割合(1%)を超えたら警告する。 */
export const MOUTH_ASPECT_TOLERANCE = 0.01

/**
 * 口開き絵の縦横比が立ち絵と違うときの警告文。どちらかが測れていなければ null。
 * 差 = |立ち絵の幅/高さ − 口開き絵の幅/高さ| / (立ち絵の幅/高さ)。
 */
export function mouthAspectNote(base: Dimensions | null, mouth: Dimensions | null): string | null {
  if (!base || !mouth) return null
  const baseAspect = base.width / base.height
  const mouthAspect = mouth.width / mouth.height
  const difference = Math.abs(baseAspect - mouthAspect) / baseAspect
  if (difference <= MOUTH_ASPECT_TOLERANCE) return null
  return `口開き絵の縦横比が立ち絵と違います（立ち絵 ${base.width}×${base.height} / 口開き ${mouth.width}×${mouth.height}）。口開き絵は立ち絵の枠に収めて中央に出します。`
}
