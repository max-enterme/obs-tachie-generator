import { useEffect, useState } from 'react'
import { fileToDataUri, isWithinSizeLimit, measureNaturalSize } from '../lib/image'
import { resolveImageSource } from '../lib/imageSource'
import { mouthAspectNote } from '../lib/mouth'
import { DEFAULT_MOUTH_INTERVAL_MS, type Preset } from '../lib/types'

interface Props {
  preset: Preset
  maxWidth: number
  onChange: (preset: Preset) => void
}

export default function MouthImageField({ preset, maxWidth, onChange }: Props): JSX.Element {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState('')
  const [error, setError] = useState('')
  const [baseSize, setBaseSize] = useState<{width:number;height:number}|null>(null)
  const [mouthSize, setMouthSize] = useState<{width:number;height:number}|null>(null)
  const base = preset.imageUrl
  const mouth = preset.mouthImageUrl
  useEffect(() => { let live=true; setBaseSize(null); void measureNaturalSize(base).then(v=>{if(live)setBaseSize(v)}); return ()=>{live=false} }, [base])
  useEffect(() => { let live=true; setMouthSize(null); if(mouth) void measureNaturalSize(mouth).then(v=>{if(live)setMouthSize(v)}); return ()=>{live=false} }, [mouth])
  const note = mouthAspectNote(baseSize, mouthSize)
  const enabled = Boolean(base)
  async function applyUrl() {
    setError(''); setInfo('')
    if (!url.trim()) { setError('画像URLを入力してください。'); return }
    setBusy(true)
    try {
      const resolved = await resolveImageSource(url, 'auto', maxWidth > 0 ? maxWidth : undefined)
      onChange({ ...preset, mouthImageUrl: resolved.imageUrl })
      setInfo(`口開き絵を設定しました（${resolved.note}）。${resolved.warning ? `／⚠️ ${resolved.warning}` : ''}`)
    } catch { setError('画像の読み込みに失敗しました。') } finally { setBusy(false) }
  }
  async function onFile(file?: File) {
    if (!file) return
    setError(''); setInfo('')
    if (!isWithinSizeLimit(file)) { setError('画像が大きすぎます（8MB まで）。'); return }
    setBusy(true)
    try {
      const imageUrl = await fileToDataUri(file, { maxWidth: maxWidth > 0 ? maxWidth : undefined })
      onChange({ ...preset, mouthImageUrl: imageUrl })
      setInfo('口開き絵を設定しました（data URI 埋め込み）。')
    } catch { setError('画像の読み込みに失敗しました。') } finally { setBusy(false) }
  }
  return <>
    <div className="subhead">口パク</div>
    {!enabled && <p className="hint" style={{ color: 'var(--warn)' }} role="status">先に上の「立ち絵画像」を設定してください。</p>}
    <div className="field"><label htmlFor="pr-mouth-file">口開き絵のアップロード</label><input id="pr-mouth-file" type="file" accept="image/*" disabled={!enabled || busy} onChange={e=>void onFile(e.currentTarget.files?.[0])}/></div>
    <div className="field"><label htmlFor="pr-mouth-url">口開き絵のURL</label><input id="pr-mouth-url" type="url" value={url} disabled={!enabled || busy} onChange={e=>setUrl(e.target.value)}/></div>
    <button type="button" disabled={!enabled || busy} onClick={()=>void applyUrl()}>口開き絵のURLを反映</button>
    {mouth && <div className="preset-image-row"><span className="thumb lg"><img src={mouth} alt="口開き絵"/></span><button type="button" onClick={()=>onChange({...preset,mouthImageUrl:undefined,mouthIntervalMs:undefined})}>口開き絵を外す</button></div>}
    <div className="field"><label htmlFor="pr-mouth-ms">口パクの周期(ms){!mouth && enabled && <small>口開き絵を設定すると使えます</small>}</label><input id="pr-mouth-ms" type="number" min={50} step={10} disabled={!enabled || !mouth} value={preset.mouthIntervalMs ?? DEFAULT_MOUTH_INTERVAL_MS} onChange={e=>onChange({...preset,mouthIntervalMs:e.target.value === '' ? undefined : Number(e.target.value)})}/></div>
    {note && <p className="hint" style={{color:'var(--danger)'}} role="alert">{note}</p>}{busy && <p className="hint">処理中…</p>}{info && <p className="hint">{info}</p>}{error && <p className="hint" style={{color:'var(--danger)'}} role="alert">{error}</p>}
  </>
}
