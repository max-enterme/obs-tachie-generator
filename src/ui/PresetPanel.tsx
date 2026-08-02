import { useState } from 'react'
import { fileToDataUri, isWithinSizeLimit } from '../lib/image'
import { resolveImageSource, type ImageSourceMode } from '../lib/imageSource'
import { resetPresetOptions, type Preset, type SpeakEffect } from '../lib/types'

interface Props {
  presets: Preset[]
  editingId: string | null
  onSelect: (id: string) => void
  onAdd: () => void
  onRemove: (id: string) => void
  onChange: (preset: Preset) => void
}

/** 最大埋め込み幅の既定。0 で原寸（＝リサイズしない）。 */
const DEFAULT_MAX_WIDTH = 0

/** 立ち絵画像の入力方式（排他）。 */
type ImageInputMode = 'upload' | 'url'

/**
 * 立ち絵・演出（プリセット）の作成/編集。上段2ブロック（左=一覧 / 右=画像＋オプション）。
 * 画像入力は「アップロード ⇄ 画像URL」の排他切替。プレビューは App 側で下段全幅に置く。
 */
export default function PresetPanel({
  presets,
  editingId,
  onSelect,
  onAdd,
  onRemove,
  onChange,
}: Props) {
  const editing = presets.find((p) => p.id === editingId) ?? null

  const [imgMode, setImgMode] = useState<ImageInputMode>('upload')
  const [urlInput, setUrlInput] = useState('')
  const [mode, setMode] = useState<ImageSourceMode>('auto')
  const [maxWidth, setMaxWidth] = useState(DEFAULT_MAX_WIDTH)
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState('')
  const [error, setError] = useState('')

  function set<K extends keyof Preset>(key: K, value: Preset[K]) {
    if (!editing) return
    onChange({ ...editing, [key]: value })
  }
  function setSpeak<K extends keyof SpeakEffect>(key: K, value: SpeakEffect[K]) {
    if (!editing) return
    onChange({ ...editing, speak: { ...editing.speak, [key]: value } })
  }

  async function onFile(file: File | undefined) {
    if (!file || !editing) return
    setError('')
    setInfo('')
    if (!isWithinSizeLimit(file)) {
      setError('画像が大きすぎます（8MB まで）。')
      return
    }
    setBusy(true)
    try {
      const dataUri = await fileToDataUri(file, { maxWidth: maxWidth > 0 ? maxWidth : undefined })
      onChange({ ...editing, imageUrl: dataUri })
      setInfo('画像を設定しました（data URI 埋め込み）。')
    } catch {
      setError('画像の読み込みに失敗しました。')
    } finally {
      setBusy(false)
    }
  }

  async function applyUrl() {
    if (!editing) return
    setError('')
    setInfo('')
    const value = urlInput.trim()
    if (!value) {
      setError('画像URLを入力してください。')
      return
    }
    setBusy(true)
    try {
      const resolved = await resolveImageSource(value, mode, maxWidth > 0 ? maxWidth : undefined)
      onChange({ ...editing, imageUrl: resolved.imageUrl })
      setInfo(
        resolved.warning
          ? `${resolved.note}／⚠️ ${resolved.warning}`
          : `画像を設定しました（${resolved.note}）。`,
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="preset-top">
      {/* 上段左：プリセット一覧 */}
      <div className="panel preset-list-panel">
        <h2>プリセット一覧</h2>
        <div className="preset-list">
          <button type="button" className="preset-add" onClick={onAdd}>
            ＋ 新規プリセット
          </button>
          {presets.map((p) => (
            <div key={p.id} className={`preset-item${p.id === editingId ? ' active' : ''}`}>
              <button type="button" className="preset-pick" onClick={() => onSelect(p.id)}>
                <span className="thumb">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt="" />
                  ) : (
                    <span className="thumb-empty">?</span>
                  )}
                </span>
                <span className="preset-name">{p.name || '(無名プリセット)'}</span>
              </button>
              <button className="danger" onClick={() => onRemove(p.id)}>
                削除
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 上段右：画像＋オプション */}
      <div className="panel preset-editor-panel">
        {!editing ? (
          <p className="empty">プリセットを選ぶか「＋ 新規プリセット」で作成してください。</p>
        ) : (
          <>
            <div className="field">
              <label htmlFor="pr-name">プリセット名（任意・メモ用）</label>
              <input
                id="pr-name"
                type="text"
                placeholder="通常 / 立ち絵A など"
                value={editing.name}
                onChange={(e) => set('name', e.target.value)}
              />
            </div>

            <div className="subhead">立ち絵画像</div>
            <div className="preset-image-row">
              <span className="thumb lg">
                {editing.imageUrl ? (
                  <img src={editing.imageUrl} alt="現在の立ち絵" />
                ) : (
                  <span className="thumb-empty">未設定</span>
                )}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="seg" role="group" aria-label="画像入力方式">
                  <button
                    type="button"
                    aria-pressed={imgMode === 'upload'}
                    onClick={() => setImgMode('upload')}
                  >
                    アップロード
                  </button>
                  <button
                    type="button"
                    aria-pressed={imgMode === 'url'}
                    onClick={() => setImgMode('url')}
                  >
                    画像URL
                  </button>
                </div>

                {imgMode === 'upload' ? (
                  <div className="field">
                    <label htmlFor="pr-file">アップロード（→ data URI 埋め込み）</label>
                    <input
                      id="pr-file"
                      type="file"
                      accept="image/*"
                      onChange={(e) => onFile(e.target.files?.[0])}
                    />
                  </div>
                ) : (
                  <>
                    <div className="field">
                      <label htmlFor="pr-url">画像URL（data URI / 外部URL）</label>
                      <div className="row" style={{ alignItems: 'stretch' }}>
                        <input
                          id="pr-url"
                          type="url"
                          style={{ flex: '1 1 180px' }}
                          placeholder="https://... または data:image/png;base64,..."
                          value={urlInput}
                          onChange={(e) => setUrlInput(e.target.value)}
                        />
                        <button onClick={applyUrl} disabled={busy}>
                          画像URLを反映
                        </button>
                      </div>
                    </div>
                    <div className="field">
                      <label htmlFor="pr-mode">URL の扱い</label>
                      <select
                        id="pr-mode"
                        value={mode}
                        onChange={(e) => setMode(e.target.value as ImageSourceMode)}
                      >
                        <option value="auto">自動（許可ホストは URL のまま・それ以外は data URI 化）</option>
                        <option value="url">URL のまま使う</option>
                        <option value="dataUri">data URI に変換して埋め込む</option>
                      </select>
                    </div>
                  </>
                )}

                <div className="field">
                  <label htmlFor="pr-maxw">
                    埋め込み最大幅(px)・0 で原寸
                    <small style={{ display: 'block', color: 'var(--muted)' }}>
                      ※埋め込み(dataURI)時に縮小／「URLのまま」は対象外
                    </small>
                  </label>
                  <input
                    id="pr-maxw"
                    type="number"
                    min={0}
                    value={maxWidth}
                    onChange={(e) => setMaxWidth(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
            {busy && <p className="hint">処理中…</p>}
            {info && <p className="hint">{info}</p>}
            {error && (
              <p className="hint" style={{ color: 'var(--danger)' }} role="alert">
                {error}
              </p>
            )}

            <div className="subhead">位置とサイズ</div>
            <div className="row">
              <div className="field">
                <label htmlFor="pr-left">左端からの距離(px)</label>
                <input
                  id="pr-left"
                  type="number"
                  value={editing.left}
                  onChange={(e) => set('left', Number(e.target.value))}
                />
              </div>
              <div className="field">
                <label htmlFor="pr-bottom">下端からの距離(px)</label>
                <input
                  id="pr-bottom"
                  type="number"
                  value={editing.bottom}
                  onChange={(e) => set('bottom', Number(e.target.value))}
                />
              </div>
              <div className="field">
                <label htmlFor="pr-width">幅 width(px)・空で原寸</label>
                <input
                  id="pr-width"
                  type="number"
                  min={0}
                  value={editing.width ?? ''}
                  onChange={(e) => {
                    const v = e.target.value
                    set('width', v === '' ? undefined : Number(v))
                  }}
                />
              </div>
            </div>

            <div className="subhead">発話演出（話すと反応）</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: '4px 0 8px' }}>
              話すときの動き（すべて OFF なら静止）
            </div>
            <div className="chips">
              <button
                type="button"
                className="chip"
                data-on={editing.speak.bounce}
                aria-pressed={editing.speak.bounce}
                onClick={() => setSpeak('bounce', !editing.speak.bounce)}
              >
                <span className="dot" />
                ぴょこぴょこ
              </button>
              <button
                type="button"
                className="chip"
                data-on={editing.speak.outline}
                aria-pressed={editing.speak.outline}
                onClick={() => setSpeak('outline', !editing.speak.outline)}
              >
                <span className="dot" />
                枠・後光
              </button>
              <button
                type="button"
                className="chip"
                data-on={editing.speak.blink}
                aria-pressed={editing.speak.blink}
                onClick={() => setSpeak('blink', !editing.speak.blink)}
              >
                <span className="dot" />
                点滅
              </button>
            </div>

            <div className="row" style={{ marginTop: 12 }}>
              <div className="field">
                <label htmlFor="pr-jump">跳ね高さ(px)</label>
                <input
                  id="pr-jump"
                  type="number"
                  min={0}
                  value={editing.speak.jumpPx}
                  disabled={!editing.speak.bounce}
                  onChange={(e) => setSpeak('jumpPx', Number(e.target.value))}
                />
              </div>
              <div className="field">
                <label htmlFor="pr-dur">動きの速さ・周期(ms)</label>
                <input
                  id="pr-dur"
                  type="number"
                  min={50}
                  value={editing.speak.durationMs}
                  onChange={(e) => setSpeak('durationMs', Number(e.target.value))}
                />
              </div>
              <div className="field">
                <label htmlFor="pr-color">枠・後光の色</label>
                <input
                  id="pr-color"
                  type="color"
                  value={editing.speak.outlineColor ?? '#FFFFFF'}
                  disabled={!editing.speak.outline}
                  onChange={(e) => setSpeak('outlineColor', e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="pr-outw">枠・後光の幅(px)</label>
                <input
                  id="pr-outw"
                  type="number"
                  min={1}
                  value={editing.speak.outlineWidth}
                  disabled={!editing.speak.outline}
                  onChange={(e) => setSpeak('outlineWidth', Number(e.target.value))}
                />
              </div>
            </div>

            <div className="subhead">その他</div>
            <label className="toggle" htmlFor="pr-dim">
              <input
                id="pr-dim"
                type="checkbox"
                checked={editing.dimWhenQuiet}
                onChange={(e) => set('dimWhenQuiet', e.target.checked)}
              />
              <span className="sw" />
              <span className="lab">
                静かな人を暗くする
                <small>発話していない立ち絵を暗く・話す人を目立たせる</small>
              </span>
            </label>

            <label className="toggle" htmlFor="pr-hide">
              <input
                id="pr-hide"
                type="checkbox"
                checked={editing.hideWhenInCall}
                onChange={(e) => set('hideWhenInCall', e.target.checked)}
              />
              <span className="sw" />
              <span className="lab">
                通話中は立ち絵を隠す
                <small>本人が通話に参加している間だけ非表示（通話にいない時だけ出す）</small>
              </span>
            </label>

            <div style={{ marginTop: 14 }}>
              <button
                type="button"
                className="sm ghost"
                onClick={() => onChange(resetPresetOptions(editing))}
              >
                ↺ オプションを既定に戻す
              </button>
              <span className="hint" style={{ marginLeft: 8 }}>
                位置・サイズ・演出などを初期値に戻します（名前・画像はそのまま）。
              </span>
            </div>

            <p className="hint" style={{ marginTop: 12 }}>
              常時表示・発話検知は CSS <code>:has()</code> を使います。古い OBS(CEF) では効かないことがあります。
            </p>
          </>
        )}
      </div>
    </div>
  )
}
