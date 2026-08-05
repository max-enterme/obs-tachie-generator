/** 立ち絵として表示する Discord ユーザー1人分。 */
export interface TachieUser {
  /** Discord ユーザーID（数字のみの文字列）。Streamkit の `avatars/<id>` に前方一致で使う。 */
  id: string
  /** 表示名。生成CSSにはコメントとしてだけ入る（画面には出ない）。 */
  name: string
  /** 画面に出す任意の名前。空なら {@link TachieUser.name} を流用する。 */
  displayName?: string
  /**
   * 立ち絵画像。`data:image/...;base64,...` の data URI を推奨（外部ホスト不要・CSP回避・失効なし）。
   * 外部URLも指定できるが、Streamkit の CSP に阻まれるホストは表示されない。
   */
  imageUrl: string
}

/**
 * 発話中（`Voice_avatarSpeaking__` 付与）に立ち絵へ乗せる演出。
 * 「話すときの動き」は 枠(outline) / 点滅(blink) / ぴょこぴょこ(bounce) を個別に on/off できる。
 */
export interface SpeakEffect {
  /** ぴょこぴょこ跳ね。 */
  bounce: boolean
  /** 跳ねる高さ(px)。 */
  jumpPx: number
  /** 枠・後光（drop-shadow のフチ）を出すか。 */
  outline: boolean
  /** 枠・後光の色（CSS カラー。既定 `#FFFFFF`）。 */
  outlineColor: string
  /** 枠・後光の幅(px)。drop-shadow のオフセット量とグロー半径の基準（既定 2）。 */
  outlineWidth: number
  /** 点滅（opacity のパルス）を出すか。 */
  blink: boolean
  /** アニメーション周期(ms)。 */
  durationMs: number
}

/** 名前ラベルの行揃え。立ち絵に `width` 指定があるときだけ意味を持つ。 */
export type NameAlign = 'left' | 'center' | 'right'

/**
 * 名前の背景（テロップ帯）の幅の決め方。
 * - `text`: 文字幅に合わせて帯が縮む（テロップらしい見た目）。行揃えは帯ごとの位置合わせになる。
 * - `stretch`: 立ち絵の幅いっぱいに帯を敷く（帯の中で文字を行揃え）。
 */
export type NameFit = 'text' | 'stretch'

/**
 * 立ち絵に添える「任意の名前」の見た目。**テキストそのものは持たない**
 * （テキストは「誰」= {@link AppUser.displayName} 側。見た目は複数人で使い回す）。
 * 出力は `body::before` の `content` 1要素 ＝ **1ソースにつき名前は1つ**。
 */
export interface NameLabel {
  /** 名前を表示するか。 */
  show: boolean
  /** 立ち絵の左端からの相対位置(px)。 */
  offsetX: number
  /** 立ち絵の下端からの相対位置(px)。負で立ち絵より下。 */
  offsetY: number
  /** 文字サイズ(px)。 */
  fontSize: number
  /** フォント名（空で Streamkit ページのフォントを継承）。OBS(CEF) にあるものだけ効く。 */
  fontFamily: string
  /** 文字色（CSS カラー。既定 `#FFFFFF`）。 */
  color: string
  /** 太字にするか。 */
  bold: boolean
  /** 行揃え（立ち絵に `width` 指定があるときだけ効く）。 */
  align: NameAlign
  /** 縁取り（text-shadow のフチ）を出すか。 */
  outline: boolean
  /** 縁取りの色（CSS カラー。既定 `#000000`）。 */
  outlineColor: string
  /** 縁取りの幅(px)。 */
  outlineWidth: number
  /** 背景（テロップ帯）を敷くか。 */
  background: boolean
  /** 背景色（CSS カラー。既定 `#000000`）。 */
  backgroundColor: string
  /** 背景の不透明度(%)。0–100。 */
  backgroundOpacity: number
  /** 背景の内側余白・横(px)。 */
  backgroundPadX: number
  /** 背景の内側余白・縦(px)。 */
  backgroundPadY: number
  /** 背景の角丸(px)。 */
  backgroundRadius: number
  /** 背景の幅の決め方（背景ONのときだけ効く）。 */
  fit: NameFit
}

/**
 * 立ち絵を置く横方向の基準点（アンカー）。
 * `left` はキャンバス左端 / `right` は右端 / `center` は横中央。
 */
export type AnchorX = 'left' | 'center' | 'right'

/**
 * 立ち絵を置く縦方向の基準点（アンカー）。
 * `top` はキャンバス上端 / `bottom` は下端 / `middle` は縦中央。
 */
export type AnchorY = 'top' | 'middle' | 'bottom'

/** 既定の横アンカー。**003 以前の保存データ（アンカー無し）を左下として読むための基準**。 */
export const DEFAULT_ANCHOR_X: AnchorX = 'left'

/** 既定の縦アンカー。**003 以前の保存データ（アンカー無し）を左下として読むための基準**。 */
export const DEFAULT_ANCHOR_Y: AnchorY = 'bottom'

/** 横アンカーを解決する（未指定は {@link DEFAULT_ANCHOR_X}）。 */
export function resolveAnchorX(v?: AnchorX): AnchorX {
  return v ?? DEFAULT_ANCHOR_X
}

/** 縦アンカーを解決する（未指定は {@link DEFAULT_ANCHOR_Y}）。 */
export function resolveAnchorY(v?: AnchorY): AnchorY {
  return v ?? DEFAULT_ANCHOR_Y
}

/**
 * 縦横のアンカーをまとめて解決する。
 * 位置を出す側（generateCss / プレビュー / UI）は**必ずここを通す**こと
 * — 「未指定 ＝ 左下」の一点をこの関数だけで担保する。
 */
export function resolveAnchors(o: Pick<GenerateOptions, 'anchorX' | 'anchorY'>): {
  x: AnchorX
  y: AnchorY
} {
  return { x: resolveAnchorX(o.anchorX), y: resolveAnchorY(o.anchorY) }
}

/** `generateCss` の生成オプション。 */
export interface GenerateOptions {
  /**
   * 常時表示。true は通話に居なくても `body::after` で描画（1人=1ブラウザソース）。
   * false は Streamkit の実 img を差し替える方式で、通話中のユーザーだけ表示（まとめ版向け）。
   */
  alwaysShow: boolean
  /**
   * 横アンカーからの距離(px)。既定の `left` アンカーなら左端から、`right` なら右端からの距離。
   * `center` では中央からのズレ量（正で右へ）。フィールド名は保存互換のため `left` のまま。
   */
  left: number
  /**
   * 縦アンカーからの距離(px)。既定の `bottom` アンカーなら下端から、`top` なら上端からの距離。
   * `middle` では中央からのズレ量（正で上へ）。フィールド名は保存互換のため `bottom` のまま。
   */
  bottom: number
  /** 横アンカー。未指定は `left`（003 以前の保存データ互換）。 */
  anchorX?: AnchorX
  /** 縦アンカー。未指定は `bottom`（003 以前の保存データ互換）。 */
  anchorY?: AnchorY
  /** 立ち絵の幅(px)。未指定で画像原寸。 */
  width?: number
  /** 静かな人（発話していない立ち絵）を暗くして、話している人を目立たせる。 */
  dimWhenQuiet: boolean
  /** 通話にいないときは立ち絵を隠す（在室＝本人が接続中のときだけ表示）。 */
  hideWhenAway: boolean
  /** 発話演出。 */
  speak: SpeakEffect
  /** 名前ラベルの見た目。テキストは {@link TachieUser.displayName} / {@link TachieUser.name} 側。 */
  nameLabel: NameLabel
  /**
   * 立ち絵画像の実サイズ（幅 px）。`width` が未指定（原寸）のときに、名前ラベルの行揃え用の
   * 箱幅として使う（CSS からは描画中の画像の実寸を参照できないため、アプリ側で測って焼き込む）。
   * 立ち絵自体の描画には使わない（原寸のまま）。
   */
  imageNaturalWidth?: number
}

/** 「静かな人を暗くする」で非発話時に掛ける明るさ(%)。 */
export const DIM_BRIGHTNESS_PCT = 50

/**
 * アプリ層の「誰」。Discord 識別子のみを持ち、見た目（画像・位置・演出）は持たない。
 * 見た目は {@link Preset} 側に置き、出力時に {@link Pairing} で組み合わせる。
 */
export interface AppUser {
  /** Discord ユーザーID（数字のみの文字列）。 */
  id: string
  /** 表示名（メモ用）。 */
  name: string
  /** 画面に出す任意の名前。空（未設定）なら {@link AppUser.name} を流用する。 */
  displayName?: string
}

/**
 * 再利用する「見た目・演出」。立ち絵画像＋位置/サイズ＋発話演出を1セットに束ねる。
 * `id` はアプリ内キー（Discord ID ではない）。IDだけ差し替えても見た目は据え置きにできる。
 */
export interface Preset {
  /** アプリ内キー（{@link newId} 生成）。 */
  id: string
  /** プリセット名（メモ用）。 */
  name: string
  /** 立ち絵画像（data URI 推奨 / 外部URLも可）。 */
  imageUrl: string
  /** 横アンカーからの距離(px)。詳細は {@link GenerateOptions.left}。 */
  left: number
  /** 縦アンカーからの距離(px)。詳細は {@link GenerateOptions.bottom}。 */
  bottom: number
  /** 横アンカー。未指定は `left`（003 以前の保存データ互換）。 */
  anchorX?: AnchorX
  /** 縦アンカー。未指定は `bottom`（003 以前の保存データ互換）。 */
  anchorY?: AnchorY
  /** 立ち絵の幅(px)。未指定で画像原寸。 */
  width?: number
  /** 静かな人（発話していない立ち絵）を暗くする。 */
  dimWhenQuiet: boolean
  /** 通話にいないときは立ち絵を隠す（在室のときだけ表示）。 */
  hideWhenAway: boolean
  /** 発話演出。 */
  speak: SpeakEffect
  /** 名前ラベルの見た目（テキストはユーザー側）。 */
  nameLabel: NameLabel
}

/** 出力する「ユーザー × プリセット」の明示ペア（多対多）。保存リストの1件。 */
export interface Pairing {
  /** {@link AppUser.id} 参照。 */
  userId: string
  /** {@link Preset.id} 参照。 */
  presetId: string
}

/**
 * 「作業中の選択」1組。出力CSSはこの選択1組を対象にする。
 * `pairings`（保存リスト）とは別で、保存はこの選択を貯める・呼び戻すためのもの。
 */
export interface Selection {
  /** {@link AppUser.id} 参照。未選択なら null。 */
  userId: string | null
  /** {@link Preset.id} 参照。未選択なら null。 */
  presetId: string | null
}

/** 未選択の作業中選択。 */
export const EMPTY_SELECTION: Selection = { userId: null, presetId: null }

/** UI 全体の永続化対象。ユーザー・プリセット・保存ペア・作業中選択を独立に持つ。 */
export interface AppState {
  users: AppUser[]
  presets: Preset[]
  pairings: Pairing[]
  selection: Selection
}

/**
 * プリセットを generateCss の {@link GenerateOptions} に落とす（常に個別＝常時表示）。
 * `imageNaturalWidth` は幅が原寸のときの名前ラベル用（測れていなければ省略可）。
 */
export function presetToOptions(p: Preset, imageNaturalWidth?: number): GenerateOptions {
  return {
    alwaysShow: true,
    left: p.left,
    bottom: p.bottom,
    anchorX: p.anchorX,
    anchorY: p.anchorY,
    width: p.width,
    dimWhenQuiet: p.dimWhenQuiet,
    hideWhenAway: p.hideWhenAway,
    speak: p.speak,
    nameLabel: p.nameLabel,
    imageNaturalWidth,
  }
}

/** ユーザー（誰）とプリセット（見た目）を合成して generateCss の描画入力 {@link TachieUser} を作る。 */
export function renderUser(u: AppUser, p: Preset): TachieUser {
  return { id: u.id, name: u.name, displayName: u.displayName, imageUrl: p.imageUrl }
}

/** 画面に出す名前を決める（`displayName` 優先・空ならメモ用の `name`）。空文字なら名前を出さない。 */
export function resolveDisplayName(u: Pick<TachieUser, 'name' | 'displayName'>): string {
  return (u.displayName ?? '').trim() || u.name.trim()
}

/** 既定値（DEFAULT_OPTIONS の位置/サイズ/演出＋空 image・空 name）の新規プリセット。 */
export function makeDefaultPreset(id: string): Preset {
  return {
    id,
    name: '',
    imageUrl: '',
    left: DEFAULT_OPTIONS.left,
    bottom: DEFAULT_OPTIONS.bottom,
    anchorX: DEFAULT_ANCHOR_X,
    anchorY: DEFAULT_ANCHOR_Y,
    width: DEFAULT_OPTIONS.width,
    dimWhenQuiet: DEFAULT_OPTIONS.dimWhenQuiet,
    hideWhenAway: DEFAULT_OPTIONS.hideWhenAway,
    speak: { ...DEFAULT_SPEAK },
    nameLabel: { ...DEFAULT_NAME_LABEL },
  }
}

/** プリセットのオプション値（位置/サイズ/演出/暗転/隠す）を既定に戻す（名前・画像は保持）。 */
export function resetPresetOptions(p: Preset): Preset {
  return { ...makeDefaultPreset(p.id), name: p.name, imageUrl: p.imageUrl }
}

/**
 * アプリ内キーを生成する（ブラウザ実行前提）。
 * ※ 決定的でなければならない箇所（state.ts の normalizeState 等）では使わないこと。
 */
export function newId(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2)
}

/**
 * 既定の名前ラベル。**既定は非表示**（001 までの出力と同じ CSS を保つ）。
 * 位置は「立ち絵の左端・下端から少し下」＝ 足元のネームプレート。
 */
export const DEFAULT_NAME_LABEL: NameLabel = {
  show: false,
  offsetX: 0,
  offsetY: -8,
  fontSize: 32,
  fontFamily: '',
  color: '#FFFFFF',
  bold: true,
  align: 'center',
  outline: true,
  outlineColor: '#000000',
  outlineWidth: 3,
  background: false,
  backgroundColor: '#000000',
  backgroundOpacity: 60,
  backgroundPadX: 12,
  backgroundPadY: 6,
  backgroundRadius: 6,
  fit: 'text',
}

/** 既定の演出。 */
export const DEFAULT_SPEAK: SpeakEffect = {
  bounce: true,
  jumpPx: 10,
  outline: true,
  outlineColor: '#FFFFFF',
  outlineWidth: 2,
  blink: false,
  durationMs: 750,
}

/** 既定の生成オプション。 */
export const DEFAULT_OPTIONS: GenerateOptions = {
  alwaysShow: true,
  left: 16,
  bottom: 16,
  anchorX: DEFAULT_ANCHOR_X,
  anchorY: DEFAULT_ANCHOR_Y,
  width: undefined,
  dimWhenQuiet: false,
  hideWhenAway: false,
  speak: DEFAULT_SPEAK,
  nameLabel: DEFAULT_NAME_LABEL,
}
