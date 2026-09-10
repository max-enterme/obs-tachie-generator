import {
  DIM_BRIGHTNESS_PCT,
  resolveAnchors,
  resolveDisplayName,
  type AnchorX,
  type AnchorY,
  type GenerateOptions,
  type NameAlign,
  type NameLabel,
  type SpeakEffect,
  type TachieUser,
} from './types'

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
 *
 * 位置は**アンカー（左/中央/右 × 上/中央/下）からの距離**で出す（{@link placeTachie}）。
 * 中央寄せは `transform` を使うため、発話演出・名前帯の `transform` と衝突しうる。
 * → **`transform` を出す箇所は必ず {@link composeTransform} を通す**（コード側の不変条件）。
 *
 * 名前（任意テキスト）は `body::before` の `content` で描く。Streamkit の実要素（`Voice_name__`）は
 * 潰しているので Discord のアカウント名は出ず、**ここで出す名前だけ**が画面に出る。
 * → 擬似要素は 立ち絵=`::after` / 名前=`::before` で使い切る（1ソース = 立ち絵1枚 + 名前1つ）。
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

/**
 * 任意テキストを CSS の文字列リテラル（`content` 用）として安全に包む。
 * `"` `\` をエスケープし、改行・制御文字は空白へ潰す（`content` は複数行を持てない）。
 */
export function cssString(text: string): string {
  const escaped = text
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
  return `"${escaped}"`
}

/**
 * 改行・制御文字を空白へ潰して1行にする（{@link cssString} と同じ正規化を、囲みとエスケープ抜きで）。
 * プレビュー側が「出力に載る文字列」と同じ判定をするために使う。
 */
export function flattenText(text: string): string {
  return cssString(text)
    .slice(1, -1)
    .replace(/\\(["\\])/g, '$1')
}

/**
 * 任意テキストを CSS コメントに入れられる形にする。`*` と `/` の並びを割って、
 * コメントの早期終了（＝その先が有効な CSS として解釈される）を防ぐ。
 */
export function cssComment(text: string): string {
  return flattenText(text).replace(/\*\//g, '* /')
}

/** 引用符を付けずに書くジェネリックファミリ（キーワードとして解釈させたいもの）。 */
const GENERIC_FONT_FAMILIES = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
  'math',
  'emoji',
  'fangsong',
])

/**
 * フォント名を安全化する。`;` `{` `}` `(` `)` などを落として CSS 注入を潰したうえで、
 * **ジェネリック以外は必ず引用符で包む**。
 *
 * 無引用の識別子は数字始まりにできず `.` も含められないため、`07やさしさゴシック` のような
 * 数字始まりの日本語フォント名を無引用で書くと**宣言ごとパーサに捨てられ、黙って効かない**。
 * 引用すれば任意の文字列をファミリ名として渡せる（`inherit` 等のキーワード誤解釈も同時に防げる）。
 *
 * 空になったら `''`（＝ font-family を出さずページのフォントを継承）。
 */
export function safeFontFamily(raw: string): string {
  return raw
    .replace(/[\u0000-\u001F\u007F]/g, '') // eslint-disable-line no-control-regex
    .replace(/[^A-Za-z0-9 ,._\-\u0080-\uFFFF]/g, '')
    .split(',')
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter((part) => part !== '')
    .map((part) => (GENERIC_FONT_FAMILIES.has(part.toLowerCase()) ? part : cssString(part)))
    .join(', ')
}

/**
 * 色＋不透明度(%) を CSS カラーにする。`#rgb` / `#rrggbb` は `rgba()` に展開し、
 * それ以外（`rgb()` / `rgba()` / `#rrggbbaa`）は不透明度を無視してそのまま使う。
 */
export function cssColorWithOpacity(color: string, opacityPct: number): string {
  const c = safeColor(color)
  const a = Math.min(100, Math.max(0, opacityPct)) / 100
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c)
  if (!m) return c
  const hex = m[1].length === 3 ? m[1].replace(/(.)/g, '$1$1') : m[1]
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return `rgba(${r}, ${g}, ${b}, ${Number(a.toFixed(2))})`
}

/** px 値を CSS に出す（小数第2位で丸め、整数はそのまま）。 */
function px(v: number): string {
  return `${Math.round(v * 100) / 100}px`
}

/** `50%` に px のズレを足した位置値。ズレ 0 なら `50%` のまま（calc を出さない）。 */
function centerValue(v: number): string {
  const n = Math.round(v * 100) / 100
  if (n === 0) return '50%'
  return `calc(50% ${n > 0 ? '+' : '-'} ${Math.abs(n)}px)`
}

/**
 * **`transform` を出す箇所は必ずこの関数を通す**（コード側の不変条件）。
 *
 * 中央寄せの translate と発話演出の translate を別々の `transform` 宣言・別々の keyframe に書くと
 * **後勝ちで打ち消し合う**（中央寄せ + ぴょこぴょこで立ち絵が画面端へ飛ぶ）。
 * 合成する一点をここに集めることで、断片を足す側は順序と重複だけ気にすればよくなる。
 *
 * 空文字を返したら「`transform` 宣言を出さない」の意味（`transform: ;` を吐かないため）。
 */
export function composeTransform(...parts: Array<string | null | undefined>): string {
  return parts.filter((p): p is string => p != null && p !== '').join(' ')
}

/**
 * 1軸ぶんのアンカーの性質。位置プロパティが決まれば、ズレの符号も translate の向きも決まる。
 *
 * `handle`（掴み位置）は**画面座標**の割合で持つ: 横は 0 = 左端 / 1 = 右端、
 * 縦は 0 = 下端 / 1 = 上端。`natural` はそのアンカーが自分のどこを合わせるか
 * （`right` アンカーなら自分の右端 = 1）。
 */
interface AxisSpec {
  prop: 'left' | 'right' | 'top' | 'bottom'
  /** 中央アンカー（`calc(50% ± D)` で出す）。 */
  center: boolean
  axis: 'X' | 'Y'
  /** このアンカーの自然な掴み位置（画面座標の割合）。 */
  natural: number
}

function xSpec(a: AnchorX): AxisSpec {
  if (a === 'right') return { prop: 'right', center: false, axis: 'X', natural: 1 }
  if (a === 'center') return { prop: 'left', center: true, axis: 'X', natural: 0.5 }
  return { prop: 'left', center: false, axis: 'X', natural: 0 }
}

function ySpec(b: AnchorY): AxisSpec {
  if (b === 'top') return { prop: 'top', center: false, axis: 'Y', natural: 1 }
  // 縦の中央は `bottom` 基準に揃える（`bottom` アンカーと同じく「正のズレ = 上」を保つため）。
  if (b === 'middle') return { prop: 'bottom', center: true, axis: 'Y', natural: 0.5 }
  return { prop: 'bottom', center: false, axis: 'Y', natural: 0 }
}

/**
 * 1軸ぶんの配置。**CSS の文字列にする前の素の値**で持つ
 * — 出力CSSは px で出し、プレビューは基準1920×1080 に対する % で出すため、
 * 単位の付け方だけが違って座標の決め方は同じ。
 */
export interface AxisPlacement {
  /** 使う位置プロパティ。 */
  prop: 'left' | 'right' | 'top' | 'bottom'
  /** 位置プロパティに出す距離(px)。`fromCenter` なら「中央 `50%` に足す量」。 */
  distance: number
  /** `calc(50% ± distance)` の形で出すか（中央アンカー）。 */
  fromCenter: boolean
  axis: 'X' | 'Y'
  /** translate の割合(%)。0 なら translate は要らない。 */
  translatePct: number
}

/** 縦横の配置。 */
export interface Placement {
  x: AxisPlacement
  y: AxisPlacement
}

/**
 * 1軸ぶんの配置を決める。**座標系の分岐はこの関数だけに閉じる**
 * （どの位置プロパティを使うか / ズレの符号が反転するか / translate の向き）。
 *
 * @param spec     アンカーが決める軸の性質
 * @param distance 立ち絵の「アンカーからの距離」(px)
 * @param offset   立ち絵に対する**画面座標**のズレ(px)。横は正で右 / 縦は正で上。立ち絵自身は 0
 * @param handle   自分のどこを合わせるか（画面座標の割合）。立ち絵は `spec.natural`
 * @param boxSize  掴み位置をずらす基準の箱のサイズ(px)＝立ち絵の幅。自然位置と同じなら効かない
 */
function axisPlacement(
  spec: AxisSpec,
  distance: number,
  offset: number,
  handle: number,
  boxSize: number,
): AxisPlacement {
  // 位置プロパティが「画面座標の正方向と逆向きに測る」なら、ズレの符号が反転する。
  // （`right` アンカーで「右へずらす」は右端からの距離を**減らす**方向）
  const flip = spec.prop === 'right' || spec.prop === 'top'
  // 掴み位置を、位置プロパティ自身の辺から数えた割合に直す。
  const fromProp = flip ? 1 - handle : handle
  const naturalFromProp = flip ? 1 - spec.natural : spec.natural
  // 自然位置からずらした分だけ、立ち絵のサイズで位置を動かす（自然位置なら boxSize は消える）。
  const d = distance + (flip ? -offset : offset) + (fromProp - naturalFromProp) * boxSize
  // 位置プロパティと translate の正方向が同じ向きなら、掴み位置の戻しは負になる。
  const sign = spec.prop === 'left' || spec.prop === 'top' ? -1 : 1
  return {
    prop: spec.prop,
    distance: Math.round(d * 100) / 100,
    fromCenter: spec.center,
    axis: spec.axis,
    translatePct: Math.round(sign * fromProp * 10000) / 100,
  }
}

/**
 * 立ち絵の配置。距離は**選んだアンカーからの距離**（`right` なら右端から、`top` なら上端から）。
 * 中央（`center`/`middle`）では「中央からのズレ量」で、**正の値が右 / 上**。
 *
 * 立ち絵は掴み位置がアンカーの自然位置（自分の対応する辺）なので、
 * 出てくる translate は**中央寄せ分だけ**になる（＝`speak-jump` に前置して安全）。
 */
export function placeTachie(anchors: { x: AnchorX; y: AnchorY }, x: number, y: number): Placement {
  const sx = xSpec(anchors.x)
  const sy = ySpec(anchors.y)
  return {
    x: axisPlacement(sx, x, 0, sx.natural, 0),
    y: axisPlacement(sy, y, 0, sy.natural, 0),
  }
}

/** 帯の行揃え → 掴み位置（画面座標の割合。0 = 左端 / 0.5 = 中央 / 1 = 右端）。 */
export const ALIGN_HANDLE: Record<NameAlign, number> = { left: 0, center: 0.5, right: 1 }

/**
 * 名前ラベルの配置。**立ち絵のアンカーに追従させる**（立ち絵と同じ軸ロジックを通す）。
 *
 * 名前は「立ち絵の位置 + 画面座標のズレ」で置く。距離はアンカー基準なので、
 * **右アンカーでは `offsetX` の符号が、上アンカーでは `offsetY` の符号が反転する**
 * （「立ち絵より右へ」は右端からの距離を減らす方向）。ここは {@link axisPlacement} が吸収する。
 *
 * 縦は立ち絵の**アンカー側の辺**に合わせる（下アンカーなら足元、上アンカーなら頭側）。
 * 立ち絵の描画後の高さは CSS から取れないため、縦は掴み位置を動かせない。
 *
 * @param handleX 帯の行揃えぶんの掴み位置。幅が分からないときは {@link naturalHandleX} を渡す
 * @param boxWidth 立ち絵の幅(px)。掴み位置が自然位置と同じなら結果に出てこない
 */
export function placeNameLabel(
  anchors: { x: AnchorX; y: AnchorY },
  tachie: { x: number; y: number },
  offset: { dx: number; dy: number },
  handleX: number,
  boxWidth: number,
): Placement {
  const sx = xSpec(anchors.x)
  const sy = ySpec(anchors.y)
  return {
    x: axisPlacement(sx, tachie.x, offset.dx, handleX, boxWidth),
    // 縦は掴み位置を動かさない（立ち絵の高さが分からないため）。
    y: axisPlacement(sy, tachie.y, offset.dy, sy.natural, 0),
  }
}

/** アンカーの自然な掴み位置（帯の幅が分からないときの行揃えの落としどころ）。 */
export function naturalHandleX(a: AnchorX): number {
  return xSpec(a).natural
}

/** {@link Placement} の結果。位置宣言と translate 断片。 */
export interface PositionParts {
  /** `left`/`right`/`top`/`bottom` の宣言（インデント無し・`;` 付き・**横 → 縦**の順）。 */
  decls: string[]
  /**
   * translate 断片。立ち絵では**中央寄せ分だけ**になり、
   * **{@link composeTransform} の先頭に置く**（発話演出の translate より前に来ないと、
   * 演出のズレが中央寄せの基準を動かす）。
   */
  transforms: string[]
}

/** {@link Placement} を px の CSS 宣言 + translate 断片にする（出力CSS向け）。 */
export function placementDecls(p: Placement): PositionParts {
  const decl = (a: AxisPlacement) =>
    `${a.prop}: ${a.fromCenter ? centerValue(a.distance) : px(a.distance)};`
  const translate = (a: AxisPlacement) =>
    a.translatePct === 0 ? null : `translate${a.axis}(${a.translatePct}%)`
  return {
    decls: [decl(p.x), decl(p.y)],
    transforms: [translate(p.x), translate(p.y)].filter((t): t is string => t != null),
  }
}

/** 文字の縁取り（8方向の text-shadow）。 */
function textOutline(color: string, width: number): string {
  const c = safeColor(color)
  const w = width > 0 ? width : 1
  const offsets: Array<[number, number]> = [
    [w, 0],
    [-w, 0],
    [0, w],
    [0, -w],
    [w, w],
    [w, -w],
    [-w, w],
    [-w, -w],
  ]
  return offsets.map(([x, y]) => `${x}px ${y}px 0 ${c}`).join(', ')
}

/**
 * 名前ラベル `body::before` のブロック。名前が空、または `show` が false なら `null`（＝出力しない）。
 * 位置は**立ち絵と同じアンカー**からの距離で出す（{@link placeNameLabel}）。
 */
function nameBlock(user: TachieUser, options: GenerateOptions): string | null {
  const label: NameLabel = options.nameLabel
  const text = resolveDisplayName(user)
  if (!label.show || text === '') return null

  const { left, bottom, width, hideWhenAway, imageNaturalWidth } = options
  const anchors = resolveAnchors(options)
  const font = safeFontFamily(label.fontFamily)
  // 行揃えには箱の幅が要る。幅指定があればそれ、原寸ならアプリ側で測った実サイズを使う。
  // 幅 0 以下は「箱が無い」と同じなので基準に採らない。
  const explicitWidth = width != null && width > 0 ? width : undefined
  const measured =
    explicitWidth == null && imageNaturalWidth != null && imageNaturalWidth > 0
  const boxWidth = explicitWidth ?? (measured ? imageNaturalWidth : undefined)
  // 背景（テロップ帯）を「文字幅」に合わせるモード。帯を縮めるため width を出さず、
  // 立ち絵に対する位置合わせは transform でアンカーする。
  const hug = label.background && label.fit === 'text'
  // 帯を縮めるときだけ、立ち絵の幅を使って行揃えぶん掴み位置をずらす。
  // 幅が分からないなら**アンカーの自然な掴み位置**に落とす（幅なしで成立する唯一の選択。
  // 左アンカーなら左端合わせ＝002 と同じ挙動、右アンカーなら右端合わせ）。
  const shifted = hug && boxWidth != null
  const handleX = shifted ? ALIGN_HANDLE[label.align] : naturalHandleX(anchors.x)
  const pos = placementDecls(
    placeNameLabel(
      anchors,
      { x: left, y: bottom },
      { dx: label.offsetX, dy: label.offsetY },
      handleX,
      boxWidth ?? 0,
    ),
  )
  // ここも transform を出す箇所なので composeTransform を通す（→ 不変条件）。
  const transform = composeTransform(...pos.transforms)
  const pad = label.background && (label.backgroundPadX > 0 || label.backgroundPadY > 0)

  const decls = [
    `  content: ${cssString(text)};`,
    `  position: fixed;`,
    ...pos.decls.map((d) => `  ${d}`),
    // 立ち絵（::after）は ::before より後に描かれるので、重ねたときは名前を前面に出す。
    `  z-index: 1;`,
    `  display: ${hideWhenAway ? 'none' : 'block'};`,
    // 行揃えは幅がないと意味を持たない（幅なしの ::before は文字幅ぴったりに縮む）。
    ...(!hug && boxWidth != null
      ? [`  width: ${boxWidth}px;`, `  text-align: ${label.align};`]
      : []),
    ...(transform ? [`  transform: ${transform};`] : []),
    // 背景（テロップ帯）
    ...(label.background
      ? [
          `  background: ${cssColorWithOpacity(label.backgroundColor, label.backgroundOpacity)};`,
          ...(pad ? [`  padding: ${label.backgroundPadY}px ${label.backgroundPadX}px;`] : []),
          ...(label.backgroundRadius > 0
            ? [`  border-radius: ${label.backgroundRadius}px;`]
            : []),
          // 余白を足しても指定幅からはみ出さないようにする（Streamkit 側の既定に依存しない）。
          ...(pad && !hug && boxWidth != null ? [`  box-sizing: border-box;`] : []),
        ]
      : []),
    ...(font ? [`  font-family: ${font};`] : []),
    // 0 以下は名前が消えるだけなので 1px に丸める（入力欄を空にすると 0 が入る）。
    `  font-size: ${Math.max(1, label.fontSize)}px;`,
    `  font-weight: ${label.bold ? 700 : 400};`,
    `  color: ${safeColor(label.color)};`,
    // 幅 0 の縁取りは出さない（ON のまま太さ 0 にしたら消える、が素直）。
    ...(label.outline && label.outlineWidth > 0
      ? [`  text-shadow: ${textOutline(label.outlineColor, label.outlineWidth)};`]
      : []),
    `  line-height: 1.2;`,
    `  white-space: pre;`,
    `  pointer-events: none;`,
  ]
  // 実測幅を実際に使ったときだけ注記を出す（アンカーの自然位置に合わせる帯など、使っていないなら黙る）。
  const usesBoxWidth =
    boxWidth != null && (!hug || (shifted && handleX !== naturalHandleX(anchors.x)))
  const header =
    measured && usesBoxWidth
      ? `/* 名前（任意テキスト。Streamkit の名前は隠し、これだけを出す）
   位置合わせの基準幅 ${boxWidth}px は立ち絵画像の実サイズ。**画像を差し替えたらCSSを出し直すこと**。 */`
      : `/* 名前（任意テキスト。Streamkit の名前は隠し、これだけを出す） */`
  return `${header}\nbody::before {\n${decls.join('\n')}\n}`
}

/**
 * ぴょこぴょこ（transform 版）。**中央寄せ分の translate を各ステップに前置する** —
 * keyframe の `transform` は要素の `transform` を丸ごと置き換えるので、織り込まないと
 * アニメの間だけ中央寄せが外れて立ち絵が飛ぶ（spec の受け入れ条件）。
 */
const KEYFRAMES_JUMP_TRANSFORM = (jumpPx: number, centering: string[]) => {
  const at = (v: string) => composeTransform(...centering, v)
  return `@keyframes speak-jump {
  0% { transform: ${at('translateY(0)')}; }
  50% { transform: ${at(`translateY(-${jumpPx}px)`)}; }
  100% { transform: ${at('translateY(0)')}; }
}`
}

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
    // メモ名は素通しするとコメントを閉じて任意CSSを差し込めてしまう（cssComment で潰す）。
    const label = u.name ? `  /* ${cssComment(u.name)} (${id}) */` : `  /* ${id} */`
    return [label, `  --img-stand-url-${id}: ${cssUrl(u.imageUrl)};`]
  })
  return `:root {\n${lines.join('\n')}\n}`
}

/** 追加する keyframe 定義を、含まれる effect に応じて集める。 */
function keyframeBlocks(
  effects: Effect[],
  speak: SpeakEffect,
  jumpKind: 'transform' | 'bottom',
  /** 中央寄せ分の translate（transform 版の跳ねに前置する）。 */
  centering: string[] = [],
): string[] {
  const blocks: string[] = []
  if (effects.includes('jump')) {
    blocks.push(
      jumpKind === 'transform'
        ? KEYFRAMES_JUMP_TRANSFORM(speak.jumpPx, centering)
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
  const { left, bottom, width, dimWhenQuiet, hideWhenAway, speak } = options
  const effects = activeEffects(speak)
  // 位置はアンカー基準（未指定は左下＝従来の出力と一致）。中央寄せ分の translate はここで受け取り、
  // 静止時の transform と speak-jump の両方に**同じものを**渡す（→ composeTransform の不変条件）。
  const pos = placementDecls(placeTachie(resolveAnchors(options), left, bottom))
  const staticTransform = composeTransform(...pos.transforms)

  const afterDecls = [
    `  content: var(--img-stand-url-${id});`,
    `  position: fixed;`,
    ...pos.decls.map((d) => `  ${d}`),
    // 通話にいないときは隠す設定なら、既定は非表示（在室時だけ下のルールで出す）。
    `  display: ${hideWhenAway ? 'none' : 'block'};`,
    ...(staticTransform ? [`  transform: ${staticTransform};`] : []),
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

  // 名前（任意テキスト）。表示ON かつ名前が空でないときだけ body::before を足す。
  const nameCss = nameBlock(user, options)
  if (nameCss) parts.push(nameCss)

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

  // 通話にいないときは隠す：本人が接続中は実 img が DOM に出る（display:none でも :has() は一致）。
  // それを検知して、在室（通話中）のときだけ立ち絵を表示する。→ 通話にいない時は非表示。
  if (hideWhenAway) {
    // 名前も立ち絵と一緒に出入りさせる（::before を先に書く＝::after 側の形は従来どおり）。
    const selectors = [
      ...(nameCss ? [`body:has(img[src*="avatars/${id}"])::before`] : []),
      `body:has(img[src*="avatars/${id}"])::after`,
    ]
    parts.push(
      `/* 通話にいないときは隠す：在室（本人が接続中）のときだけ立ち絵${nameCss ? '・名前' : ''}を表示 */
${selectors.join(',\n')} {
  display: block;
}`,
    )
  }

  parts.push(
    `img {\n  display: none !important;\n}`,
    // 名前を出すときだけ「アカウント名を隠している」ことを注記する
    // （名前OFFのときの出力は 001 と同一に保つ）。
    `${
      nameCss ? '/* Streamkit のアカウント名は隠す（名前は上のブロックで出す） */\n' : ''
    }[class*="Voice_name__"], [class*="Voice_user__"] {\n  display: none !important;\n}`,
    ...keyframeBlocks(effects, speak, 'transform', pos.transforms),
  )

  return parts.join('\n\n') + '\n'
}

/**
 * まとめ（combined）。Streamkit の実 img を人ごとに差し替える。1ソースに複数人を出せるが通話中のみ表示。
 *
 * **アンカー（`anchorX`/`anchorY`）は解釈しない**（003 のスコープ外。UI から呼ばない温存コード）。
 * 位置は flex コンテナの padding で出すため、`left`/`bottom` は常に左下からの距離として扱う。
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
    const label = u.name ? `/* ${cssComment(u.name)} */\n` : ''
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
