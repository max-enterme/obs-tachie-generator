import { useMemo, useState } from 'react'
import { generateCss } from '../lib/generateCss'
import { copyText, cssFilename, downloadText } from '../lib/download'
import { presetToOptions, renderUser, type AppUser, type Preset } from '../lib/types'

interface Props {
  /** 作業中選択のユーザー（未選択なら null）。 */
  user: AppUser | null
  /** 作業中選択のプリセット（未選択なら null）。 */
  preset: Preset | null
  /** 立ち絵画像の実サイズ（幅 px）。幅が原寸のときの名前ラベルの行揃えに使う。 */
  imageNaturalWidth?: number | null
}

/**
 * 出力ステップ。**作業中の選択1組**の個別（1人=1ソース・常時表示）CSS を出す。
 * `generateCss([renderUser(user, preset)], presetToOptions(preset))` で合成。
 * まとめ版は出さない（lib の `generateCombinedCss` は温存しているが UI からは呼ばない）。
 */
export default function OutputPanel({ user, preset, imageNaturalWidth }: Props) {
  const [copied, setCopied] = useState(false)

  const out = useMemo(() => {
    if (!user || !preset) return null
    const userLabel = user.name || user.id
    const presetLabel = preset.name || 'preset'
    return {
      title: `${userLabel} × ${preset.name || '(無名プリセット)'}`,
      filename: cssFilename(`${userLabel}-${presetLabel}`),
      css: generateCss(
        [renderUser(user, preset)],
        presetToOptions(preset, imageNaturalWidth ?? undefined),
      ),
    }
  }, [user, preset, imageNaturalWidth])

  // 行揃え（左以外）や「立ち絵の幅いっぱい」の帯は箱幅が要る。幅未指定＋実測できずだと
  // 設定だけ残って出力から黙って消えるので、その状態を明示する。
  const label = preset?.nameLabel
  const needsBoxWidth =
    (label?.show ?? false) &&
    (label?.align !== 'left' || (label.background && label.fit === 'stretch'))
  const alignUnavailable =
    needsBoxWidth && (preset?.width == null || preset.width <= 0) && imageNaturalWidth == null

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

      {alignUnavailable && (
        <p className="hint" style={{ color: 'var(--warn)' }} role="status">
          立ち絵の幅が確定していないため、名前の行揃え（
          {preset?.nameLabel.align === 'right' ? '右' : '中央'}）は出力に入っていません。
          画像を測定中か、画像を読み込めていません。「位置とサイズ」で
          <b style={{ color: 'var(--text)' }}>幅 width(px)</b> を指定すると確実に入ります。
        </p>
      )}

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
