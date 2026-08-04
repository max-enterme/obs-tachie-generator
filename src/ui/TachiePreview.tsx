import { useEffect, useState, type CSSProperties } from 'react'
import {
  cssColorWithOpacity,
  flattenText,
  safeColor,
  safeFontFamily,
} from '../lib/generateCss'
import type { Preset } from '../lib/types'

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
  const leftPct = (left / REF_W) * 100
  const bottomPct = (bottom / REF_H) * 100
  const widthPct = (effWidth / REF_W) * 100

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
    left: `${leftPct}%`,
    bottom: `${bottomPct}%`,
    width: `${widthPct}%`,
    ['--tp-jump' as string]: `${speak?.jumpPx ?? 0}px`,
    ['--tp-outline' as string]: speak?.outlineColor ?? '#FFFFFF',
    // generateCss と同じく w<=0 は 1px に丸める（プレビューと出力を一致させる）。
    ['--tp-outline-w' as string]: `${Math.max(1, speak?.outlineWidth ?? 2)}px`,
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
  // 文字サイズ・縁取り幅はビューポート幅に比例させる（cqw = コンテナ幅の1%）。
  const cqw = (px: number) => `${(px / REF_W) * 100}cqw`
  // 行揃えの基準幅：明示指定 > 画像の実サイズ（出力CSSの箱幅と同じ決め方）。
  const nameBoxWidth = width ?? naturalW ?? undefined
  // 帯を文字幅に合わせるモードでは width を持たせず、transform で立ち絵に位置合わせする（出力CSSと同じ）。
  const hug = (label?.background ?? false) && label?.fit === 'text'
  const anchor = hug && nameBoxWidth != null && label ? label.align : 'left'
  const anchorShift =
    anchor === 'center' ? (nameBoxWidth ?? 0) / 2 : anchor === 'right' ? (nameBoxWidth ?? 0) : 0
  const nameStyle: CSSProperties = label
    ? {
        left: `${((left + label.offsetX + anchorShift) / REF_W) * 100}%`,
        bottom: `${((bottom + label.offsetY) / REF_H) * 100}%`,
        transform:
          anchor === 'center'
            ? 'translateX(-50%)'
            : anchor === 'right'
              ? 'translateX(-100%)'
              : undefined,
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
