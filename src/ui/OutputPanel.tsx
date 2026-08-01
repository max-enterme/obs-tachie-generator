import { useMemo, useState } from 'react'
import { generateCss } from '../lib/generateCss'
import { copyText, cssFilename, downloadText } from '../lib/download'
import { presetToOptions, renderUser, type AppUser, type Pairing, type Preset } from '../lib/types'

interface Props {
  users: AppUser[]
  presets: Preset[]
  pairings: Pairing[]
}

interface OutBlockProps {
  title: string
  filename: string
  css: string
}

function OutBlock({ title, filename, css }: OutBlockProps) {
  const [copied, setCopied] = useState(false)

  async function onCopy() {
    const ok = await copyText(css)
    setCopied(ok)
    if (ok) window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="output-block">
      <div className="head">
        <span className="title">{title}</span>
        <div className="actions">
          {copied && <span className="badge">コピーしました</span>}
          <button onClick={onCopy}>コピー</button>
          <button onClick={() => downloadText(filename, css)}>ダウンロード</button>
        </div>
      </div>
      <textarea className="css-out" readOnly value={css} spellCheck={false} />
    </div>
  )
}

/**
 * 出力ステップ。**ペアごと**に個別（1人 = 1 ブラウザソース・常時表示）CSS を出す。
 * `generateCss([renderUser(user, preset)], presetToOptions(preset))` で合成して呼ぶ。
 * まとめ版は出さない（lib の `generateCombinedCss` は温存しているが UI からは呼ばない）。
 */
export default function OutputPanel({ users, presets, pairings }: Props) {
  const blocks = useMemo(
    () =>
      pairings
        .map((pair) => {
          const user = users.find((u) => u.id === pair.userId)
          const preset = presets.find((p) => p.id === pair.presetId)
          if (!user || !preset) return null
          const userLabel = user.name || user.id
          const presetLabel = preset.name || 'preset'
          return {
            key: `${pair.userId}-${pair.presetId}`,
            title: `${userLabel} × ${preset.name || '(無名プリセット)'}`,
            filename: cssFilename(`${userLabel}-${presetLabel}`),
            css: generateCss([renderUser(user, preset)], presetToOptions(preset)),
          }
        })
        .filter((b): b is NonNullable<typeof b> => b !== null),
    [users, presets, pairings],
  )

  return (
    <div className="panel">
      <h2>出力 CSS（ペアごと）</h2>
      <p className="hint" style={{ marginTop: 0 }}>
        <b style={{ color: 'var(--text)' }}>1 ペア = 1 ブラウザソース</b>の常時表示CSSです。通話に居なくても
        同じ位置に出て、位置ズレが起きません。
      </p>

      {blocks.length === 0 ? (
        <p className="empty">③でユーザー × プリセットのペアを作ると、ここに CSS が出ます。</p>
      ) : (
        blocks.map((b) => (
          <OutBlock key={b.key} title={b.title} filename={b.filename} css={b.css} />
        ))
      )}

      <ol className="paste-steps">
        <li>
          Discord の <b>Streamkit Overlay</b> で Voice Widget の URL を作る。
        </li>
        <li>
          OBS に <b>ブラウザソース</b>を追加し、その URL を設定する（ペアぶんだけ用意）。
        </li>
        <li>
          各ブラウザソースの <b>カスタムCSS</b> 欄に、そのペアの CSS を貼り付ける（既存は消す）。
        </li>
      </ol>
    </div>
  )
}
