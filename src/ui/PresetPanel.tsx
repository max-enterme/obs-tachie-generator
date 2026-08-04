import { useState } from 'react'
import { fileToDataUri, isWithinSizeLimit } from '../lib/image'
import { resolveImageSource, type ImageSourceMode } from '../lib/imageSource'
import {
  resetPresetOptions,
  type NameAlign,
  type NameFit,
  type NameLabel,
  type Preset,
  type SpeakEffect,
} from '../lib/types'

interface Props {
  presets: Preset[]
  editingId: string | null
  onSelect: (id: string) => void
  onAdd: () => void
  onRemove: (id: string) => void
  onChange: (preset: Preset) => void
  /** 編集中プリセットの画像の実サイズ（幅 px）。幅が原寸のときの行揃えに使う。測定前は null。 */
  imageNaturalWidth?: number | null
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
  imageNaturalWidth,
}: Props) {
  const editing = presets.find((p) => p.id === editingId) ?? null

  const [imgMode, setImgMode] = useState<ImageInputMode>('url')
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
  function setName<K extends keyof NameLabel>(key: K, value: NameLabel[K]) {
    if (!editing) return
    onChange({ ...editing, nameLabel: { ...editing.nameLabel, [key]: value } })
  }

  // 行揃えは「立ち絵の幅」が決まっていないと揃えようがない。幅指定が無くても、画像の実サイズが
  // 測れていればそれを基準にできる（＝画像すら無い／読めないときだけ無効）。
  const alignBaseWidth = editing?.width ?? imageNaturalWidth ?? null
  const alignDisabled = alignBaseWidth == null

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
                    <small>埋め込み(dataURI)時に縮小／「URLのまま」は対象外</small>
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
                    const v = Number(e.target.value)
                    // 空・0 以下は「原寸」（幅 0 は立ち絵が消えるだけなので受け付けない）。
                    set('width', e.target.value === '' || v <= 0 ? undefined : v)
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
                <label htmlFor="pr-jump">
                  跳ね高さ(px)
                  {!editing.speak.bounce && (
                    <small className="why">上の「ぴょこぴょこ」を ON にすると使えます</small>
                  )}
                </label>
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
                <label htmlFor="pr-color">
                  枠・後光の色
                  {!editing.speak.outline && (
                    <small className="why">上の「枠・後光」を ON にすると使えます</small>
                  )}
                </label>
                <input
                  id="pr-color"
                  type="color"
                  value={editing.speak.outlineColor ?? '#FFFFFF'}
                  disabled={!editing.speak.outline}
                  onChange={(e) => setSpeak('outlineColor', e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="pr-outw">
                  枠・後光の幅(px)
                  {!editing.speak.outline && (
                    <small className="why">上の「枠・後光」を ON にすると使えます</small>
                  )}
                </label>
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

            <div className="subhead">名前表示</div>
            <label className="toggle" htmlFor="pr-name-show">
              <input
                id="pr-name-show"
                type="checkbox"
                checked={editing.nameLabel.show}
                onChange={(e) => setName('show', e.target.checked)}
              />
              <span className="sw" />
              <span className="lab">
                名前を表示する
                <small>
                  ステップ①の「画面に出す名前」を立ち絵に添えて出す（Discord のアカウント名ではなく任意の文字列）
                </small>
              </span>
            </label>

            {editing.nameLabel.show && (
              <>
                <div className="row">
                  <div className="field">
                    <label htmlFor="pr-name-x">
                      横位置(px)
                      <small>立ち絵の左端から</small>
                    </label>
                    <input
                      id="pr-name-x"
                      type="number"
                      value={editing.nameLabel.offsetX}
                      onChange={(e) => setName('offsetX', Number(e.target.value))}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="pr-name-y">
                      縦位置(px)
                      <small>立ち絵の下端から（負で下）</small>
                    </label>
                    <input
                      id="pr-name-y"
                      type="number"
                      value={editing.nameLabel.offsetY}
                      onChange={(e) => setName('offsetY', Number(e.target.value))}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="pr-name-size">文字サイズ(px)</label>
                    <input
                      id="pr-name-size"
                      type="number"
                      min={1}
                      value={editing.nameLabel.fontSize}
                      onChange={(e) => setName('fontSize', Number(e.target.value))}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="pr-name-color">文字色</label>
                    <input
                      id="pr-name-color"
                      type="color"
                      value={editing.nameLabel.color}
                      onChange={(e) => setName('color', e.target.value)}
                    />
                  </div>
                </div>

                <div className="row">
                  <div className="field">
                    <label htmlFor="pr-name-font">
                      フォント（任意）
                      <small>OBS(CEF) にあるフォント名のみ・空でそのまま</small>
                    </label>
                    <input
                      id="pr-name-font"
                      type="text"
                      placeholder="Noto Sans JP, メイリオ など"
                      value={editing.nameLabel.fontFamily}
                      onChange={(e) => setName('fontFamily', e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="pr-name-align">
                      行揃え
                      {alignDisabled ? (
                        <small className="why">
                          幅 width(px) を入れるか、読み込める立ち絵画像を設定すると使えます
                        </small>
                      ) : (
                        <small>
                          幅 {alignBaseWidth}px の中で揃えます
                          {editing.width == null && '（画像の実サイズ）'}
                        </small>
                      )}
                    </label>
                    <select
                      id="pr-name-align"
                      value={editing.nameLabel.align}
                      onChange={(e) => setName('align', e.target.value as NameAlign)}
                      disabled={alignDisabled}
                      title={
                        alignDisabled
                          ? '揃える基準の幅が決まらないため使えません。「位置とサイズ」の「幅 width(px)」を入れるか、読み込める立ち絵画像を設定してください。'
                          : editing.width == null
                            ? `幅は画像の実サイズ ${alignBaseWidth}px を使います（画像を差し替えたらCSSを出し直してください）。`
                            : undefined
                      }
                    >
                      <option value="left">左</option>
                      <option value="center">中央</option>
                      <option value="right">右</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="pr-name-outw">
                      縁取りの幅(px)
                      {!editing.nameLabel.outline && (
                        <small className="why">下の「縁取り」を ON にすると使えます</small>
                      )}
                    </label>
                    <input
                      id="pr-name-outw"
                      type="number"
                      min={0}
                      value={editing.nameLabel.outlineWidth}
                      disabled={!editing.nameLabel.outline}
                      onChange={(e) => setName('outlineWidth', Number(e.target.value))}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="pr-name-outc">
                      縁取りの色
                      {!editing.nameLabel.outline && (
                        <small className="why">下の「縁取り」を ON にすると使えます</small>
                      )}
                    </label>
                    <input
                      id="pr-name-outc"
                      type="color"
                      value={editing.nameLabel.outlineColor}
                      disabled={!editing.nameLabel.outline}
                      onChange={(e) => setName('outlineColor', e.target.value)}
                    />
                  </div>
                </div>

                <div className="chips">
                  <button
                    type="button"
                    className="chip"
                    data-on={editing.nameLabel.bold}
                    aria-pressed={editing.nameLabel.bold}
                    onClick={() => setName('bold', !editing.nameLabel.bold)}
                  >
                    <span className="dot" />
                    太字
                  </button>
                  <button
                    type="button"
                    className="chip"
                    data-on={editing.nameLabel.outline}
                    aria-pressed={editing.nameLabel.outline}
                    onClick={() => setName('outline', !editing.nameLabel.outline)}
                  >
                    <span className="dot" />
                    縁取り
                  </button>
                  <button
                    type="button"
                    className="chip"
                    data-on={editing.nameLabel.background}
                    aria-pressed={editing.nameLabel.background}
                    onClick={() => setName('background', !editing.nameLabel.background)}
                  >
                    <span className="dot" />
                    背景（テロップ帯）
                  </button>
                </div>

                {editing.nameLabel.background && (
                  <>
                    <div className="row" style={{ marginTop: 12 }}>
                      <div className="field">
                        <label htmlFor="pr-name-bgfit">
                          帯の幅
                          {editing.nameLabel.fit === 'stretch' && alignDisabled ? (
                            <small className="why">
                              幅の基準が無いため、実際は文字幅に縮みます
                            </small>
                          ) : (
                            <small>文字に合わせるか、立ち絵の幅いっぱいか</small>
                          )}
                        </label>
                        <select
                          id="pr-name-bgfit"
                          value={editing.nameLabel.fit}
                          onChange={(e) => setName('fit', e.target.value as NameFit)}
                        >
                          <option value="text">文字に合わせる</option>
                          <option value="stretch">立ち絵の幅いっぱい</option>
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor="pr-name-bgc">帯の色</label>
                        <input
                          id="pr-name-bgc"
                          type="color"
                          value={editing.nameLabel.backgroundColor}
                          onChange={(e) => setName('backgroundColor', e.target.value)}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="pr-name-bgo">
                          帯の不透明度(%)
                          <small>0 で透明・100 でベタ塗り</small>
                        </label>
                        <input
                          id="pr-name-bgo"
                          type="number"
                          min={0}
                          max={100}
                          value={editing.nameLabel.backgroundOpacity}
                          onChange={(e) => setName('backgroundOpacity', Number(e.target.value))}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="pr-name-bgr">角丸(px)</label>
                        <input
                          id="pr-name-bgr"
                          type="number"
                          min={0}
                          value={editing.nameLabel.backgroundRadius}
                          onChange={(e) => setName('backgroundRadius', Number(e.target.value))}
                        />
                      </div>
                    </div>

                    <div className="row">
                      <div className="field">
                        <label htmlFor="pr-name-bgpx">
                          帯の余白・横(px)
                          <small>文字の左右にとる余白</small>
                        </label>
                        <input
                          id="pr-name-bgpx"
                          type="number"
                          min={0}
                          value={editing.nameLabel.backgroundPadX}
                          onChange={(e) => setName('backgroundPadX', Number(e.target.value))}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="pr-name-bgpy">
                          帯の余白・縦(px)
                          <small>文字の上下にとる余白</small>
                        </label>
                        <input
                          id="pr-name-bgpy"
                          type="number"
                          min={0}
                          value={editing.nameLabel.backgroundPadY}
                          onChange={(e) => setName('backgroundPadY', Number(e.target.value))}
                        />
                      </div>
                    </div>
                  </>
                )}

                <p className="hint" style={{ marginTop: 10 }}>
                  名前は <code>body::before</code> で描きます（立ち絵は <code>body::after</code>）。
                  1 ブラウザソースに出せるのは <b style={{ color: 'var(--text)' }}>立ち絵1枚＋名前1つ</b> です。
                  発話演出は名前には掛かりません（静止したネームプレート）。
                </p>
              </>
            )}

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
                checked={editing.hideWhenAway}
                onChange={(e) => set('hideWhenAway', e.target.checked)}
              />
              <span className="sw" />
              <span className="lab">
                通話にいないときは立ち絵を隠す
                <small>通話に参加している間だけ表示（＝常時表示をやめる。Streamkit 標準に近い）</small>
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
