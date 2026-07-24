import type { GenerateOptions, SpeakEffect, TachieUser } from './types'

/**
 * Streamkit 互換の立ち絵カスタムCSSを組み立てる純粋関数群。
 *
 * 実DOM準拠の前提（NAS `season_6/悪手率_蛇王/asset/streamkit_css/` の実証済みCSSが正）:
 * - アバターは `<img>` 自身。発話中はその img に `Voice_avatarSpeaking__`（ハッシュ付き）クラスが付く。
 *   → セレクタは `[class*="Voice_..."]` の前方一致で Streamkit 更新に耐える。
 * - 画像URL は `avatars/<userId>` を含む → `img[src*="avatars/<id>"]` で人を特定する。
 * - 立ち絵画像は data URI で `:root` のカスタムプロパティに埋め込む（外部ホスト不要・CSP回避・失効なし）。
 *
 * 2つの描画方式:
 * - 常時表示（standalone）: `body::after` 1要素だけで描画。通話に居ても居なくても同じ位置に出る。
 *   描画源が1つなので位置ズレが原理的に起きない。発話は
 *   `body:has(img[src*="avatars/<id>"][class*="Voice_avatarSpeaking__"])::after` で検知。**1人=1ブラウザソース。**
 * - まとめ（combined）: Streamkit の実 img を人ごとに `content` 差し替え。1ソースに複数人を出せるが、
 *   Streamkit は通話中のユーザーしか描画しないため **通話中のみ表示**（常時表示にはできない）。
 */

/** data URI / URL を CSS の `url("...")` として安全に包む。 */
function cssUrl(rawUrl: string): string {
  // ダブルクォート・バックスラッシュ・改行だけ潰せば url("...") の中で壊れない。
  const escaped = rawUrl
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/[\r\n]+/g, '')
  return `url("${escaped}")`
}

/** カスタムプロパティ名に使えるよう ID を数字だけに正規化する。 */
function safeId(id: string): string {
  return id.replace(/[^0-9]/g, '')
}

const KEYFRAMES_JUMP_TRANSFORM = (jumpPx: number) => `@keyframes speak-jump {
  0% { transform: translateY(0); }
  50% { transform: translateY(-${jumpPx}px); }
  100% { transform: translateY(0); }
}`

const KEYFRAMES_JUMP_BOTTOM = (jumpPx: number) => `@keyframes speak-jump {
  0% { bottom: 0px; }
  50% { bottom: ${jumpPx}px; }
  100% { bottom: 0px; }
}`

const KEYFRAMES_LIGHT = `@keyframes speak-light {
  0% { filter: drop-shadow(0 0 2px #FFFFFF) brightness(100%) drop-shadow(2px 2px 0px #FFFFFF) drop-shadow(-2px -2px 0px #FFFFFF) drop-shadow(-2px 2px 0px #FFFFFF) drop-shadow(2px -2px 0px #FFFFFF); }
  50% { filter: drop-shadow(0 0 8px #FFFFFF) brightness(100%) drop-shadow(2px 2px 0px #FFFFFF) drop-shadow(-2px -2px 0px #FFFFFF) drop-shadow(-2px 2px 0px #FFFFFF) drop-shadow(2px -2px 0px #FFFFFF); }
  100% { filter: drop-shadow(0 0 2px #FFFFFF) brightness(100%) drop-shadow(2px 2px 0px #FFFFFF) drop-shadow(-2px -2px 0px #FFFFFF) drop-shadow(-2px 2px 0px #FFFFFF) drop-shadow(2px -2px 0px #FFFFFF); }
}`

/** 有効な演出（跳ね/白フチ）を列挙する。空なら発話演出は出さない。 */
function activeEffects(speak: SpeakEffect): Array<'jump' | 'light'> {
  if (!speak.enabled) return []
  const effects: Array<'jump' | 'light'> = []
  if (speak.jumpPx > 0) effects.push('jump')
  if (speak.whiteOutline) effects.push('light')
  return effects
}

/** `animation:` の値を組む。 */
function animationValue(effects: Array<'jump' | 'light'>, durationMs: number): string {
  return effects
    .map((e) => `${durationMs}ms infinite alternate ease-in-out speak-${e}`)
    .join(',')
}

/** `:root` の変数ブロック（立ち絵 data URI の埋め込み）。 */
function rootBlock(users: TachieUser[]): string {
  const lines = users.flatMap((u) => {
    const id = safeId(u.id)
    const label = u.name ? `  /* ${u.name} (${id}) */` : `  /* ${id} */`
    return [label, `  --img-stand-url-${id}: ${cssUrl(u.imageUrl)};`]
  })
  return `:root {\n${lines.join('\n')}\n}`
}

/**
 * 常時表示（standalone）。`body::after` 1要素で1人を描画する。1人=1ブラウザソース。
 */
export function generateStandaloneCss(user: TachieUser, options: GenerateOptions): string {
  const id = safeId(user.id)
  const { left, bottom, width, speak } = options
  const effects = activeEffects(speak)

  const afterDecls = [
    `  content: var(--img-stand-url-${id});`,
    `  position: fixed;`,
    `  left: ${left}px;`,
    `  bottom: ${bottom}px;`,
    `  display: block;`,
    ...(width != null ? [`  width: ${width}px;`] : []),
  ]

  const parts: string[] = [
    rootBlock([user]),
    `/* 立ち絵は body::after ただ1つで描画（唯一の描画源＝位置ズレが起きない）。
   Streamkit の実要素は全部隠し、発話だけ検知して body::after を演出する。 */`,
    `body, #root {\n  overflow: hidden !important;\n}`,
    `/* 立ち絵（常時表示：通話に居ても居なくても同じ位置） */\nbody::after {\n${afterDecls.join('\n')}\n}`,
  ]

  if (effects.length > 0) {
    parts.push(
      `/* 発話中：非表示の実 img に付く Voice_avatarSpeaking__ を :has() で検知して body::after を演出 */
body:has(img[src*="avatars/${id}"][class*="Voice_avatarSpeaking__"])::after {
  animation: ${animationValue(effects, speak.durationMs)};
}`,
    )
  }

  // Streamkit 側の実描画は全部隠す（描画は body::after のみ）
  parts.push(
    `img {\n  display: none !important;\n}`,
    `[class*="Voice_name__"], [class*="Voice_user__"] {\n  display: none !important;\n}`,
  )

  if (effects.includes('jump')) parts.push(KEYFRAMES_JUMP_TRANSFORM(speak.jumpPx))
  if (effects.includes('light')) parts.push(KEYFRAMES_LIGHT)

  return parts.join('\n\n') + '\n'
}

/**
 * まとめ（combined）。Streamkit の実 img を人ごとに差し替える。1ソースに複数人を出せるが通話中のみ表示。
 */
export function generateCombinedCss(users: TachieUser[], options: GenerateOptions): string {
  const { left, bottom, width, speak } = options
  const effects = activeEffects(speak)

  const parts: string[] = [
    rootBlock(users),
    `/* まとめ版：Streamkit の実 img を人ごとに差し替え（1ソースに複数人／通話中のみ表示） */`,
    `body, #root {\n  overflow: hidden !important;\n}`,
    `[class*="Voice_voiceStates__"] {\n  display: flex;\n  align-items: flex-end;\n  justify-content: flex-start;\n  padding-left: ${left}px;\n  padding-bottom: ${bottom}px;\n}`,
    `[class*="Voice_voiceState__"] {\n  height: auto;\n  margin-bottom: 0px;\n}`,
    `[class*="Voice_name__"], [class*="Voice_user__"] {\n  display: none;\n}`,
    `/* 登録外の人は立ち絵なし＝一旦すべて非表示 */\nimg {\n  display: none;\n}`,
  ]

  if (effects.length > 0) {
    parts.push(
      `[class*="Voice_avatarSpeaking__"] {\n  position: relative;\n  animation: ${animationValue(effects, speak.durationMs)};\n}`,
    )
  }

  for (const u of users) {
    const id = safeId(u.id)
    const decls = [
      `  content: var(--img-stand-url-${id});`,
      `  display: block;`,
      `  width: ${width != null ? `${width}px` : 'auto'};`,
      `  height: auto;`,
      `  border-radius: 0;`,
      `  border: none;`,
    ]
    const label = u.name ? `/* ${u.name} */\n` : ''
    parts.push(`${label}img[src*="avatars/${id}"] {\n${decls.join('\n')}\n}`)
  }

  if (effects.includes('jump')) parts.push(KEYFRAMES_JUMP_BOTTOM(speak.jumpPx))
  if (effects.includes('light')) parts.push(KEYFRAMES_LIGHT)

  return parts.join('\n\n') + '\n'
}

/**
 * `generate` の統一入口（plan.md の `generateCss(users, options)` 準拠）。
 * - `alwaysShow` かつ 1人 → 常時表示（body::after）
 * - それ以外 → まとめ（per-img 差し替え／通話中のみ表示）
 *   `alwaysShow` を複数人に指定した場合は常時表示にできないため、注記コメント付きでまとめ版を返す。
 */
export function generateCss(users: TachieUser[], options: GenerateOptions): string {
  if (users.length === 0) {
    return '/* 立ち絵に使うユーザーが未登録です。ユーザーを追加してください。 */\n'
  }
  if (options.alwaysShow && users.length === 1) {
    return generateStandaloneCss(users[0], options)
  }
  if (options.alwaysShow && users.length > 1) {
    const note =
      '/* 注: 常時表示は 1人=1ブラウザソース のときのみ有効です。\n' +
      '   複数人まとめ版は Streamkit の実 img を差し替える方式のため、通話中のユーザーだけ表示されます。 */\n\n'
    return note + generateCombinedCss(users, options)
  }
  return generateCombinedCss(users, options)
}
