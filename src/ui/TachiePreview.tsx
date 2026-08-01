import { type CSSProperties } from 'react'
import type { Preset } from '../lib/types'

interface Props {
  /** プレビューに映すプリセット（見た目の source）。null なら空ビューポート。 */
  preset: Preset | null
  /** 発話プレビューの再生状態（App で持ち上げ、sticky 小 と ステップ③大 で共有）。 */
  speaking: boolean
  onSpeakingChange: (speaking: boolean) => void
  /** 見出し。既定は「プレビュー」。 */
  title?: string
  /** 発話プレビュートグルの id（複数描画時に一意化）。 */
  toggleId?: string
}

/** プレビューの基準ビューポート（OBS ブラウザソースを 1920x1080 と仮定）。 */
const REF_W = 1920
const REF_H = 1080
/** width 未指定（原寸）のときの仮の見かけ幅(px 相当)。 */
const DEFAULT_PREVIEW_WIDTH = 384

/**
 * OBS ビューポート風のプレビュー。透過を示す市松背景に、プリセットの立ち絵を left/bottom/width で配置し、
 * 「発話プレビュー」で跳ね／白フチ／点滅を再生する。画像は<b>プリセット由来</b>で、ユーザーIDは見た目に出ない。
 * `speaking` は親（App）が持つ状態で、sticky 小プレビューと ステップ③の大プレビューで同期する。
 */
export default function TachiePreview({
  preset,
  speaking,
  onSpeakingChange,
  title = 'プレビュー',
  toggleId = 'tp-speaking',
}: Props) {
  const left = preset?.left ?? 0
  const bottom = preset?.bottom ?? 0
  const width = preset?.width
  const speak = preset?.speak
  const dimWhenQuiet = preset?.dimWhenQuiet ?? false

  const leftPct = (left / REF_W) * 100
  const bottomPct = (bottom / REF_H) * 100
  const widthPct = ((width ?? DEFAULT_PREVIEW_WIDTH) / REF_W) * 100

  const anims: string[] = []
  if (speaking && speak) {
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

  // 静かな人を暗くする：発話プレビューが off のときだけ暗く（発話中はアニメ or 素の明るさ）
  const dimmed = dimWhenQuiet && !speaking

  const figStyle: CSSProperties = {
    width: `${widthPct}%`,
    ['--tp-jump' as string]: `${speak?.jumpPx ?? 0}px`,
    ['--tp-outline' as string]: speak?.outlineColor ?? '#FFFFFF',
    filter: dimmed ? 'brightness(0.5)' : undefined,
    animation: anims.length ? anims.join(', ') : undefined,
  }

  const rowStyle: CSSProperties = {
    paddingLeft: `${leftPct}%`,
    paddingBottom: `${bottomPct}%`,
  }

  return (
    <div className="panel">
      <div className="tp-head">
        <h2 style={{ margin: 0 }}>{title}</h2>
        <label className="toggle" htmlFor={toggleId} style={{ padding: 0 }}>
          <input
            id={toggleId}
            type="checkbox"
            checked={speaking}
            onChange={(e) => onSpeakingChange(e.target.checked)}
          />
          <span className="sw" />
          <span className="lab" style={{ fontSize: '0.84rem' }}>
            発話プレビュー
          </span>
        </label>
      </div>

      <div className="tp-viewport" aria-label="立ち絵プレビュー">
        {preset && (
          <div className="tp-row" style={rowStyle}>
            {preset.imageUrl ? (
              <img
                className="tp-img"
                style={figStyle}
                src={preset.imageUrl}
                alt={preset.name || 'プリセット'}
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
        透過（市松）背景・基準 1920×1080 での見え方の目安です。
        {preset == null && ' プリセットを選ぶと、その見た目を表示します。'}
        {preset && width == null && '（幅は原寸指定のため仮サイズで表示）'}
        {preset && ' 出力は個別（1ペア=1ソースの常時表示）。'}
      </p>
    </div>
  )
}
