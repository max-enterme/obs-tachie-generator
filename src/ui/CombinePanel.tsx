import type { AppUser, Pairing, Preset } from '../lib/types'

interface Props {
  users: AppUser[]
  presets: Preset[]
  pairings: Pairing[]
  /** 作業中選択（有効値。lists が空でない限り非 null）。 */
  userId: string | null
  presetId: string | null
  onSelectUser: (id: string) => void
  onSelectPreset: (id: string) => void
  /** 現在の選択を保存リストへ追加。 */
  onSave: () => void
  /** 保存ペアを作業中選択に呼び戻す。 */
  onRecall: (pairing: Pairing) => void
  /** 保存ペアを削除。 */
  onRemove: (index: number) => void
}

function userLabel(u: AppUser): string {
  return u.name ? `${u.name}（${u.id}）` : u.id
}

/**
 * 作業中の1組（ユーザー × プリセット）を選ぶ。ユーザー select がそのまま <b>IDの差し替え</b>導線。
 * 出力CSSはこの選択に即追従する。「保存」で選択を保存リスト（pairings）へ貯め、行クリックで呼び戻す。
 */
export default function CombinePanel({
  users,
  presets,
  pairings,
  userId,
  presetId,
  onSelectUser,
  onSelectPreset,
  onSave,
  onRecall,
  onRemove,
}: Props) {
  const canPair = users.length > 0 && presets.length > 0
  const alreadySaved =
    userId != null &&
    presetId != null &&
    pairings.some((p) => p.userId === userId && p.presetId === presetId)

  return (
    <div className="panel">
      <h2>組み合わせ（作業中の1組）</h2>

      {!canPair ? (
        <p className="empty">
          ①でユーザーを、②でプリセットを1つ以上用意すると、ここで組み合わせられます。
        </p>
      ) : (
        <>
          <div className="pair-add">
            <div className="field">
              <label htmlFor="cp-user">ユーザー（ID）</label>
              <select
                id="cp-user"
                value={userId ?? ''}
                onChange={(e) => onSelectUser(e.target.value)}
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {userLabel(u)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="cp-preset">プリセット（見た目）</label>
              <select
                id="cp-preset"
                value={presetId ?? ''}
                onChange={(e) => onSelectPreset(e.target.value)}
              >
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name || '(無名プリセット)'}
                  </option>
                ))}
              </select>
            </div>
            <button className="primary" onClick={onSave} disabled={alreadySaved}>
              {alreadySaved ? '保存済み' : '保存'}
            </button>
          </div>
          <p className="hint" style={{ marginTop: 8 }}>
            まず<b style={{ color: 'var(--text)' }}>自分のID</b>で OBS 発話テスト → 本番前にユーザーを
            差し替えれば、見た目そのままでIDだけ切り替わります。出力は下の「出力 CSS」に即追従します。
          </p>
        </>
      )}

      <div className="subhead">保存したペア（{pairings.length}）</div>
      {pairings.length === 0 ? (
        <p className="empty">「保存」で貯めた組み合わせがここに並びます。行をクリックで呼び戻せます。</p>
      ) : (
        pairings.map((pair, i) => {
          const u = users.find((x) => x.id === pair.userId)
          const p = presets.find((x) => x.id === pair.presetId)
          const isCurrent = pair.userId === userId && pair.presetId === presetId
          return (
            <div className={`pair-item${isCurrent ? ' active' : ''}`} key={`${pair.userId}-${pair.presetId}-${i}`}>
              <button
                type="button"
                className="pair-recall"
                aria-label={`保存ペア${i + 1}を呼び戻す`}
                onClick={() => onRecall(pair)}
              >
                {(u ? u.name || u.id : pair.userId)} × {p?.name || '(無名プリセット)'}
              </button>
              <button className="danger" onClick={() => onRemove(i)}>
                削除
              </button>
            </div>
          )
        })
      )}
    </div>
  )
}
