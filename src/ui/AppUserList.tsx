import type { AppUser } from '../lib/types'

interface Props {
  users: AppUser[]
  onRemove: (id: string) => void
  /** 「画面に出す名前」の編集。 */
  onChange: (user: AppUser) => void
}

/**
 * 登録済みユーザー（誰）の一覧。立ち絵は持たないので ID と名前のみ。
 * 「画面に出す名前」だけはここで直接編集できる（登録し直さずに呼び名を変えられる）。
 */
export default function AppUserList({ users, onRemove, onChange }: Props) {
  return (
    <div className="panel">
      <h2>登録ユーザー（{users.length}）</h2>
      {users.length === 0 ? (
        <p className="empty">まだ登録がありません。上のフォームから追加してください。</p>
      ) : (
        users.map((u) => (
          <div className="user-item" key={u.id}>
            <div className="meta">
              <div className="name">{u.name || '(名前なし)'}</div>
              <div className="id">{u.id}</div>
            </div>
            <div className="field" style={{ flex: '1 1 180px', minWidth: 0 }}>
              <label htmlFor={`ul-display-${u.id}`}>画面に出す名前</label>
              <input
                id={`ul-display-${u.id}`}
                type="text"
                // 同じ文言のラベルが人数ぶん並ぶので、読み上げ用に誰の欄かを持たせる。
                aria-label={`${u.name || u.id} の画面に出す名前`}
                placeholder={u.name || '（未設定）'}
                value={u.displayName ?? ''}
                onChange={(e) => onChange({ ...u, displayName: e.target.value })}
              />
            </div>
            <button className="danger" onClick={() => onRemove(u.id)}>
              削除
            </button>
          </div>
        ))
      )}
    </div>
  )
}
