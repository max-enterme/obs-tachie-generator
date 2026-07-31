import { useMemo, useState } from 'react'
import { generateCss } from '../lib/generateCss'
import { copyText, cssFilename, downloadText } from '../lib/download'
import type { GenerateOptions, TachieUser } from '../lib/types'

interface Props {
  users: TachieUser[]
  options: GenerateOptions
  onChange: (options: GenerateOptions) => void
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

/**
 * 出力ステップ。
 * - 出力モードは「個別（1人=1ソース・常時表示）」と「まとめ（1ソース・通話中のみ）」の2枚カード対比で選ぶ。
 *   モードは `GenerateOptions.alwaysShow` を source of truth として設定する（個別→true / まとめ→false）。
 * - 個別: ユーザーごとに `generateCss([u], {..alwaysShow:true})` を並べる（各コピー/DL）。
 * - まとめ: `generateCss(users, {..alwaysShow:false})` を1本で出す。
 */
export default function OutputPanel({ users, options, onChange }: Props) {
  const individual = options.alwaysShow

  const perPerson = useMemo(
    () =>
      users.map((u) => ({
        user: u,
        css: generateCss([u], { ...options, alwaysShow: true }),
      })),
    [users, options],
  )
  const combined = useMemo(
    () => generateCss(users, { ...options, alwaysShow: false }),
    [users, options],
  )

  function setMode(alwaysShow: boolean) {
    onChange({ ...options, alwaysShow })
  }

  return (
    <div className="panel">
      <h2>出力 CSS</h2>

      <div className="modecards" role="group" aria-label="出力モード">
        <button
          type="button"
          className="modecard"
          aria-pressed={individual}
          onClick={() => setMode(true)}
        >
          <span className="mc-head">
            個別 <span className="rec">推奨</span>
          </span>
          <p>
            1人 = 1 ブラウザソース。<b style={{ color: 'var(--text)' }}>常時表示できる</b>ので通話に
            居なくても同じ位置に出て、位置ズレが起きません。
          </p>
        </button>
        <button
          type="button"
          className="modecard"
          aria-pressed={!individual}
          onClick={() => setMode(false)}
        >
          <span className="mc-head">まとめ版</span>
          <p>
            1ソースに全員。実アイコンを差し替える方式で
            <b style={{ color: 'var(--text)' }}>通話中のユーザーだけ</b>表示（常時表示は不可）。
          </p>
        </button>
      </div>

      {users.length === 0 ? (
        <p className="empty">ユーザーを追加すると、ここに CSS が出ます。</p>
      ) : individual ? (
        <>
          <h3 style={{ fontSize: '0.95rem', margin: '4px 0 8px' }}>
            個別（1人 = 1 ブラウザソース・常時表示）
          </h3>
          {perPerson.map(({ user, css }) => (
            <OutBlock
              key={user.id}
              title={user.name || user.id}
              filename={cssFilename(user.name || user.id)}
              css={css}
            />
          ))}
        </>
      ) : (
        <>
          <h3 style={{ fontSize: '0.95rem', margin: '4px 0 8px' }}>
            まとめ版（1ソースに全員／通話中のみ表示）
          </h3>
          <OutBlock
            title={`まとめ（${users.length}人）`}
            filename="streamkit-all.css"
            css={combined}
          />
          <div className="warnline">
            まとめ版は常時表示にできません（通話中のユーザーだけ表示されます）。常時表示したい場合は
            「個別」を選んでください。
          </div>
        </>
      )}

      <ol className="paste-steps">
        <li>
          Discord の <b>Streamkit Overlay</b> で Voice Widget の URL を作る。
        </li>
        <li>
          OBS に <b>ブラウザソース</b>を追加し、その URL を設定する。
        </li>
        <li>
          ブラウザソースの <b>カスタムCSS</b> 欄に、上の CSS を貼り付ける（既存は消す）。
          {individual && ' 個別は 1人ぶんを 1 ソースずつ。'}
        </li>
      </ol>
    </div>
  )
}
