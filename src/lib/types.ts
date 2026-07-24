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

/** 発話中（`Voice_avatarSpeaking__` 付与）に立ち絵へ乗せる演出。 */
export interface SpeakEffect {
  /** 演出そのものの on/off。off なら発話検知の `:has()` ルールを出力しない。 */
  enabled: boolean
  /** 跳ねる高さ(px)。0 で跳ねなし。 */
  jumpPx: number
  /** 白フチ（drop-shadow）を出すか。 */
  whiteOutline: boolean
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
  /** 発話演出。 */
  speak: SpeakEffect
}

/** UI 全体の永続化対象。 */
export interface AppState {
  users: TachieUser[]
  options: GenerateOptions
}

/** 既定の演出。 */
export const DEFAULT_SPEAK: SpeakEffect = {
  enabled: true,
  jumpPx: 10,
  whiteOutline: true,
  durationMs: 750,
}

/** 既定の生成オプション。 */
export const DEFAULT_OPTIONS: GenerateOptions = {
  alwaysShow: true,
  left: 16,
  bottom: 16,
  width: undefined,
  speak: DEFAULT_SPEAK,
}
