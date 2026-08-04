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
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')

  function submit() {
    setError('')
    const cleanId = id.replace(/[^0-9]/g, '')
    if (!cleanId) {
      setError('Discord ユーザーID（数字）を入力してください。')
      return
    }
    onAdd({ id: cleanId, name: name.trim(), displayName: displayName.trim() })
    setId('')
    setName('')
    setDisplayName('')
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
            placeholder="123456789012345678"
            value={id}
            onChange={(e) => setId(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="uf-name">表示名（任意・メモ用）</label>
          <input
            id="uf-name"
            type="text"
            placeholder="ユーザーA"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="uf-display">画面に出す名前（任意）</label>
          <input
            id="uf-display"
            type="text"
            placeholder="空ならメモ用の表示名を使う"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
      </div>

      <p className="hint" style={{ marginTop: 0 }}>
        開発者モード → ユーザー右クリック →「IDをコピー」。ここでは <b style={{ color: 'var(--text)' }}>
        誰か</b>だけを登録します（立ち絵はステップ②のプリセットで）。
        <br />
        <b style={{ color: 'var(--text)' }}>画面に出す名前</b>は OBS に出る文字そのものです（Discord
        のアカウント名とは無関係・任意の文字列）。実際に出すかどうかはステップ②の
        「名前表示」で切り替えます。
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
