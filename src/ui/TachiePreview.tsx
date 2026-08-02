import { useEffect, useState, type CSSProperties } from 'react'
import type { Preset } from '../lib/types'

interface Props {
  /** プレビューに映すプリセット（見た目の source）。null なら空ビューポート。 */
  preset: Preset | null
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
export default function TachiePreview({ preset, title = 'プレビュー' }: Props) {
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
    width: `${widthPct}%`,
    ['--tp-jump' as string]: `${speak?.jumpPx ?? 0}px`,
    ['--tp-outline' as string]: speak?.outlineColor ?? '#FFFFFF',
    // generateCss と同じく w<=0 は 1px に丸める（プレビューと出力を一致させる）。
    ['--tp-outline-w' as string]: `${Math.max(1, speak?.outlineWidth ?? 2)}px`,
    filter: dimmed ? 'brightness(0.5)' : undefined,
    animation: anims.length ? anims.join(', ') : undefined,
  }

  const rowStyle: CSSProperties = {
    paddingLeft: `${leftPct}%`,
    paddingBottom: `${bottomPct}%`,
  }

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
        {preset && !hiddenNow && (
          <div className="tp-row" style={rowStyle}>
            {preset.imageUrl ? (
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
            )}
          </div>
        )}
      </div>

      <p className="hint">
        透過（市松）背景・基準 1920×1080 での見え方の目安。
        {inCall ? '画面クリックで 発話⇄静か を切替できます。' : '通話にいなくても立ち絵は出ます（常時表示）。'}
        {preset && width == null && ' 幅は原寸＝画像の実サイズで表示。'}
      </p>
    </div>
  )
}
