import type { AppUser } from '../lib/types'

interface Props {
  users: AppUser[]
  onRemove: (id: string) => void
}

/** 登録済みユーザー（誰）の一覧。立ち絵は持たないので ID と名前のみ。 */
export default function AppUserList({ users, onRemove }: Props) {
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
            <button className="danger" onClick={() => onRemove(u.id)}>
              削除
            </button>
          </div>
        ))
      )}
    </div>
  )
}
