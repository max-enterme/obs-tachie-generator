import { useState } from 'react'
import { copyText, cssFilename, downloadText } from '../lib/download'
import type { Seat } from '../lib/types'

interface Props {
  seat: Seat | null
  css: string | null
  warnings: string[]
}

export default function SeatOutputPanel({ seat, css, warnings }: Props) {
  const [copied, setCopied] = useState(false)
  const label = seat?.name.trim() || '無名の席'

  async function onCopy() {
    if (!css) return
    const ok = await copyText(css)
    setCopied(ok)
    if (ok) window.setTimeout(() => setCopied(false), 1500)
  }

  return <div className="panel">
    <h2>出力 CSS（選択中の席）</h2>
    <p className="hint"><b>1 席 = 1 ブラウザソース</b>の CSS です。候補のうち通話にいる人を、上の人を優先して 1 人だけ出します。</p>
    {warnings.map((warning) => <p key={warning} className="hint" style={{ color: 'var(--warn)' }} role="status">{warning}</p>)}
    {!css ? <p className="empty">候補を追加すると、ここに CSS が出ます。</p> : <div className="output-block">
      <div className="head"><span className="title">{label}</span><div className="actions">
        {copied && <span className="badge">コピーしました</span>}
        <button type="button" onClick={onCopy}>コピー</button>
        <button type="button" onClick={() => downloadText(cssFilename(`席-${label}`), css)}>ダウンロード</button>
      </div></div>
      <textarea className="css-out" readOnly value={css} spellCheck={false} />
    </div>}
    <ol className="paste-steps">
      <li>Discord の <b>Streamkit Overlay</b> で Voice Widget の URL を作る。</li>
      <li>OBS に <b>ブラウザソース</b>を 1 つ追加し、その URL を設定する（席 1 つにつき 1 つ）。</li>
      <li>そのブラウザソースの <b>カスタムCSS</b> 欄に、この席の CSS を貼り付ける（既存は消す）。</li>
    </ol>
  </div>
}
