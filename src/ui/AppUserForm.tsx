import { useState } from 'react'
import type { AppUser } from '../lib/types'

interface Props {
  onAdd: (user: AppUser) => void
}

/**
 * 「誰」を登録するフォーム。Discord ユーザーID＋表示名のみ（画像はここでは持たない）。
 * 見た目はプリセット側で用意し、出力時にペアで組み合わせる。
 */
export default function AppUserForm({ onAdd }: Props) {
  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  function submit() {
    setError('')
    const cleanId = id.replace(/[^0-9]/g, '')
    if (!cleanId) {
      setError('Discord ユーザーID（数字）を入力してください。')
      return
    }
    onAdd({ id: cleanId, name: name.trim() })
    setId('')
    setName('')
  }

  return (
    <div className="panel">
      <h2>ユーザーを追加</h2>
      <div className="row">
        <div className="field">
          <label htmlFor="uf-id">Discord ユーザーID</label>
          <input
            id="uf-id"
            type="text"
            inputMode="numeric"
            placeholder="649228696229511179"
            value={id}
            onChange={(e) => setId(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="uf-name">表示名（任意・メモ用）</label>
          <input
            id="uf-name"
            type="text"
            placeholder="てつん"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
      </div>

      <p className="hint" style={{ marginTop: 0 }}>
        開発者モード → ユーザー右クリック →「IDをコピー」。ここでは <b style={{ color: 'var(--text)' }}>
        誰か</b>だけを登録します（立ち絵はステップ②のプリセットで）。
      </p>

      {error && (
        <p className="hint" style={{ color: 'var(--danger)' }} role="alert">
          {error}
        </p>
      )}

      <button className="primary" onClick={submit}>
        追加
      </button>
    </div>
  )
}
