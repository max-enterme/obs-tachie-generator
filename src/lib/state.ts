import {
  DEFAULT_ANCHOR_X,
  DEFAULT_ANCHOR_Y,
  DEFAULT_NAME_LABEL,
  DEFAULT_OPTIONS,
  DEFAULT_SPEAK,
  EMPTY_SELECTION,
  type AnchorX,
  type AnchorY,
  type AppState,
  type AppUser,
  type NameAlign,
  type NameFit,
  type NameLabel,
  type Pairing,
  type Preset,
  type Selection,
  type SpeakEffect,
} from './types'

/**
 * 設定の永続化。data URI は数MB規模になり URL 共有には載らないため localStorage のみを使う
 * （URL 永続化は data URI サイズの都合で採用しない）。
 *
 * 保存形は新データモデル `{ users: AppUser[]; presets: Preset[]; pairings: Pairing[] }`。
 * `normalizeState` は純粋・決定的（乱数 / randomUUID / Date.now を使わない）。id 生成が要る箇所は
 * UI 側で `newId()` を使う。
 */

const STORAGE_KEY = 'obs-tachie-generator:v1'

function emptyState(): AppState {
  return { users: [], presets: [], pairings: [], selection: { ...EMPTY_SELECTION } }
}

/** 作業中選択を検証する。存在しない userId / presetId を指す選択は null に落とす（純粋・決定的）。 */
function normalizeSelection(
  raw: unknown,
  userIds: Set<string>,
  presetIds: Set<string>,
): Selection {
  const s = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const userId = typeof s.userId === 'string' && userIds.has(s.userId) ? s.userId : null
  const presetId = typeof s.presetId === 'string' && presetIds.has(s.presetId) ? s.presetId : null
  return { userId, presetId }
}

/**
 * ユーザーとして最低限成立しているか（`id` と `name` が文字列）。
 * 任意フィールド（`displayName`）の型不一致でユーザーごと落とさない
 * — プリセット側と同じく「壊れたフィールドだけ既定へ倒す」方針に揃える。
 */
function isAppUser(v: unknown): v is AppUser {
  if (typeof v !== 'object' || v === null) return false
  const u = v as Record<string, unknown>
  return typeof u.id === 'string' && typeof u.name === 'string'
}

function isPairing(v: unknown): v is Pairing {
  if (typeof v !== 'object' || v === null) return false
  const p = v as Record<string, unknown>
  return typeof p.userId === 'string' && typeof p.presetId === 'string'
}

/** 発話演出を既定で補完する（欠損・型不一致は既定値）。 */
function normalizeSpeak(raw: unknown): SpeakEffect {
  const s = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  return {
    bounce: typeof s.bounce === 'boolean' ? s.bounce : DEFAULT_SPEAK.bounce,
    jumpPx: typeof s.jumpPx === 'number' ? s.jumpPx : DEFAULT_SPEAK.jumpPx,
    outline: typeof s.outline === 'boolean' ? s.outline : DEFAULT_SPEAK.outline,
    outlineColor:
      typeof s.outlineColor === 'string' ? s.outlineColor : DEFAULT_SPEAK.outlineColor,
    outlineWidth:
      typeof s.outlineWidth === 'number' ? s.outlineWidth : DEFAULT_SPEAK.outlineWidth,
    blink: typeof s.blink === 'boolean' ? s.blink : DEFAULT_SPEAK.blink,
    durationMs: typeof s.durationMs === 'number' ? s.durationMs : DEFAULT_SPEAK.durationMs,
  }
}

/** 名前ラベルを既定で補完する（欠損・型不一致は既定値＝旧データは表示OFF）。 */
function normalizeNameLabel(raw: unknown): NameLabel {
  const n = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const align =
    n.align === 'left' || n.align === 'center' || n.align === 'right'
      ? (n.align as NameAlign)
      : DEFAULT_NAME_LABEL.align
  return {
    show: typeof n.show === 'boolean' ? n.show : DEFAULT_NAME_LABEL.show,
    offsetX: typeof n.offsetX === 'number' ? n.offsetX : DEFAULT_NAME_LABEL.offsetX,
    offsetY: typeof n.offsetY === 'number' ? n.offsetY : DEFAULT_NAME_LABEL.offsetY,
    fontSize: typeof n.fontSize === 'number' ? n.fontSize : DEFAULT_NAME_LABEL.fontSize,
    fontFamily: typeof n.fontFamily === 'string' ? n.fontFamily : DEFAULT_NAME_LABEL.fontFamily,
    color: typeof n.color === 'string' ? n.color : DEFAULT_NAME_LABEL.color,
    bold: typeof n.bold === 'boolean' ? n.bold : DEFAULT_NAME_LABEL.bold,
    align,
    outline: typeof n.outline === 'boolean' ? n.outline : DEFAULT_NAME_LABEL.outline,
    outlineColor:
      typeof n.outlineColor === 'string' ? n.outlineColor : DEFAULT_NAME_LABEL.outlineColor,
    outlineWidth:
      typeof n.outlineWidth === 'number' ? n.outlineWidth : DEFAULT_NAME_LABEL.outlineWidth,
    background: typeof n.background === 'boolean' ? n.background : DEFAULT_NAME_LABEL.background,
    backgroundColor:
      typeof n.backgroundColor === 'string'
        ? n.backgroundColor
        : DEFAULT_NAME_LABEL.backgroundColor,
    backgroundOpacity:
      typeof n.backgroundOpacity === 'number'
        ? n.backgroundOpacity
        : DEFAULT_NAME_LABEL.backgroundOpacity,
    backgroundPadX:
      typeof n.backgroundPadX === 'number' ? n.backgroundPadX : DEFAULT_NAME_LABEL.backgroundPadX,
    backgroundPadY:
      typeof n.backgroundPadY === 'number' ? n.backgroundPadY : DEFAULT_NAME_LABEL.backgroundPadY,
    backgroundRadius:
      typeof n.backgroundRadius === 'number'
        ? n.backgroundRadius
        : DEFAULT_NAME_LABEL.backgroundRadius,
    fit: n.fit === 'text' || n.fit === 'stretch' ? (n.fit as NameFit) : DEFAULT_NAME_LABEL.fit,
  }
}

/** 1件のプリセットを検証・既定補完する。`id` が無ければ不正として null。 */
function normalizePreset(raw: unknown): Preset | null {
  if (typeof raw !== 'object' || raw === null) return null
  const o = raw as Record<string, unknown>
  if (typeof o.id !== 'string') return null
  // アンカーは 003 で足した任意フィールド。欠損・不正値は既定（＝左下）へ倒し、
  // 003 以前の保存データが従来どおり「左下」として読めることを担保する。
  const anchorX =
    o.anchorX === 'left' || o.anchorX === 'center' || o.anchorX === 'right'
      ? (o.anchorX as AnchorX)
      : DEFAULT_ANCHOR_X
  const anchorY =
    o.anchorY === 'top' || o.anchorY === 'middle' || o.anchorY === 'bottom'
      ? (o.anchorY as AnchorY)
      : DEFAULT_ANCHOR_Y
  return {
    id: o.id,
    name: typeof o.name === 'string' ? o.name : '',
    imageUrl: typeof o.imageUrl === 'string' ? o.imageUrl : '',
    left: typeof o.left === 'number' ? o.left : DEFAULT_OPTIONS.left,
    bottom: typeof o.bottom === 'number' ? o.bottom : DEFAULT_OPTIONS.bottom,
    anchorX,
    anchorY,
    // 幅 0 以下は「原寸」と同義（立ち絵が消える指定は受け付けない）。
    width: typeof o.width === 'number' && o.width > 0 ? o.width : undefined,
    dimWhenQuiet:
      typeof o.dimWhenQuiet === 'boolean' ? o.dimWhenQuiet : DEFAULT_OPTIONS.dimWhenQuiet,
    hideWhenAway:
      typeof o.hideWhenAway === 'boolean' ? o.hideWhenAway : DEFAULT_OPTIONS.hideWhenAway,
    speak: normalizeSpeak(o.speak),
    nameLabel: normalizeNameLabel(o.nameLabel),
  }
}

/**
 * 保存値を新データモデルへ正規化する（純粋・決定的）。
 * - 新形（`presets` を配列で持つ）なら検証して採用。
 * - それ以外（旧 `{ users:[{...imageUrl}], options }` 形や不正）は空 state を返す（旧状態は破棄）。
 * - 壊れた pairing（存在しない userId / presetId 参照）は読み込み時に落とす。
 * - 重複 pairing（同じ userId×presetId）は 1 件に畳む。
 * - 作業中 selection の dangling 参照（存在しない userId / presetId）は null に落とす。
 */
export function normalizeState(raw: unknown): AppState {
  if (typeof raw !== 'object' || raw === null) return emptyState()
  const obj = raw as Record<string, unknown>
  // 新形の判定: presets を配列で持つこと（旧形＝options を持ち presets が無い、は破棄）。
  if (!Array.isArray(obj.presets)) return emptyState()

  const users: AppUser[] = Array.isArray(obj.users)
    ? obj.users.filter(isAppUser).map((u) => ({
        id: u.id,
        name: u.name,
        displayName: typeof u.displayName === 'string' ? u.displayName : undefined,
      }))
    : []

  const presets: Preset[] = obj.presets
    .map(normalizePreset)
    .filter((p): p is Preset => p !== null)

  const userIds = new Set(users.map((u) => u.id))
  const presetIds = new Set(presets.map((p) => p.id))
  const seen = new Set<string>()
  const pairings: Pairing[] = (Array.isArray(obj.pairings) ? obj.pairings : [])
    .filter(isPairing)
    .filter((p) => userIds.has(p.userId) && presetIds.has(p.presetId))
    .filter((p) => {
      const key = `${p.userId}\u0000${p.presetId}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map((p) => ({ userId: p.userId, presetId: p.presetId }))

  const selection = normalizeSelection(obj.selection, userIds, presetIds)

  return { users, presets, pairings, selection }
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    return normalizeState(JSON.parse(raw))
  } catch {
    return emptyState()
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // 容量超過（data URI が大きい場合など）は黙って諦める。生成自体には影響しない。
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
