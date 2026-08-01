import { useState } from 'react'
import type { AppUser, Pairing, Preset } from '../lib/types'

interface Props {
  users: AppUser[]
  presets: Preset[]
  pairings: Pairing[]
  onAdd: (pairing: Pairing) => void
  onRemove: (index: number) => void
  /** 既存ペアのユーザー参照を後から差し替える（テスト用ID↔本番ID の切替導線）。 */
  onChangeUser: (index: number, userId: string) => void
  /** プレビューに映すプリセットを親へ通知する。 */
  onFocusPreset: (presetId: string) => void
}

function userLabel(u: AppUser): string {
  return u.name ? `${u.name}（${u.id}）` : u.id
}

/**
 * ユーザー × プリセットの明示ペアを作る。ペアごとに 1 ブラウザソースの CSS を出力する。
 * 既存ペアの「ユーザー」はプルダウンで差し替え可能（IDだけ差し替えて見た目は据え置き）。
 */
export default function PairingPanel({
  users,
  presets,
  pairings,
  onAdd,
  onRemove,
  onChangeUser,
  onFocusPreset,
}: Props) {
  const [selUserId, setSelUserId] = useState(() => users[0]?.id ?? '')
  const [selPresetId, setSelPresetId] = useState(() => presets[0]?.id ?? '')
  const [note, setNote] = useState('')

  const effUserId = users.some((u) => u.id === selUserId) ? selUserId : users[0]?.id ?? ''
  const effPresetId = presets.some((p) => p.id === selPresetId)
    ? selPresetId
    : presets[0]?.id ?? ''

  function add() {
    setNote('')
    if (!effUserId || !effPresetId) {
      setNote('ユーザーとプリセットを1つずつ用意してから追加してください。')
      return
    }
    if (pairings.some((p) => p.userId === effUserId && p.presetId === effPresetId)) {
      setNote('その組み合わせは既にあります。')
      return
    }
    onAdd({ userId: effUserId, presetId: effPresetId })
  }

  const canPair = users.length > 0 && presets.length > 0

  return (
    <div className="panel">
      <h2>組み合わせ（ユーザー × プリセット）</h2>

      {!canPair ? (
        <p className="empty">
          ①でユーザーを、②でプリセットを1つ以上用意すると、ここで組み合わせられます。
        </p>
      ) : (
        <div className="pair-add">
          <div className="field">
            <label htmlFor="pp-user">ユーザー</label>
            <select
              id="pp-user"
              value={effUserId}
              onChange={(e) => setSelUserId(e.target.value)}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {userLabel(u)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="pp-preset">プリセット</label>
            <select
              id="pp-preset"
              value={effPresetId}
              onChange={(e) => {
                setSelPresetId(e.target.value)
                onFocusPreset(e.target.value)
              }}
            >
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name || '(無名プリセット)'}
                </option>
              ))}
            </select>
          </div>
          <button className="primary" onClick={add}>
            ペアを追加
          </button>
        </div>
      )}
      {note && <p className="hint" style={{ color: 'var(--warn)' }}>{note}</p>}

      <div className="subhead">出力するペア（{pairings.length}）</div>
      {pairings.length === 0 ? (
        <p className="empty">まだペアがありません。上で組み合わせを追加してください。</p>
      ) : (
        pairings.map((pair, i) => {
          const preset = presets.find((p) => p.id === pair.presetId)
          return (
            <div className="pair-item" key={`${pair.userId}-${pair.presetId}-${i}`}>
              <select
                aria-label={`ペア${i + 1}のユーザー`}
                value={pair.userId}
                onChange={(e) => onChangeUser(i, e.target.value)}
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {userLabel(u)}
                  </option>
                ))}
              </select>
              <span className="pair-x">×</span>
              <button
                type="button"
                className="pair-preset"
                onClick={() => onFocusPreset(pair.presetId)}
                title="このプリセットをプレビュー"
              >
                {preset?.name || '(無名プリセット)'}
              </button>
              <button className="danger" onClick={() => onRemove(i)}>
                削除
              </button>
            </div>
          )
        })
      )}

      <p className="hint" style={{ marginTop: 12 }}>
        運用のコツ: まず<b style={{ color: 'var(--text)' }}>自分のID</b>でペアを作って OBS で発話テスト →
        本番前にこの行のユーザーを差し替えれば、見た目そのままでIDだけ切り替わります。
      </p>
    </div>
  )
}
