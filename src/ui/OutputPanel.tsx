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
  note?: string
}

function OutBlock({ title, filename, css, note }: OutBlockProps) {
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
      {note && <p className="hint">{note}</p>}
      <textarea className="css-out" readOnly value={css} spellCheck={false} />
    </div>
  )
}

export default function OutputPanel({ users, options }: Props) {
  const perPerson = useMemo(
    () =>
      users.map((u) => ({
        user: u,
        css: generateCss([u], options),
      })),
    [users, options],
  )
  const combined = useMemo(() => generateCss(users, options), [users, options])

  if (users.length === 0) {
    return (
      <div className="panel">
        <h2>出力 CSS</h2>
        <p className="empty">ユーザーを追加すると、ここに CSS が出ます。</p>
      </div>
    )
  }

  return (
    <div className="panel">
      <h2>出力 CSS</h2>

      <h3 style={{ fontSize: '0.95rem', margin: '4px 0 8px' }}>
        個別（1人 = 1 ブラウザソース{options.alwaysShow ? '・常時表示' : ''}）
      </h3>
      {perPerson.map(({ user, css }) => (
        <OutBlock
          key={user.id}
          title={user.name || user.id}
          filename={cssFilename(user.name || user.id)}
          css={css}
        />
      ))}

      {users.length > 1 && (
        <>
          <h3 style={{ fontSize: '0.95rem', margin: '14px 0 8px' }}>
            まとめ版（1ソースに全員／通話中のみ表示）
          </h3>
          <OutBlock
            title={`まとめ（${users.length}人）`}
            filename="streamkit-all.css"
            css={combined}
            note={
              options.alwaysShow
                ? 'まとめ版は常時表示にできません（通話中のユーザーだけ表示されます）。'
                : undefined
            }
          />
        </>
      )}
    </div>
  )
}
