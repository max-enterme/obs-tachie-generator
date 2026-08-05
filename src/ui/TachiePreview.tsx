import { useEffect, useState, type CSSProperties } from 'react'
import {
  ALIGN_HANDLE,
  cssColorWithOpacity,
  flattenText,
  naturalHandleX,
  placeNameLabel,
  placeTachie,
  safeColor,
  safeFontFamily,
  type AxisPlacement,
  type Placement,
} from '../lib/generateCss'
import { resolveAnchors, type Preset } from '../lib/types'

interface Props {
  /** プレビューに映すプリセット（見た目の source）。null なら空ビューポート。 */
  preset: Preset | null
  /** 名前表示ONのときに描くテキスト。 */
  nameText?: string
  /**
   * `nameText` が空のとき、仮名（「名前」）で見え方だけ見せるか。
   * ②（プリセット編集＝まだ「誰」が決まっていない）では true、
   * ③（出力）では **false**：出力CSSは名前が空なら `body::before` を出さないので、
   * 仮名を出すとプレビューと出力が食い違う。
   */
  sampleWhenEmpty?: boolean
  /** 見出し。既定は「プレビュー」。 */
  title?: string
}

/** プレビューの基準ビューポート（OBS ブラウザソースを 1920x1080 と仮定）。 */
const REF_W = 1920
const REF_H = 1080
/** 画像がまだ読めておらず幅も原寸指定のときの仮幅(px 相当)。 */
const FALLBACK_WIDTH = 384

/**
 * 出力CSS の px を、プレビュー比率の長さにする（`cqw` = コンテナ幅の1%）。
 * 文字サイズ・縁取り・跳ね高さのように**長さで効くもの**は、位置と同じくここを通さないと
 * プレビューだけ実寸で描かれて出力と見え方がズレる。
 */
function cqw(v: number): string {
  return `${(v / REF_W) * 100}cqw`
}

/**
 * 出力CSS の {@link AxisPlacement} を、プレビュー比率（基準1920×1080 に対する %）の CSS 値にする。
 * **座標の決め方は出力CSSと同じ関数（`placeTachie` / `placeNameLabel`）が持ち、
 * ここは単位の付け替えだけ**をする（プレビューと出力がズレないように）。
 */
function axisValue(a: AxisPlacement): string {
  const pct = Math.round((a.distance / (a.axis === 'X' ? REF_W : REF_H)) * 100 * 1000) / 1000
  if (!a.fromCenter) return `${pct}%`
  if (pct === 0) return '50%'
  return `calc(50% ${pct > 0 ? '+' : '-'} ${Math.abs(pct)}%)`
}

/** 配置を位置プロパティ（`left`/`right`/`top`/`bottom`）の style にする。 */
function placementStyle(p: Placement): CSSProperties {
  return { [p.x.prop]: axisValue(p.x), [p.y.prop]: axisValue(p.y) } as CSSProperties
}

/**
 * 配置の translate 断片（中央寄せ・帯の行揃え分）。translate の % は自分のサイズ基準なので、
 * px か % かに関係なくそのまま使える。
 */
function placementTransform(p: Placement): string | undefined {
  const parts = [p.x, p.y]
    .filter((a) => a.translatePct !== 0)
    .map((a) => `translate${a.axis}(${a.translatePct}%)`)
  return parts.length > 0 ? parts.join(' ') : undefined
}

/**
 * OBS ビューポート風のプレビュー。透過市松背景に、プリセットの立ち絵を left/bottom/width で配置する。
 * - **通話にいる/いない** をトグルで切替（常時表示なので、通話にいなくても立ち絵は出る）。
 * - **画面クリックで 発話⇄静か** を切替（通話中のみ）。発話中は跳ね／枠・後光／点滅を再生。
 * - 幅が原寸（未指定）のときは、画像の**実サイズ**を基準1920に対する割合で描く（960px画像＝約50%）。
 * 画像はプリセット由来で、ユーザーIDは見た目に出ない。
 */
export default function TachiePreview({
  preset,
  nameText = '',
  sampleWhenEmpty = false,
  title = 'プレビュー',
}: Props) {
  const [inCall, setInCall] = useState(true)
  const [speaking, setSpeaking] = useState(false)
  const [naturalW, setNaturalW] = useState<number | null>(null)

  // 画像が変わったら実測幅をリセット（onLoad で入れ直す）。
  useEffect(() => {
    setNaturalW(null)
  }, [preset?.imageUrl])

  const left = preset?.left ?? 0
  const bottom = preset?.bottom ?? 0
  const width = preset?.width
  const speak = preset?.speak
  const dimWhenQuiet = preset?.dimWhenQuiet ?? false

  // 発話演出が出るのは「通話中 かつ 発話中」だけ。
  const effectiveSpeaking = inCall && speaking
  // 幅は 明示指定 > 画像の実サイズ > 仮幅 の順。
  const effWidth = width ?? naturalW ?? FALLBACK_WIDTH
  const widthPct = (effWidth / REF_W) * 100
  // 位置は出力CSSと同じ関数で決める（未指定は左下）。
  const anchors = resolveAnchors(preset ?? {})
  const tachiePlace = placeTachie(anchors, left, bottom)
  // 中央寄せ分の translate。跳ねの keyframe は transform を置換するので、変数で織り込む
  // （出力CSS の `composeTransform` + keyframe への前置と同じ手当て）。
  const centering = placementTransform(tachiePlace)

  const anims: string[] = []
  if (effectiveSpeaking && speak) {
    if (speak.bounce && speak.jumpPx > 0) {
      anims.push(`tachie-preview-jump ${speak.durationMs}ms infinite alternate ease-in-out`)
    }
    if (speak.outline) {
      anims.push(`tachie-preview-light ${speak.durationMs}ms infinite alternate ease-in-out`)
    }
    if (speak.blink) {
      anims.push(`tachie-preview-blink ${speak.durationMs}ms infinite alternate ease-in-out`)
    }
  }

  // 静かな人を暗くする：発話していない間は暗い（通話にいない時も＝発話していないので暗い）。
  const dimmed = dimWhenQuiet && !effectiveSpeaking

  const figStyle: CSSProperties = {
    // 立ち絵もビューポート基準の絶対配置にする（名前ラベルと同じ座標系。
    // 余白(padding)で寄せると % がその分だけ縮んだ幅に対して解決され、実寸とズレる）。
    ...placementStyle(tachiePlace),
    width: `${widthPct}%`,
    transform: centering,
    // 跳ねの keyframe が前置する中央寄せ分（無いときは無害な translateX(0)）。
    ['--tp-center' as string]: centering ?? 'translateX(0)',
    // 跳ね・縁取りは「長さ」なのでプレビュー比率へ落とす（実ピクセルのままだと
    // プレビューだけ大きく見えて出力と食い違う）。
    ['--tp-jump' as string]: cqw(speak?.jumpPx ?? 0),
    ['--tp-outline' as string]: speak?.outlineColor ?? '#FFFFFF',
    // generateCss と同じく w<=0 は 1px に丸める（プレビューと出力を一致させる）。
    ['--tp-outline-w' as string]: cqw(Math.max(1, speak?.outlineWidth ?? 2)),
    filter: dimmed ? 'brightness(0.5)' : undefined,
    animation: anims.length ? anims.join(', ') : undefined,
  }

  // --- 名前ラベル（出力CSSの body::before と同じ計算をプレビュー比率に写す） ---
  const label = preset?.nameLabel
  // 出力の content と同じ正規化（改行・制御文字は空白へ潰して1行に）。
  const cleanedName = flattenText(nameText).trim()
  const usingSample = cleanedName === '' && sampleWhenEmpty
  const labelText = cleanedName || '名前'
  // 出力CSSは「名前が空なら body::before を出さない」。仮名を出さない画面では同じく描かない。
  const showLabel = (label?.show ?? false) && (cleanedName !== '' || usingSample)
  // 名前表示ONなのに名前が空＝出力に出ない、を気づけるようにする。
  const emptyNameWarning = (label?.show ?? false) && cleanedName === '' && !usingSample
  // 文字サイズ・縁取り幅はビューポート幅に比例させる（→ モジュール先頭の cqw）。
  // 行揃えの基準幅：明示指定 > 画像の実サイズ（出力CSSの箱幅と同じ決め方）。
  const nameBoxWidth = width ?? naturalW ?? undefined
  // 帯を文字幅に合わせるモードでは width を持たせず、transform で立ち絵に位置合わせする（出力CSSと同じ）。
  const hug = (label?.background ?? false) && label?.fit === 'text'
  // 出力CSS（nameBlock）と同じ落としどころ：幅が分からないならアンカーの自然位置に寄せる。
  const shifted = hug && nameBoxWidth != null
  const namePlace = label
    ? placeNameLabel(
        anchors,
        { x: left, y: bottom },
        { dx: label.offsetX, dy: label.offsetY },
        shifted ? ALIGN_HANDLE[label.align] : naturalHandleX(anchors.x),
        nameBoxWidth ?? 0,
      )
    : null
  const nameStyle: CSSProperties = label && namePlace
    ? {
        ...placementStyle(namePlace),
        transform: placementTransform(namePlace),
        width: !hug && nameBoxWidth != null ? `${(nameBoxWidth / REF_W) * 100}%` : undefined,
        textAlign: !hug && nameBoxWidth != null ? label.align : undefined,
        boxSizing: 'border-box',
        background: label.background
          ? cssColorWithOpacity(label.backgroundColor, label.backgroundOpacity)
          : undefined,
        padding: label.background
          ? `${cqw(label.backgroundPadY)} ${cqw(label.backgroundPadX)}`
          : undefined,
        borderRadius: label.background ? cqw(label.backgroundRadius) : undefined,
        // 出力と同じ安全化・丸めを通す（プレビューだけ違う見え方にならないように）。
        fontSize: cqw(Math.max(1, label.fontSize)),
        fontWeight: label.bold ? 700 : 400,
        fontFamily: safeFontFamily(label.fontFamily) || undefined,
        color: safeColor(label.color),
        textShadow: label.outline && label.outlineWidth > 0
          ? [
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
              [1, 1],
              [1, -1],
              [-1, 1],
              [-1, -1],
            ]
              .map(
                ([x, y]) =>
                  `${cqw(x * label.outlineWidth)} ${cqw(y * label.outlineWidth)} 0 ${safeColor(
                    label.outlineColor,
                  )}`,
              )
              .join(', ')
          : undefined,
      }
    : {}

  // 「通話にいないときは立ち絵を隠す」設定 かつ 通話にいない なら、立ち絵は非表示。
  const hiddenNow = (preset?.hideWhenAway ?? false) && !inCall

  const status = hiddenNow
    ? '通話にいない（この設定では立ち絵は非表示）'
    : !inCall
      ? '通話にいない（立ち絵は常時表示）'
      : effectiveSpeaking
        ? '通話中・発話中'
        : '通話中・静か'

  return (
    <div className="panel">
      <div className="tp-head">
        <h2 style={{ margin: 0 }}>{title}</h2>
        <label className="toggle" style={{ padding: 0 }}>
          <input
            type="checkbox"
            checked={inCall}
            onChange={(e) => setInCall(e.target.checked)}
          />
          <span className="sw" />
          <span className="lab" style={{ fontSize: '0.84rem' }}>
            {inCall ? '通話中' : '通話にいない'}
          </span>
        </label>
      </div>

      <div
        className="tp-viewport"
        role="button"
        tabIndex={0}
        aria-label={`立ち絵プレビュー。クリックで発話⇄静かを切替。現在: ${status}`}
        aria-pressed={effectiveSpeaking}
        style={{ cursor: inCall ? 'pointer' : 'default' }}
        onClick={() => {
          if (inCall) setSpeaking((s) => !s)
        }}
        onKeyDown={(e) => {
          if (inCall && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            setSpeaking((s) => !s)
          }
        }}
      >
        <span className="tp-status">{status}</span>
        {preset &&
          !hiddenNow &&
          (preset.imageUrl ? (
            <img
              className="tp-img"
              style={figStyle}
              src={preset.imageUrl}
              alt={preset.name || 'プリセット'}
              onLoad={(e) => setNaturalW(e.currentTarget.naturalWidth || null)}
            />
          ) : (
            <div className="tp-placeholder" style={figStyle} aria-label="画像未設定">
              <span>立ち絵</span>
            </div>
          ))}
        {showLabel && !hiddenNow && (
          <div className="tp-name" style={nameStyle}>
            {labelText}
          </div>
        )}
      </div>

      <p className="hint">
        透過（市松）背景・基準 1920×1080 での見え方の目安。
        {inCall ? '画面クリックで 発話⇄静か を切替できます。' : '通話にいなくても立ち絵は出ます（常時表示）。'}
        {preset && width == null && ' 幅は原寸＝画像の実サイズで表示。'}
        {usingSample && ' 名前は仮名（実際はユーザーの「画面に出す名前」）。'}
      </p>
      {emptyNameWarning && (
        <p className="hint" style={{ color: 'var(--warn)' }} role="status">
          名前表示は ON ですが「画面に出す名前」が空のため、出力CSSに名前は入りません（ステップ①で入力してください）。
        </p>
      )}
    </div>
  )
}
