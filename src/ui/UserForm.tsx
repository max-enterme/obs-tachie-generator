import { useState } from 'react'
import { fileToDataUri, isWithinSizeLimit } from '../lib/image'
import { resolveImageSource, type ImageSourceMode } from '../lib/imageSource'
import type { TachieUser } from '../lib/types'

interface Props {
  onAdd: (user: TachieUser) => void
}

/** 最大埋め込み幅の既定（CSS 肥大を抑える）。0 で原寸。 */
const DEFAULT_MAX_WIDTH = 960

export default function UserForm({ onAdd }: Props) {
  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [fileDataUri, setFileDataUri] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [mode, setMode] = useState<ImageSourceMode>('auto')
  const [maxWidth, setMaxWidth] = useState(DEFAULT_MAX_WIDTH)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  async function onFile(file: File | undefined) {
    if (!file) return
    setError('')
    setInfo('')
    if (!isWithinSizeLimit(file)) {
      setError('画像が大きすぎます（8MB まで）。')
      return
    }
    setBusy(true)
    try {
      const dataUri = await fileToDataUri(file, {
        maxWidth: maxWidth > 0 ? maxWidth : undefined,
      })
      setFileDataUri(dataUri)
      setUrlInput('')
      setInfo('画像をアップロードしました（data URI 埋め込み）。')
    } catch {
      setError('画像の読み込みに失敗しました。')
    } finally {
      setBusy(false)
    }
  }

  async function submit() {
    setError('')
    setInfo('')
    const cleanId = id.replace(/[^0-9]/g, '')
    if (!cleanId) {
      setError('Discord ユーザーID（数字）を入力してください。')
      return
    }

    let imageUrl = ''
    if (fileDataUri) {
      imageUrl = fileDataUri
    } else if (urlInput.trim()) {
      setBusy(true)
      try {
        const resolved = await resolveImageSource(urlInput.trim(), mode)
        imageUrl = resolved.imageUrl
        if (resolved.warning) setInfo(`${resolved.note}／⚠️ ${resolved.warning}`)
      } finally {
        setBusy(false)
      }
    }

    if (!imageUrl) {
      setError('立ち絵画像（アップロード or URL）を指定してください。')
      return
    }

    onAdd({ id: cleanId, name: name.trim(), imageUrl })
    setId('')
    setName('')
    setFileDataUri('')
    setUrlInput('')
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
            placeholder="https://... または data:image/png;base64,..."
            value={urlInput}
            onChange={(e) => {
              setUrlInput(e.target.value)
              if (e.target.value) setFileDataUri('')
            }}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="uf-mode">URL の扱い（アップロード時は常に data URI）</label>
        <select
          id="uf-mode"
          value={mode}
          onChange={(e) => setMode(e.target.value as ImageSourceMode)}
        >
          <option value="auto">自動（許可ホストは URL のまま・それ以外は data URI 化）</option>
          <option value="url">URL のまま使う</option>
          <option value="dataUri">data URI に変換して埋め込む</option>
        </select>
      </div>

      {fileDataUri && <p className="hint">画像を埋め込み済み（data URI）。</p>}
      {busy && <p className="hint">処理中…</p>}
      {info && <p className="hint">{info}</p>}
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
