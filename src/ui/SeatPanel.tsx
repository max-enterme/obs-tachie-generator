import { useState } from 'react'
import type { AppUser, Preset, Seat, Pairing } from '../lib/types'
import {
  ANCHOR_COLS,
  ANCHOR_LABEL,
  ANCHOR_ROWS,
  OFFSET_X_HINT,
  OFFSET_X_LABEL,
  OFFSET_Y_HINT,
  OFFSET_Y_LABEL,
} from './anchorLabels'

interface Props {
  users: AppUser[]
  presets: Preset[]
  seats: Seat[]
  /** 選択中の席(App 側でフォールバック済み。席 0 件なら null)。 */
  seat: Seat | null
  onSelectSeat: (seatId: string) => void
  onAddSeat: () => void
  onRemoveSeat: (seatId: string) => void
  onRenameSeat: (seatId: string, name: string) => void
  /** 席の位置を変える(渡したキーだけ上書き)。 */
  onChangeSeatPosition: (
    seatId: string,
    patch: Partial<Pick<Seat, 'anchorX' | 'anchorY' | 'left' | 'bottom'>>,
  ) => void
  /** プレビューに映している候補の userId(App 側でフォールバック済み。候補 0 人なら null)。 */
  previewUserId: string | null
  onPreviewCandidate: (userId: string) => void
  onAddCandidate: (seatId: string, candidate: Pairing) => void
  /** index の候補を delta だけ動かす(-1 = 上へ / 1 = 下へ)。範囲外なら何もしない。 */
  onMoveCandidate: (seatId: string, index: number, delta: -1 | 1) => void
  onRemoveCandidate: (seatId: string, index: number) => void
}

function userLabel(user: AppUser): string {
  return user.name ? `${user.name}（${user.id}）` : user.id
}

export default function SeatPanel(props: Props) {
  const { seats, seat, users, presets, previewUserId } = props
  const anchorX = seat?.anchorX ?? 'left'
  const anchorY = seat?.anchorY ?? 'bottom'

  return (
    <div className="seat-grid">
      <div className="panel">
        <h2>席の一覧</h2>
        <button type="button" className="primary" onClick={props.onAddSeat}>
          新しい席
        </button>
        {seats.length === 0 ? (
          <p className="empty">席はまだありません。「新しい席」で作ります。</p>
        ) : seats.map((item) => {
          const label = item.name.trim() || '無名の席'
          return (
            <div
              className="pair-item"
              aria-current={item.id === seat?.id ? 'true' : undefined}
              key={item.id}
            >
              <button
                type="button"
                className="pair-recall"
                aria-label={`席「${label}」を選ぶ`}
                onClick={() => props.onSelectSeat(item.id)}
              >
                {label}（候補 {item.candidates.length} 人）
              </button>
              <button
                type="button"
                className="danger"
                aria-label={`席「${label}」を削除`}
                onClick={() => props.onRemoveSeat(item.id)}
              >
                削除
              </button>
            </div>
          )
        })}
      </div>
      <div className="panel">
        <h2>席の中身</h2>
        {!seat ? (
          <p className="empty">席を作ると、ここで候補を並べられます。</p>
        ) : (
          <>
            <div className="field">
              <label htmlFor="seat-name">席の名前</label>
              <input
                id="seat-name"
                placeholder="例: ゲスト席"
                value={seat.name}
                onChange={(e) => props.onRenameSeat(seat.id, e.target.value)}
              />
            </div>
            <div className="subhead">席の位置</div>
            <div className="anchor-block">
              <div className="field" style={{ flex: '0 0 auto' }}>
                <span id="seat-anchor-label" className="anchor-legend">
                  基準の位置（アンカー）
                </span>
                <div className="anchor-grid" role="radiogroup" aria-labelledby="seat-anchor-label">
                  {ANCHOR_ROWS.map((ay) => ANCHOR_COLS.map((ax) => {
                    const on = anchorX === ax && anchorY === ay
                    return (
                      <button
                        key={`${ax}-${ay}`}
                        type="button"
                        className="anchor-cell"
                        role="radio"
                        aria-checked={on}
                        data-on={on}
                        title={ANCHOR_LABEL[ay][ax]}
                        onClick={() => props.onChangeSeatPosition(seat.id, { anchorX: ax, anchorY: ay })}
                      >
                        <span className="sr-only">{ANCHOR_LABEL[ay][ax]}</span>
                      </button>
                    )
                  }))}
                </div>
              </div>
              <p className="hint" style={{ margin: 0, flex: '1 1 160px' }}>
                誰が出てもこの位置に出ます（{ANCHOR_LABEL[anchorY][anchorX]}）。立ち絵の幅・名前・演出は、その人のプリセットのままです。
              </p>
            </div>
            <div className="row">
              <div className="field">
                <label htmlFor="seat-left">
                  {OFFSET_X_LABEL[anchorX]}
                  {OFFSET_X_HINT[anchorX] && <small>{OFFSET_X_HINT[anchorX]}</small>}
                </label>
                <input
                  id="seat-left"
                  type="number"
                  value={seat.left}
                  onChange={(e) => props.onChangeSeatPosition(seat.id, { left: Number(e.target.value) })}
                />
              </div>
              <div className="field">
                <label htmlFor="seat-bottom">
                  {OFFSET_Y_LABEL[anchorY]}
                  {OFFSET_Y_HINT[anchorY] && <small>{OFFSET_Y_HINT[anchorY]}</small>}
                </label>
                <input
                  id="seat-bottom"
                  type="number"
                  value={seat.bottom}
                  onChange={(e) => props.onChangeSeatPosition(seat.id, { bottom: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="subhead">候補（上ほど優先）</div>
            {seat.candidates.length === 0 ? (
              <p className="empty">候補がいません。下から追加してください。</p>
            ) : seat.candidates.map((candidate, i) => {
              const user = users.find((item) => item.id === candidate.userId)
              const preset = presets.find((item) => item.id === candidate.presetId)
              const label = user?.name || candidate.userId
              return (
                <div
                  className={`pair-item${previewUserId === candidate.userId ? ' active' : ''}`}
                  key={`${candidate.userId}-${candidate.presetId}-${i}`}
                >
                  <button
                    type="button"
                    className="pair-recall"
                    aria-label={`候補${i + 1}をプレビューで見る`}
                    onClick={() => props.onPreviewCandidate(candidate.userId)}
                  >
                    {i + 1}. {label} × {preset?.name || '(無名プリセット)'}
                  </button>
                  <button
                    type="button"
                    aria-label={`候補${i + 1}を上へ`}
                    disabled={i === 0}
                    onClick={() => props.onMoveCandidate(seat.id, i, -1)}
                  >
                    上へ
                  </button>
                  <button
                    type="button"
                    aria-label={`候補${i + 1}を下へ`}
                    disabled={i === seat.candidates.length - 1}
                    onClick={() => props.onMoveCandidate(seat.id, i, 1)}
                  >
                    下へ
                  </button>
                  <button
                    type="button"
                    className="danger"
                    aria-label={`候補${i + 1}を外す`}
                    onClick={() => props.onRemoveCandidate(seat.id, i)}
                  >
                    外す
                  </button>
                </div>
              )
            })}
            {users.length === 0 || presets.length === 0 ? (
              <p className="empty">①でユーザーを、②でプリセットを1つ以上用意すると、候補を追加できます。</p>
            ) : (
              <CandidateAdder users={users} presets={presets} seat={seat} onAdd={props.onAddCandidate} />
            )}
          </>
        )}
      </div>
    </div>
  )
}

interface CandidateAdderProps {
  users: AppUser[]
  presets: Preset[]
  seat: Seat
  onAdd: (seatId: string, candidate: Pairing) => void
}

function CandidateAdder({ users, presets, seat, onAdd }: CandidateAdderProps) {
  const [userId, setUserId] = useState<string | null>(null)
  const [presetId, setPresetId] = useState<string | null>(null)
  const effUserId = userId && users.some((user) => user.id === userId)
    ? userId
    : users[0]?.id ?? null
  const effPresetId = presetId && presets.some((preset) => preset.id === presetId)
    ? presetId
    : presets[0]?.id ?? null
  const exists = seat.candidates.some((candidate) => candidate.userId === effUserId)

  function add() {
    if (effUserId == null || effPresetId == null) return
    onAdd(seat.id, { userId: effUserId, presetId: effPresetId })
  }

  return (
    <div className="pair-add">
      <div className="field">
        <label htmlFor="seat-add-user">追加するユーザー</label>
        <select id="seat-add-user" value={effUserId ?? ''} onChange={(e) => setUserId(e.target.value)}>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {userLabel(user)}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="seat-add-preset">プリセット</label>
        <select id="seat-add-preset" value={effPresetId ?? ''} onChange={(e) => setPresetId(e.target.value)}>
          {presets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name || '(無名プリセット)'}
            </option>
          ))}
        </select>
      </div>
      <button type="button" className="primary" disabled={exists} onClick={add}>
        候補に追加
      </button>
      {exists && <p className="hint">このユーザーはもう候補にいます（1 人 1 回まで）</p>}
    </div>
  )
}
