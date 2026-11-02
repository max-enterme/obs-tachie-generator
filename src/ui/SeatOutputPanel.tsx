import { useState } from 'react'
import { copyText, cssFilename, downloadText } from '../lib/download'
import { generateSeatCss, tachieBoxSize } from '../lib/generateCss'
import { presetToOptions, renderUser, seatPreset, type AppUser, type Preset, type Seat } from '../lib/types'
import { useImageNaturalSizes } from './useImageNaturalSize'

interface Props {
  seat: Seat | null
  users: AppUser[]
  presets: Preset[]
}

export default function SeatOutputPanel({ seat, users, presets }: Props) {
  const [copied, setCopied] = useState(false)
  const label = seat?.name.trim() || '無名の席'
  const candidates = seat?.candidates.flatMap((candidate) => {
    const user = users.find((item) => item.id === candidate.userId)
    const preset = presets.find((item) => item.id === candidate.presetId)
    return user && preset ? [{ user, preset }] : []
  }) ?? []
  const naturalSizes = useImageNaturalSizes(candidates.map(({ preset }) => preset.imageUrl))
  const cands = seat ? candidates.map(({ user, preset }) => {
    const size = naturalSizes[preset.imageUrl]
    return {
      user: renderUser(user, preset),
      options: presetToOptions(seatPreset(preset, seat), size?.width, size?.height),
    }
  }) : []
  const css = seat && cands.length > 0 ? generateSeatCss(seat.name, cands) : null
  const warnings = candidates.flatMap(({ user, preset }, index) => {
    const userLabel = user.name || user.id
    const presetLabel = preset.name || '(無名プリセット)'
    const options = cands[index].options
    const warnings: string[] = []
    if (
      (preset.mouthImageUrl ?? '').trim() &&
      tachieBoxSize(options.width, options.imageNaturalWidth, options.imageNaturalHeight) === null
    ) {
      warnings.push(`「${userLabel} × ${presetLabel}」の立ち絵の大きさが測れていないため、この候補の口パクは出力に入りません。`)
    }
    if (!preset.imageUrl.trim()) {
      warnings.push(`「${userLabel} × ${presetLabel}」に立ち絵の画像がありません。この人が通話にいる間は席に何も出ず、下の候補も出ません。`)
    }
    return warnings
  })

  async function onCopy() {
    if (!css) return
    const ok = await copyText(css)
    setCopied(ok)
    if (ok) window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="panel">
      <h2>出力 CSS（選択中の席）</h2>
      <p className="hint">
        <b>1 席 = 1 ブラウザソース</b>の CSS です。候補のうち通話にいる人を、上の人を優先して 1 人だけ出します。
      </p>
      {warnings.map((warning) => (
        <p key={warning} className="hint" style={{ color: 'var(--warn)' }} role="status">
          {warning}
        </p>
      ))}
      {!css ? (
        <p className="empty">候補を追加すると、ここに CSS が出ます。</p>
      ) : (
        <div className="output-block">
          <div className="head">
            <span className="title">{label}</span>
            <div className="actions">
              {copied && <span className="badge">コピーしました</span>}
              <button type="button" onClick={onCopy}>
                コピー
              </button>
              <button type="button" onClick={() => downloadText(cssFilename(`席-${label}`), css)}>
                ダウンロード
              </button>
            </div>
          </div>
          <textarea className="css-out" readOnly value={css} spellCheck={false} />
        </div>
      )}
      <ol className="paste-steps">
        <li>
          Discord の <b>Streamkit Overlay</b> で Voice Widget の URL を作る。
        </li>
        <li>
          OBS に <b>ブラウザソース</b>を 1 つ追加し、その URL を設定する（席 1 つにつき 1 つ）。
        </li>
        <li>
          そのブラウザソースの <b>カスタムCSS</b> 欄に、この席の CSS を貼り付ける（既存は消す）。
        </li>
      </ol>
    </div>
  )
}
