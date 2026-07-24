import { useState } from 'react'
import { fileToDataUri, isWithinSizeLimit } from '../lib/image'
import type { TachieUser } from '../lib/types'

interface Props {
  onAdd: (user: TachieUser) => void
}

/** 最大埋め込み幅の既定（CSS 肥大を抑える）。0 で原寸。 */
const DEFAULT_MAX_WIDTH = 960

export default function UserForm({ onAdd }: Props) {
  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [maxWidth, setMaxWidth] = useState(DEFAULT_MAX_WIDTH)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onFile(file: File | undefined) {
    if (!file) return
    setError('')
    if (!isWithinSizeLimit(file)) {
      setError('画像が大きすぎます（8MB まで）。')
      return
    }
    setBusy(true)
    try {
      const dataUri = await fileToDataUri(file, {
        maxWidth: maxWidth > 0 ? maxWidth : undefined,
      })
      setImageUrl(dataUri)
    } catch {
      setError('画像の読み込みに失敗しました。')
    } finally {
      setBusy(false)
    }
  }

  function submit() {
    const cleanId = id.replace(/[^0-9]/g, '')
    if (!cleanId) {
      setError('Discord ユーザーID（数字）を入力してください。')
      return
    }
    if (!imageUrl) {
      setError('立ち絵画像（アップロード or URL）を指定してください。')
      return
    }
    onAdd({ id: cleanId, name: name.trim(), imageUrl })
    setId('')
    setName('')
    setImageUrl('')
    setError('')
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
      </div>

      <div className="field">
        <label htmlFor="uf-file">立ち絵画像（アップロード → data URI 埋め込み）</label>
        <input
          id="uf-file"
          type="file"
          accept="image/*"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </div>

      <div className="row">
        <div className="field">
          <label htmlFor="uf-maxw">埋め込み最大幅(px)・0 で原寸</label>
          <input
            id="uf-maxw"
            type="number"
            min={0}
            value={maxWidth}
            onChange={(e) => setMaxWidth(Number(e.target.value))}
          />
        </div>
        <div className="field">
          <label htmlFor="uf-url">または画像URL（data URI / 外部URL）</label>
          <input
            id="uf-url"
            type="url"
            placeholder="data:image/png;base64,... または https://..."
            value={imageUrl.startsWith('data:') ? '' : imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
          />
        </div>
      </div>

      {imageUrl.startsWith('data:') && (
        <p className="hint">画像を埋め込み済み（data URI）。</p>
      )}
      {busy && <p className="hint">画像を処理中…</p>}
      {error && (
        <p className="hint" style={{ color: 'var(--danger)' }} role="alert">
          {error}
        </p>
      )}

      <button className="primary" onClick={submit} disabled={busy}>
        追加
      </button>
    </div>
  )
}
