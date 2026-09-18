import type { AnchorX, AnchorY, SpeakEffect } from './types'

/** 距離の欄ごとの必要余白(px)。中央アンカーの軸は「距離」ではなく「ズレ」なので null。 */
export interface SpeakMargin {
  x: number | null
  y: number | null
}

/** 枠・後光が立ち絵の外へ広がる量 = 幅 × この倍率(2026-09-18 の OBS 実測で最大約 6.7×〔幅 2/4/6/12 → 13/26〜27/34〜40/79〜80px〕。安全側に 7×)。 */
export const GLOW_EXTENT_PER_WIDTH = 7

/**
 * 発話演出が端で切れないための、アンカーからの距離の必要値(px)。
 * - 枠・後光(outline)が ON: 上下左右に 7 × 幅。幅 0 以下は 1 として数える(KEYFRAMES_LIGHT と同じ)
 * - ぴょこぴょこ(bounce && jumpPx > 0): 上方向にだけ動くので、anchorY === 'top' のときだけ縦に jumpPx を足す
 * - 各軸の合計を最後に Math.ceil で整数へ切り上げる(幅・跳ね高さが小数でも表示は整数 px)
 * - anchorX === 'center' なら x は null、anchorY === 'middle' なら y は null
 */
export function requiredSpeakMargin(speak: SpeakEffect, anchorX: AnchorX, anchorY: AnchorY): SpeakMargin {
  const glowExtent = speak.outline ? GLOW_EXTENT_PER_WIDTH * (speak.outlineWidth > 0 ? speak.outlineWidth : 1) : 0
  const jump = speak.bounce && speak.jumpPx > 0 ? speak.jumpPx : 0

  const x = anchorX === 'center' ? null : Math.ceil(glowExtent)
  const y = anchorY === 'middle' ? null : Math.ceil(glowExtent + (anchorY === 'top' ? jump : 0))

  return { x, y }
}

/** 距離の欄に出す文言。need が null か 0 以下なら null(何も出さない)。 */
export function speakMarginNote(
  need: number | null,
  distance: number,
): { warn: boolean; text: string } | null {
  if (need === null || need <= 0) return null
  if (distance < need) {
    return { warn: true, text: `発話演出が端で切れます。${need}px 以上にしてください` }
  }
  return { warn: false, text: `発話演出に必要な余白: ${need}px` }
}
