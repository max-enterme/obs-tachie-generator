import { useEffect, useRef, useState } from 'react'
import {
  cropDataUri,
  dataUriBytes,
  detectTrimRect,
  dragCropRect,
  hitTestCrop,
  isFullRect,
  normalizeCropRect,
  readDimensions,
  screenToImagePoint,
  type CropGrab,
  type CropHandle,
  type CropRect,
} from '../lib/crop'
import type { Dimensions } from '../lib/image'

interface Props {
  /** 切り抜く対象（取り込み済みの data URI 推奨）。空なら何も出さない。 */
  imageUrl: string
  /** 切り抜き後の data URI。呼び手が `Preset.imageUrl` を差し替える。 */
  onApply: (dataUrl: string) => void
}

/** 確認段階で持つ「実際に切り抜いた結果」。押した時点で計算し、見せてから確定する。 */
interface Pending {
  dataUrl: string
  rect: CropRect
  /** どの操作から来たか（確認文言の出し分け）。 */
  source: 'trim' | 'rect'
}

/**
 * 辺への吸着距離（画面px）。縮小表示では端ぴったりが 1 画面px 未満の的になるので、
 * この距離まで近づけば端に寄せる。端から数 px だけ削りたいときは数値入力で詰める。
 */
const EDGE_SNAP_PX = 6

/** 枠の辺・角を掴める距離（画面px）。見た目のハンドル（10px 角）より少し広くして掴み損ねを減らす。 */
const HANDLE_HIT_PX = 8

const HANDLES: CropHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

/** 掴んだ所に応じたマウスカーソル（押す前に「何が起きるか」が分かるように）。 */
const GRAB_CURSOR: Record<CropGrab, string> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  move: 'move',
  draw: 'crosshair',
}

/** ドラッグ中の状態。`start` は押した時点の矩形（ハンドル・移動の基準）、`last` は直近に描いた矩形。 */
interface Drag {
  grab: CropGrab
  from: { x: number; y: number }
  start: CropRect | null
  last: CropRect | null
}

/** バイト数を読みやすく。 */
function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

/**
 * 立ち絵画像のクロップ UI。**「余白を詰める」（自動トリム）と「範囲を指定して切り抜き」**の2経路。
 *
 * クロップは破壊的（原本を持たない）ので、**適用前に必ず確認を挟む**。確認はブラウザの
 * `confirm()` ではなくパネル内の2段階ボタンにした — OBS の内蔵ブラウザなど `confirm()` が
 * 抑止される環境があるうえ、**切り抜き後の寸法と埋め込みサイズをその場で見せたい**ため
 * （PNG 固定なので、元が JPEG/WebP だと逆に膨らむことがある）。
 *
 * 確認段階では**実際に切り抜いた結果**を持っている（押した時点で canvas を通す）。
 * 見せている数値と適用されるものが必ず一致する。
 */
export default function CropEditor({ imageUrl, onApply }: Props) {
  const [dims, setDims] = useState<Dimensions | null>(null)
  /** 寸法の読み込み状態。「読み込み中」と「読めなかった」を分けないと、失敗が永久に「取得中…」に見える。 */
  const [dimsState, setDimsState] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [rectMode, setRectMode] = useState(false)
  const [rect, setRect] = useState<CropRect | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState('')
  const [error, setError] = useState('')
  const imgRef = useRef<HTMLImageElement>(null)
  const dragging = useRef<Drag | null>(null)
  /** マウスが乗っている所で起きる操作（カーソルの出し分け）。 */
  const [hover, setHover] = useState<CropGrab>('draw')

  // 画像が変わったら、寸法も選択中の範囲も確認待ちも捨てる（前の画像の座標は意味を持たない）。
  useEffect(() => {
    setRect(null)
    setPending(null)
    setInfo('')
    setError('')
    setRectMode(false)
    setDims(null)
    if (!imageUrl) {
      setDimsState('failed')
      return
    }
    setDimsState('loading')
    let alive = true
    readDimensions(imageUrl)
      .then((d) => {
        if (!alive) return
        setDims(d)
        setDimsState('ready')
      })
      .catch(() => {
        if (!alive) return
        setDimsState('failed')
      })
    return () => {
      alive = false
    }
  }, [imageUrl])

  if (!imageUrl) return null

  const bytes = dataUriBytes(imageUrl)

  /**
   * 画面座標 → 画像のピクセル座標（画像の外は辺にクランプ、辺の近くは辺に吸着）。
   * 枠ごとの移動では吸着させない（端の近くで枠がカクっと跳ねる）。
   */
  function toImagePoint(
    clientX: number,
    clientY: number,
    snapPx = EDGE_SNAP_PX,
  ): { x: number; y: number } | null {
    const el = imgRef.current
    if (!el || !dims) return null
    return screenToImagePoint(clientX, clientY, el.getBoundingClientRect(), dims, snapPx)
  }

  /** 押した位置で、枠のどこを掴んだか（ハンドル / 移動 / 描き直し）。 */
  function grabAt(clientX: number, clientY: number): CropGrab {
    const el = imgRef.current
    if (!el || !dims) return 'draw'
    return hitTestCrop(clientX, clientY, safeRect, el.getBoundingClientRect(), dims, HANDLE_HIT_PX)
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!dims) return
    const grab = grabAt(e.clientX, e.clientY)
    const p = toImagePoint(e.clientX, e.clientY, grab === 'move' ? 0 : EDGE_SNAP_PX)
    if (!p) return
    e.currentTarget.setPointerCapture(e.pointerId)
    // 描き直しは押した点から始める。ハンドル・移動は動かすまで枠を変えない。
    const first = grab === 'draw' ? { x: p.x, y: p.y, width: 0, height: 0 } : safeRect
    dragging.current = { grab, from: p, start: safeRect, last: first }
    setHover(grab)
    setRect(first)
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragging.current
    if (!dims) return
    if (!drag) {
      setHover(grabAt(e.clientX, e.clientY))
      return
    }
    const p = toImagePoint(e.clientX, e.clientY, drag.grab === 'move' ? 0 : EDGE_SNAP_PX)
    if (!p) return
    const { grab, from, start } = drag
    drag.last =
      grab !== 'draw' && start
        ? dragCropRect(grab, start, from, p, dims)
        : // 生の矩形（負の幅を含む）で持ち、確定時に normalizeCropRect が向きを正す。
          { x: from.x, y: from.y, width: p.x - from.x, height: p.y - from.y }
    setRect(drag.last)
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragging.current
    if (!drag || !dims) return
    dragging.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
    // ドラッグ終了時に整数矩形へ寄せる（数値入力と同じ値になる）。
    const next = drag.last ? normalizeCropRect(drag.last, dims) : null
    setRect(next)
    const el = imgRef.current
    if (el) setHover(hitTestCrop(e.clientX, e.clientY, next, el.getBoundingClientRect(), dims, HANDLE_HIT_PX))
  }

  /** 数値入力からの1辺の更新。 */
  function setRectField(key: keyof CropRect, value: number) {
    if (!dims) return
    const base = rect ?? { x: 0, y: 0, width: dims.width, height: dims.height }
    // 入力中は正規化しない（幅を消して打ち直す途中で勝手に補正されると打てない）。
    setRect({ ...base, [key]: value })
  }

  /** 表示用に正規化した矩形（枠の描画と「切り抜く」の可否に使う）。 */
  const safeRect = rect && dims ? normalizeCropRect(rect, dims) : null

  async function runTrim() {
    if (!imageUrl) return
    setBusy(true)
    setInfo('')
    setError('')
    try {
      const found = await detectTrimRect(imageUrl)
      if (!found) {
        setInfo('透明な余白は見つかりませんでした（詰める余地がありません）。')
        return
      }
      const out = await cropDataUri(imageUrl, found)
      setPending({ dataUrl: out.dataUrl, rect: out.rect, source: 'trim' })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'クロップに失敗しました')
    } finally {
      setBusy(false)
    }
  }

  async function runRectCrop() {
    if (!imageUrl || !safeRect) return
    setBusy(true)
    setInfo('')
    setError('')
    try {
      const out = await cropDataUri(imageUrl, safeRect)
      setPending({ dataUrl: out.dataUrl, rect: out.rect, source: 'rect' })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'クロップに失敗しました')
    } finally {
      setBusy(false)
    }
  }

  function confirmApply() {
    if (!pending) return
    onApply(pending.dataUrl)
    setPending(null)
    setRect(null)
    setRectMode(false)
    setInfo('切り抜きを適用しました。')
  }

  // 枠のプレビュー（画像に対する % で置く。表示倍率が変わっても追従する）。
  const boxStyle =
    safeRect && dims
      ? {
          left: `${(safeRect.x / dims.width) * 100}%`,
          top: `${(safeRect.y / dims.height) * 100}%`,
          width: `${(safeRect.width / dims.width) * 100}%`,
          height: `${(safeRect.height / dims.height) * 100}%`,
        }
      : undefined

  const pendingBytes = pending ? dataUriBytes(pending.dataUrl) : 0

  return (
    <>
      <div className="subhead">クロップ（切り抜き）</div>
      <p className="hint" style={{ marginTop: 0 }}>
        現在{' '}
        {dims
          ? `${dims.width}×${dims.height}px`
          : dimsState === 'loading'
            ? 'サイズ取得中…'
            : 'サイズ不明'}{' '}
        / 埋め込み {formatBytes(bytes)}
        {'　'}
        <strong>透明な余白があるとアンカーが余白の分だけズレます。</strong>
      </p>
      {dimsState === 'failed' && (
        <p className="hint" style={{ color: 'var(--warn)' }} role="status">
          この画像は読み込めないためクロップできません（外部URLのまま参照している場合は、
          取り込み直して data URI にしてください）。
        </p>
      )}

      <div className="chips" style={{ marginBottom: 10 }}>
        <button
          type="button"
          className="chip"
          disabled={busy || !dims || pending != null}
          onClick={runTrim}
        >
          余白を詰める
        </button>
        <button
          type="button"
          className="chip"
          data-on={rectMode}
          aria-pressed={rectMode}
          disabled={busy || !dims || pending != null}
          onClick={() => {
            const next = !rectMode
            setRectMode(next)
            setInfo('')
            setError('')
            // 開いたら画像全体を初期値にする（そこから縮める操作が自然）。
            setRect(next && dims ? { x: 0, y: 0, width: dims.width, height: dims.height } : null)
          }}
        >
          範囲を指定して切り抜き
        </button>
      </div>

      {rectMode && dims && (
        <div className="crop-edit">
          <div
            className="crop-stage"
            style={{ cursor: GRAB_CURSOR[hover] }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            // 既存の選択範囲や画像を掴んだネイティブのドラッグ＆ドロップが始まると pointercancel で途切れる。
            onDragStart={(e) => e.preventDefault()}
            aria-label="ドラッグで切り抜く範囲を指定（数値入力でも指定できます）"
          >
            {/* 画像の周りの余白（.crop-stage の padding）からも押し始められる＝端から選べる。 */}
            <div className="crop-frame">
              <img ref={imgRef} src={imageUrl} alt="" draggable={false} />
              {boxStyle && (
                <div className="crop-box" style={boxStyle}>
                  {/* 見た目だけ。掴めるかどうかは hitTestCrop が決める（ハンドルより少し広く掴める）。 */}
                  {HANDLES.map((h) => (
                    <span key={h} className="crop-handle" data-handle={h} />
                  ))}
                </div>
              )}
            </div>
          </div>
          <p className="hint" style={{ marginTop: 0 }}>
            枠の辺・角（白い四角）を掴むとその辺・角だけ動きます。枠の内側を掴むと枠ごと移動、
            枠の外から押すと範囲を描き直します。点線の枠の中なら画像の外から押し始めても選べ、
            端の近くは端に吸い付きます。
          </p>

          <div className="row">
            {(
              [
                ['x', 'X(px)', dims.width - 1],
                ['y', 'Y(px)', dims.height - 1],
                ['width', '幅(px)', dims.width],
                ['height', '高さ(px)', dims.height],
              ] as Array<[keyof CropRect, string, number]>
            ).map(([key, label, max]) => (
              <div className="field" key={key}>
                <label htmlFor={`pr-crop-${key}`}>{label}</label>
                <input
                  id={`pr-crop-${key}`}
                  type="number"
                  min={key === 'width' || key === 'height' ? 1 : 0}
                  max={max}
                  value={rect ? Math.round(rect[key]) : ''}
                  onChange={(e) => setRectField(key, Number(e.target.value))}
                />
              </div>
            ))}
          </div>

          <p className="hint" style={{ marginTop: 0 }}>
            {safeRect
              ? `切り抜き後: ${safeRect.width}×${safeRect.height}px`
              : '範囲が画像の外にあります（幅・高さは 1px 以上）。'}
          </p>

          <button
            type="button"
            className="chip"
            disabled={busy || !safeRect || isFullRect(safeRect, dims) || pending != null}
            onClick={runRectCrop}
          >
            この範囲で切り抜く
          </button>
          {safeRect && isFullRect(safeRect, dims) && (
            <p className="hint" style={{ marginTop: 6 }}>
              画像全体が選択されています（切り抜く範囲を狭めてください）。
            </p>
          )}
        </div>
      )}

      {/* 2段階目：実際に切り抜いた結果を見せてから確定する。 */}
      {pending && dims && (
        <div className="crop-confirm" role="alertdialog" aria-labelledby="pr-crop-confirm-title">
          <p id="pr-crop-confirm-title" style={{ margin: '0 0 6px', fontWeight: 700 }}>
            {pending.source === 'trim' ? '余白を詰めます' : 'この範囲で切り抜きます'}
          </p>
          <p className="hint" style={{ margin: '0 0 4px' }}>
            {dims.width}×{dims.height}px → <strong>{pending.rect.width}×{pending.rect.height}px</strong>
            {'　'}
            埋め込み {formatBytes(bytes)} → <strong>{formatBytes(pendingBytes)}</strong>
            {pendingBytes > bytes && '（PNG 固定のため増えています）'}
          </p>
          <p className="hint" style={{ margin: '0 0 8px', color: 'var(--warn)' }}>
            適用すると<strong>元に戻せません</strong>。やり直すには画像を取り込み直してください。
          </p>
          <div className="chips">
            <button type="button" className="chip" data-on onClick={confirmApply}>
              切り抜きを適用する
            </button>
            <button type="button" className="chip" onClick={() => setPending(null)}>
              やめる
            </button>
          </div>
        </div>
      )}

      {busy && <p className="hint">処理中…</p>}
      {info && <p className="hint">{info}</p>}
      {error && (
        <p className="hint" style={{ color: 'var(--danger)' }} role="alert">
          {error}
        </p>
      )}
    </>
  )
}
