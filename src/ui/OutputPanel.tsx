import { useMemo, useState } from 'react'
import { generateCss } from '../lib/generateCss'
import { copyText, cssFilename, downloadText } from '../lib/download'
import type { GenerateOptions, TachieUser } from '../lib/types'

interface Props {
  users: TachieUser[]
  options: GenerateOptions
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
 * 出力ステップ。**個別（1人 = 1 ブラウザソース・常時表示）のみ**を出力する。
 * ユーザーごとに `generateCss([u], {..alwaysShow:true})` を並べ、各コピー/DL を提供する。
 * （まとめ版は提供しない。lib の `generateCombinedCss` は温存しているが UI からは出さない。）
 */
export default function OutputPanel({ users, options }: Props) {
  const perPerson = useMemo(
    () =>
      users.map((u) => ({
        user: u,
        css: generateCss([u], { ...options, alwaysShow: true }),
      })),
    [users, options],
  )

  return (
    <div className="panel">
      <h2>出力 CSS（個別）</h2>
      <p className="hint" style={{ marginTop: 0 }}>
        <b style={{ color: 'var(--text)' }}>1人 = 1 ブラウザソース</b>の常時表示CSSです。通話に居なくても
        同じ位置に出て、位置ズレが起きません。人ぶんだけソースを分けて貼ります。
      </p>

      {users.length === 0 ? (
        <p className="empty">ユーザーを追加すると、ここに CSS が出ます。</p>
      ) : (
        perPerson.map(({ user, css }) => (
          <OutBlock
            key={user.id}
            title={user.name || user.id}
            filename={cssFilename(user.name || user.id)}
            css={css}
          />
        ))
      )}

      <ol className="paste-steps">
        <li>
          Discord の <b>Streamkit Overlay</b> で Voice Widget の URL を作る。
        </li>
        <li>
          OBS に <b>ブラウザソース</b>を追加し、その URL を設定する（人ぶんだけ用意）。
        </li>
        <li>
          各ブラウザソースの <b>カスタムCSS</b> 欄に、その人の CSS を貼り付ける（既存は消す）。
        </li>
      </ol>
    </div>
  )
}
