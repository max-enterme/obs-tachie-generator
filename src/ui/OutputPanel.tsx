import { useMemo, useState } from 'react'
import { generateCss } from '../lib/generateCss'
import { copyText, cssFilename, downloadText } from '../lib/download'
import { presetToOptions, renderUser, type AppUser, type Preset } from '../lib/types'

interface Props {
  /** 作業中選択のユーザー（未選択なら null）。 */
  user: AppUser | null
  /** 作業中選択のプリセット（未選択なら null）。 */
  preset: Preset | null
}

/**
 * 出力ステップ。**作業中の選択1組**の個別（1人=1ソース・常時表示）CSS を出す。
 * `generateCss([renderUser(user, preset)], presetToOptions(preset))` で合成。
 * まとめ版は出さない（lib の `generateCombinedCss` は温存しているが UI からは呼ばない）。
 */
export default function OutputPanel({ user, preset }: Props) {
  const [copied, setCopied] = useState(false)

  const out = useMemo(() => {
    if (!user || !preset) return null
    const userLabel = user.name || user.id
    const presetLabel = preset.name || 'preset'
    return {
      title: `${userLabel} × ${preset.name || '(無名プリセット)'}`,
      filename: cssFilename(`${userLabel}-${presetLabel}`),
      css: generateCss([renderUser(user, preset)], presetToOptions(preset)),
    }
  }, [user, preset])

  async function onCopy() {
    if (!out) return
    const ok = await copyText(out.css)
    setCopied(ok)
    if (ok) window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="panel">
      <h2>出力 CSS（選択中のペア）</h2>
      <p className="hint" style={{ marginTop: 0 }}>
        <b style={{ color: 'var(--text)' }}>1 ペア = 1 ブラウザソース</b>の常時表示CSSです。上の選択に
        即追従します。通話に居なくても同じ位置に出て、位置ズレが起きません。
      </p>

      {!out ? (
        <p className="empty">ユーザーとプリセットを選ぶと、ここに CSS が出ます。</p>
      ) : (
        <div className="output-block">
          <div className="head">
            <span className="title">{out.title}</span>
            <div className="actions">
              {copied && <span className="badge">コピーしました</span>}
              <button onClick={onCopy}>コピー</button>
              <button onClick={() => downloadText(out.filename, out.css)}>ダウンロード</button>
            </div>
          </div>
          <textarea className="css-out" readOnly value={out.css} spellCheck={false} />
        </div>
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
