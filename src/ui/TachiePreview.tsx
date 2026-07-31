import { useState, type CSSProperties } from 'react'
import type { GenerateOptions, TachieUser } from '../lib/types'

interface Props {
  users: TachieUser[]
  options: GenerateOptions
}

/** プレビューの基準ビューポート（OBS ブラウザソースを 1920x1080 と仮定）。 */
const REF_W = 1920
const REF_H = 1080
/** width 未指定（原寸）のときの仮の見かけ幅(px 相当)。 */
const DEFAULT_PREVIEW_WIDTH = 384

/**
 * OBS ビューポート風のプレビュー。透過を示す市松背景に、left/bottom/width で立ち絵を配置し、
 * 「発話プレビュー」で跳ね／白フチを再生する。位置・サイズは基準 1920x1080 に対する割合で描く
 * （実機のブラウザソース解像度により見え方は多少変わる）。
 */
export default function TachiePreview({ users, options }: Props) {
  const [speaking, setSpeaking] = useState(false)

  const { left, bottom, width, dimWhenQuiet, speak } = options
  const leftPct = (left / REF_W) * 100
  const bottomPct = (bottom / REF_H) * 100
  const widthPct = ((width ?? DEFAULT_PREVIEW_WIDTH) / REF_W) * 100

  const anims: string[] = []
  if (speaking && speak.enabled) {
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

  const imgStyle: CSSProperties = {
    width: `${widthPct}%`,
    ['--tp-jump' as string]: `${speak.jumpPx}px`,
    ['--tp-outline' as string]: speak.outlineColor,
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
        <h2 style={{ margin: 0 }}>プレビュー</h2>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={speaking}
            onChange={(e) => setSpeaking(e.target.checked)}
            disabled={!speak.enabled}
          />
          発話プレビュー
        </label>
      </div>

      <div className="tp-viewport" aria-label="立ち絵プレビュー">
        {users.length > 0 && (
          <div className="tp-row" style={rowStyle}>
            {users.map((u) => (
              <img
                key={u.id}
                className="tp-img"
                style={imgStyle}
                src={u.imageUrl}
                alt={u.name || u.id}
              />
            ))}
          </div>
        )}
      </div>

      <p className="hint">
        透過（市松）背景・基準 1920×1080 での見え方の目安です。
        {width == null && '（幅は原寸指定のため仮サイズで表示）'}
        {options.alwaysShow
          ? ' 個別出力は 1人=1ソースの常時表示。'
          : ' まとめ版は通話中のユーザーだけが横並びで出ます。'}
      </p>
    </div>
  )
}
