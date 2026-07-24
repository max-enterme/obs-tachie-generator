import type { TachieUser } from '../lib/types'

interface Props {
  users: TachieUser[]
  onRemove: (id: string) => void
}

export default function UserList({ users, onRemove }: Props) {
  return (
    <div className="panel">
      <h2>登録ユーザー（{users.length}）</h2>
      {users.length === 0 ? (
        <p className="empty">まだ登録がありません。左のフォームから追加してください。</p>
      ) : (
        users.map((u) => (
          <div className="user-item" key={u.id}>
            <img src={u.imageUrl} alt={u.name || u.id} />
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
