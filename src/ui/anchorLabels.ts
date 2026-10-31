import type { AnchorX, AnchorY } from '../lib/types'

/** 3×3 のアンカー選択（画面の並びに合わせて 上→下 / 左→右）。 */
export const ANCHOR_ROWS: AnchorY[] = ['top', 'middle', 'bottom']
export const ANCHOR_COLS: AnchorX[] = ['left', 'center', 'right']

export const ANCHOR_LABEL: Record<AnchorY, Record<AnchorX, string>> = {
  top: { left: '左上', center: '上中央', right: '右上' },
  middle: { left: '左中央', center: '中央', right: '右中央' },
  bottom: { left: '左下', center: '下中央', right: '右下' },
}

/** オフセット入力のラベル。「アンカーからの距離」なので、アンカーで意味が変わる。 */
export const OFFSET_X_LABEL: Record<AnchorX, string> = {
  left: '左端からの距離(px)', center: '横中央からのズレ(px)', right: '右端からの距離(px)',
}
export const OFFSET_Y_LABEL: Record<AnchorY, string> = {
  bottom: '下端からの距離(px)', middle: '縦中央からのズレ(px)', top: '上端からの距離(px)',
}
/** 中央アンカーは「距離」ではなく符号付きのズレなので、向きを補足する。 */
export const OFFSET_X_HINT: Partial<Record<AnchorX, string>> = { center: '正で右' }
export const OFFSET_Y_HINT: Partial<Record<AnchorY, string>> = { middle: '正で上' }
