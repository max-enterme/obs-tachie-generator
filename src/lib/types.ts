/** 立ち絵として表示する Discord ユーザー1人分。 */
export interface TachieUser {
  /** Discord ユーザーID（数字のみの文字列）。Streamkit の `avatars/<id>` に前方一致で使う。 */
  id: string
  /** 表示名。生成CSSにはコメントとしてだけ入る（画面には出ない）。 */
  name: string
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
  /** 点滅（opacity のパルス）を出すか。 */
  blink: boolean
  /** アニメーション周期(ms)。 */
  durationMs: number
}

/** `generateCss` の生成オプション。 */
export interface GenerateOptions {
  /**
   * 常時表示。true は通話に居なくても `body::after` で描画（1人=1ブラウザソース）。
   * false は Streamkit の実 img を差し替える方式で、通話中のユーザーだけ表示（まとめ版向け）。
   */
  alwaysShow: boolean
  /** 立ち絵の左端(px)。 */
  left: number
  /** 立ち絵の下端(px)。 */
  bottom: number
  /** 立ち絵の幅(px)。未指定で画像原寸。 */
  width?: number
  /** 静かな人（発話していない立ち絵）を暗くして、話している人を目立たせる。 */
  dimWhenQuiet: boolean
  /** 発話演出。 */
  speak: SpeakEffect
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
  /** 立ち絵の左端(px)。 */
  left: number
  /** 立ち絵の下端(px)。 */
  bottom: number
  /** 立ち絵の幅(px)。未指定で画像原寸。 */
  width?: number
  /** 静かな人（発話していない立ち絵）を暗くする。 */
  dimWhenQuiet: boolean
  /** 発話演出。 */
  speak: SpeakEffect
}

/** 出力する「ユーザー × プリセット」の明示ペア（多対多）。 */
export interface Pairing {
  /** {@link AppUser.id} 参照。 */
  userId: string
  /** {@link Preset.id} 参照。 */
  presetId: string
}

/** UI 全体の永続化対象。ユーザー・プリセット・ペアを独立に持つ。 */
export interface AppState {
  users: AppUser[]
  presets: Preset[]
  pairings: Pairing[]
}

/** プリセットを generateCss の {@link GenerateOptions} に落とす（常に個別＝常時表示）。 */
export function presetToOptions(p: Preset): GenerateOptions {
  return {
    alwaysShow: true,
    left: p.left,
    bottom: p.bottom,
    width: p.width,
    dimWhenQuiet: p.dimWhenQuiet,
    speak: p.speak,
  }
}

/** ユーザー（誰）とプリセット（見た目）を合成して generateCss の描画入力 {@link TachieUser} を作る。 */
export function renderUser(u: AppUser, p: Preset): TachieUser {
  return { id: u.id, name: u.name, imageUrl: p.imageUrl }
}

/** 既定値（DEFAULT_OPTIONS の位置/サイズ/演出＋空 image・空 name）の新規プリセット。 */
export function makeDefaultPreset(id: string): Preset {
  return {
    id,
    name: '',
    imageUrl: '',
    left: DEFAULT_OPTIONS.left,
    bottom: DEFAULT_OPTIONS.bottom,
    width: DEFAULT_OPTIONS.width,
    dimWhenQuiet: DEFAULT_OPTIONS.dimWhenQuiet,
    speak: { ...DEFAULT_SPEAK },
  }
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

/** 既定の演出。 */
export const DEFAULT_SPEAK: SpeakEffect = {
  bounce: true,
  jumpPx: 10,
  outline: true,
  outlineColor: '#FFFFFF',
  blink: false,
  durationMs: 750,
}

/** 既定の生成オプション。 */
export const DEFAULT_OPTIONS: GenerateOptions = {
  alwaysShow: true,
  left: 16,
  bottom: 16,
  width: undefined,
  dimWhenQuiet: false,
  speak: DEFAULT_SPEAK,
}
