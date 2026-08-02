import { DIM_BRIGHTNESS_PCT, type GenerateOptions, type SpeakEffect, type TachieUser } from './types'

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
 *   発話は `body:has(img[src*="avatars/<id>"][class*="Voice_avatarSpeaking__"])::after` で検知。**1人=1ソース。**
 * - まとめ（combined）: Streamkit の実 img を人ごとに `content` 差し替え。1ソースに複数人を出せるが通話中のみ表示。
 *
 * 「話すときの動き」は 枠(outline) / 点滅(blink) / ぴょこぴょこ(bounce) を個別に on/off。
 * 「静かな人を暗くする」(dimWhenQuiet) は非発話の立ち絵を暗くし、発話中だけ明るく戻す。
 */

type Effect = 'jump' | 'light' | 'blink'

/** data URI / URL を CSS の `url("...")` として安全に包む。 */
function cssUrl(rawUrl: string): string {
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

/** 枠・後光の色を安全化する（想定外の値は白に倒して CSS を壊さない）。 */
export function safeColor(color: string): string {
  const c = color.trim()
  if (/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(c)) return c
  if (/^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/i.test(c)) return c
  if (/^rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(0|1|0?\.\d+)\s*\)$/i.test(c)) return c
  return '#FFFFFF'
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

const KEYFRAMES_LIGHT = (color: string, width: number) => {
  const c = safeColor(color)
  // 幅 w のフチ＝4方向 ±w のオフセット影。グローは半径 w↔4w で脈動（既定 w=2 で従来の 2↔8）。
  const w = width > 0 ? width : 1
  const shadows = (blur: number) =>
    `drop-shadow(0 0 ${blur}px ${c}) drop-shadow(${w}px ${w}px 0px ${c}) drop-shadow(-${w}px -${w}px 0px ${c}) drop-shadow(-${w}px ${w}px 0px ${c}) drop-shadow(${w}px -${w}px 0px ${c})`
  return `@keyframes speak-light {
  0% { filter: ${shadows(w)}; }
  50% { filter: ${shadows(4 * w)}; }
  100% { filter: ${shadows(w)}; }
}`
}

const KEYFRAMES_BLINK = `@keyframes speak-blink {
  0% { opacity: 1; }
  50% { opacity: 0.35; }
  100% { opacity: 1; }
}`

/** 有効な演出を列挙する。空（3種すべて off）なら発話演出は出さない＝静止。 */
function activeEffects(speak: SpeakEffect): Effect[] {
  const effects: Effect[] = []
  if (speak.bounce && speak.jumpPx > 0) effects.push('jump')
  if (speak.outline) effects.push('light')
  if (speak.blink) effects.push('blink')
  return effects
}

/** `animation:` の値を組む。 */
function animationValue(effects: Effect[], durationMs: number): string {
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

/** 追加する keyframe 定義を、含まれる effect に応じて集める。 */
function keyframeBlocks(
  effects: Effect[],
  speak: SpeakEffect,
  jumpKind: 'transform' | 'bottom',
): string[] {
  const blocks: string[] = []
  if (effects.includes('jump')) {
    blocks.push(
      jumpKind === 'transform'
        ? KEYFRAMES_JUMP_TRANSFORM(speak.jumpPx)
        : KEYFRAMES_JUMP_BOTTOM(speak.jumpPx),
    )
  }
  if (effects.includes('light')) blocks.push(KEYFRAMES_LIGHT(speak.outlineColor, speak.outlineWidth))
  if (effects.includes('blink')) blocks.push(KEYFRAMES_BLINK)
  return blocks
}

/**
 * 常時表示（standalone）。`body::after` 1要素で1人を描画する。1人=1ブラウザソース。
 */
export function generateStandaloneCss(user: TachieUser, options: GenerateOptions): string {
  const id = safeId(user.id)
  const { left, bottom, width, dimWhenQuiet, hideWhenInCall, speak } = options
  const effects = activeEffects(speak)

  const afterDecls = [
    `  content: var(--img-stand-url-${id});`,
    `  position: fixed;`,
    `  left: ${left}px;`,
    `  bottom: ${bottom}px;`,
    `  display: block;`,
    ...(width != null ? [`  width: ${width}px;`] : []),
    // 静かな人を暗くする：非発話時の既定を暗く
    ...(dimWhenQuiet ? [`  filter: brightness(${DIM_BRIGHTNESS_PCT}%);`] : []),
  ]

  const parts: string[] = [
    rootBlock([user]),
    `/* 立ち絵は body::after ただ1つで描画（唯一の描画源＝位置ズレが起きない）。
   Streamkit の実要素は全部隠し、発話だけ検知して body::after を演出する。 */`,
    `body, #root {\n  overflow: hidden !important;\n}`,
    `/* 立ち絵（常時表示：通話に居ても居なくても同じ位置） */\nbody::after {\n${afterDecls.join('\n')}\n}`,
  ]

  // 発話中のルール：演出があるか、暗転解除（dim）が要るなら出す
  if (effects.length > 0 || dimWhenQuiet) {
    const speakingDecls: string[] = []
    // outline アニメが filter を持つ場合はそれで明るさが戻る。それ以外は明示的に戻す。
    if (dimWhenQuiet && !effects.includes('light')) {
      speakingDecls.push(`  filter: brightness(100%);`)
    }
    if (effects.length > 0) {
      speakingDecls.push(`  animation: ${animationValue(effects, speak.durationMs)};`)
    }
    parts.push(
      `/* 発話中：非表示の実 img に付く Voice_avatarSpeaking__ を :has() で検知して body::after を演出 */
body:has(img[src*="avatars/${id}"][class*="Voice_avatarSpeaking__"])::after {
${speakingDecls.join('\n')}
}`,
    )
  }

  // 通話中は隠す：本人が接続中は実 img が DOM に出る（display:none でも :has() は一致）ので、
  // それを検知して body::after を隠す。→ 通話にいない時だけ立ち絵が出る。
  if (hideWhenInCall) {
    parts.push(
      `/* 通話中（本人が接続中）は立ち絵を隠す */
body:has(img[src*="avatars/${id}"])::after {
  display: none;
}`,
    )
  }

  parts.push(
    `img {\n  display: none !important;\n}`,
    `[class*="Voice_name__"], [class*="Voice_user__"] {\n  display: none !important;\n}`,
    ...keyframeBlocks(effects, speak, 'transform'),
  )

  return parts.join('\n\n') + '\n'
}

/**
 * まとめ（combined）。Streamkit の実 img を人ごとに差し替える。1ソースに複数人を出せるが通話中のみ表示。
 */
export function generateCombinedCss(users: TachieUser[], options: GenerateOptions): string {
  const { left, bottom, width, dimWhenQuiet, speak } = options
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

  // 静かな人を暗くする：全アバターを既定で暗くする
  if (dimWhenQuiet) {
    parts.push(`[class*="Voice_avatar__"] {\n  filter: brightness(${DIM_BRIGHTNESS_PCT}%);\n}`)
  }

  // 発話中のルール
  if (effects.length > 0 || dimWhenQuiet) {
    const speakingDecls: string[] = [`  position: relative;`]
    if (dimWhenQuiet && !effects.includes('light')) {
      speakingDecls.push(`  filter: brightness(100%);`)
    }
    if (effects.length > 0) {
      speakingDecls.push(`  animation: ${animationValue(effects, speak.durationMs)};`)
    }
    parts.push(`[class*="Voice_avatarSpeaking__"] {\n${speakingDecls.join('\n')}\n}`)
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

  parts.push(...keyframeBlocks(effects, speak, 'bottom'))

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
