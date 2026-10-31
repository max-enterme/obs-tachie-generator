import { describe, expect, it } from 'vitest'
import {
  computeTrimBounds,
  dataUriBytes,
  dragCropRect,
  hitTestCrop,
  isFullRect,
  normalizeCropRect,
  screenToImagePoint,
  type CropRect,
} from './crop'

/**
 * アスキーアートから RGBA を作る。`#` = 不透明 / `.` = 完全透明 / `1`〜`9` = アルファ(数字×25)。
 * 「どこに余白があるか」が読んで分かる形でテストを書くため。
 */
function pixels(rows: string[]): { pixels: Uint8ClampedArray; dims: { width: number; height: number } } {
  const h = rows.length
  const w = rows[0].length
  const data = new Uint8ClampedArray(w * h * 4)
  rows.forEach((row, y) => {
    expect(row.length).toBe(w) // 行の長さ違いはテスト側のミス
    for (let x = 0; x < w; x++) {
      const c = row[x]
      const alpha = c === '#' ? 255 : c === '.' ? 0 : Number(c) * 25
      const i = (y * w + x) * 4
      data[i] = 200
      data[i + 1] = 100
      data[i + 2] = 50
      data[i + 3] = alpha
    }
  })
  return { pixels: data, dims: { width: w, height: h } }
}

describe('normalizeCropRect', () => {
  const dims = { width: 100, height: 80 }

  it('画像内に収まる整数矩形はそのまま', () => {
    expect(normalizeCropRect({ x: 10, y: 20, width: 30, height: 40 }, dims)).toEqual({
      x: 10,
      y: 20,
      width: 30,
      height: 40,
    })
  })

  it('小数は四捨五入する', () => {
    expect(normalizeCropRect({ x: 10.4, y: 20.6, width: 30.5, height: 9.4 }, dims)).toEqual({
      // x: 10.4 → 10 / 右端 40.9 → 41
      x: 10,
      y: 21,
      width: 31,
      // y: 21 / 下端 30.0 → 30
      height: 9,
    })
  })

  it('負の幅・高さは向きを正す（逆向きドラッグ）', () => {
    expect(normalizeCropRect({ x: 40, y: 60, width: -30, height: -40 }, dims)).toEqual({
      x: 10,
      y: 20,
      width: 30,
      height: 40,
    })
  })

  it('画像の外へはみ出した分はクランプする', () => {
    expect(normalizeCropRect({ x: -20, y: -10, width: 500, height: 500 }, dims)).toEqual({
      x: 0,
      y: 0,
      width: 100,
      height: 80,
    })
    expect(normalizeCropRect({ x: 90, y: 70, width: 50, height: 50 }, dims)).toEqual({
      x: 90,
      y: 70,
      width: 10,
      height: 10,
    })
  })

  it('幅 0 / 高さ 0 の矩形は拒否する（0px の canvas は作れない）', () => {
    expect(normalizeCropRect({ x: 10, y: 10, width: 0, height: 20 }, dims)).toBeNull()
    expect(normalizeCropRect({ x: 10, y: 10, width: 20, height: 0 }, dims)).toBeNull()
    // 四捨五入で 1px 未満に潰れる場合も同じ
    expect(normalizeCropRect({ x: 10, y: 10, width: 0.4, height: 20 }, dims)).toBeNull()
  })

  it('画像とまったく重ならない矩形は拒否する', () => {
    expect(normalizeCropRect({ x: 200, y: 200, width: 50, height: 50 }, dims)).toBeNull()
    expect(normalizeCropRect({ x: -80, y: 0, width: 50, height: 50 }, dims)).toBeNull()
  })

  it('画像のサイズが不正なら拒否する', () => {
    const r: CropRect = { x: 0, y: 0, width: 10, height: 10 }
    expect(normalizeCropRect(r, { width: 0, height: 80 })).toBeNull()
    expect(normalizeCropRect(r, { width: 100, height: 0 })).toBeNull()
  })

  it('NaN / Infinity は拒否する（入力欄を空にすると NaN が来る）', () => {
    expect(normalizeCropRect({ x: NaN, y: 0, width: 10, height: 10 }, dims)).toBeNull()
    expect(normalizeCropRect({ x: 0, y: 0, width: Infinity, height: 10 }, dims)).toBeNull()
  })
})

describe('screenToImagePoint', () => {
  // 600×900 の画像を 200×300 で表示（1 画面px = 3 画像px）。
  const dims = { width: 600, height: 900 }
  const box = { left: 100, top: 50, width: 200, height: 300 }

  it('画像の内側は表示倍率で換算する', () => {
    expect(screenToImagePoint(200, 200, box, dims, 6)).toEqual({ x: 300, y: 450 })
  })

  it('画像の外は最寄りの辺にクランプする（四隅の外から押し始められる）', () => {
    expect(screenToImagePoint(80, 30, box, dims, 6)).toEqual({ x: 0, y: 0 })
    expect(screenToImagePoint(320, 30, box, dims, 6)).toEqual({ x: 600, y: 0 })
    expect(screenToImagePoint(80, 370, box, dims, 6)).toEqual({ x: 0, y: 900 })
    expect(screenToImagePoint(320, 370, box, dims, 6)).toEqual({ x: 600, y: 900 })
  })

  it('辺から snapPx 以内の内側は辺に吸い付く', () => {
    // 左上から 5px 内側 → 吸着で 0
    expect(screenToImagePoint(105, 55, box, dims, 6)).toEqual({ x: 0, y: 0 })
    // 右下から 5px 内側 → 吸着で画像の幅・高さ
    expect(screenToImagePoint(295, 345, box, dims, 6)).toEqual({ x: 600, y: 900 })
  })

  it('snapPx を超えれば吸着しない', () => {
    const p = screenToImagePoint(107, 57, box, dims, 6)
    expect(p?.x).toBeCloseTo(21)
    expect(p?.y).toBeCloseTo(21)
  })

  it('snapPx = 0 なら吸着せずそのまま換算', () => {
    const p = screenToImagePoint(101, 349, box, dims, 0)
    expect(p?.x).toBeCloseTo(3)
    expect(p?.y).toBeCloseTo(897)
  })

  it('表示サイズが潰れていたら null', () => {
    expect(screenToImagePoint(0, 0, { left: 0, top: 0, width: 0, height: 10 }, dims, 6)).toBeNull()
  })
})

describe('hitTestCrop', () => {
  // 600×900 の画像を 200×300 で表示（1 画面px = 3 画像px）。枠は画像の (150,300)〜(450,600)
  // ＝画面の (150,150)〜(250,250)。
  const dims = { width: 600, height: 900 }
  const box = { left: 100, top: 50, width: 200, height: 300 }
  const rect = { x: 150, y: 300, width: 300, height: 300 }
  const hit = (x: number, y: number, r: CropRect | null = rect) => hitTestCrop(x, y, r, box, dims, 8)

  it('四隅は角のハンドル（枠の内外どちらから押しても）', () => {
    expect(hit(150, 150)).toBe('nw')
    expect(hit(145, 145)).toBe('nw')
    expect(hit(255, 145)).toBe('ne')
    expect(hit(146, 254)).toBe('sw')
    expect(hit(252, 248)).toBe('se')
  })

  it('四辺の中ほどは辺のハンドル', () => {
    expect(hit(200, 144)).toBe('n')
    expect(hit(200, 256)).toBe('s')
    expect(hit(144, 200)).toBe('w')
    expect(hit(256, 200)).toBe('e')
    expect(hit(155, 200)).toBe('w')
  })

  it('hitPx を超えて離れた所は掴まない', () => {
    expect(hit(141, 200)).toBe('draw')
    expect(hit(200, 259)).toBe('draw')
  })

  it('辺の延長線上でも枠から離れていればハンドルにしない', () => {
    // 左辺の延長（x=150）だが、枠の下端から 30px 下
    expect(hit(150, 280)).toBe('draw')
  })

  it('枠の内側は移動、外側は描き直し', () => {
    expect(hit(200, 200)).toBe('move')
    expect(hit(120, 100)).toBe('draw')
    expect(hit(280, 300)).toBe('draw')
  })

  it('枠が画像全体なら、内側は描き直し（辺の近くはハンドル）', () => {
    const full = { x: 0, y: 0, width: 600, height: 900 }
    expect(hit(200, 200, full)).toBe('draw')
    expect(hit(103, 200, full)).toBe('w')
    expect(hit(94, 44, full)).toBe('nw')
  })

  it('小さい枠でも内側の中央は移動になる', () => {
    // 画面で 12×12 の枠（内側へのハンドル幅は 12/4 = 3px に抑えられる）
    const small = { x: 300, y: 450, width: 36, height: 36 }
    expect(hit(206, 206, small)).toBe('move')
    expect(hit(201, 206, small)).toBe('w')
    expect(hit(211, 211, small)).toBe('se')
  })

  it('枠が無ければ描き直し', () => {
    expect(hit(200, 200, null)).toBe('draw')
  })
})

describe('dragCropRect', () => {
  const dims = { width: 600, height: 900 }
  const start = { x: 100, y: 200, width: 300, height: 400 }
  const from = { x: 0, y: 0 } // ハンドル操作では使わない

  it('辺のハンドルはその辺だけ動かす', () => {
    expect(dragCropRect('w', start, from, { x: 50, y: 999 }, dims)).toEqual({ x: 50, y: 200, width: 350, height: 400 })
    expect(dragCropRect('e', start, from, { x: 500, y: 0 }, dims)).toEqual({ x: 100, y: 200, width: 400, height: 400 })
    expect(dragCropRect('n', start, from, { x: 0, y: 300 }, dims)).toEqual({ x: 100, y: 300, width: 300, height: 300 })
    expect(dragCropRect('s', start, from, { x: 0, y: 900 }, dims)).toEqual({ x: 100, y: 200, width: 300, height: 700 })
  })

  it('角のハンドルは2辺を動かす', () => {
    expect(dragCropRect('nw', start, from, { x: 0, y: 0 }, dims)).toEqual({ x: 0, y: 0, width: 400, height: 600 })
    expect(dragCropRect('se', start, from, { x: 250, y: 400 }, dims)).toEqual({ x: 100, y: 200, width: 150, height: 200 })
    expect(dragCropRect('ne', start, from, { x: 600, y: 100 }, dims)).toEqual({ x: 100, y: 100, width: 500, height: 500 })
    expect(dragCropRect('sw', start, from, { x: 200, y: 700 }, dims)).toEqual({ x: 200, y: 200, width: 200, height: 500 })
  })

  it('反対の辺を越えず、最低 1px 残して止まる', () => {
    expect(dragCropRect('w', start, from, { x: 550, y: 0 }, dims)).toEqual({ x: 399, y: 200, width: 1, height: 400 })
    expect(dragCropRect('se', start, from, { x: 0, y: 0 }, dims)).toEqual({ x: 100, y: 200, width: 1, height: 1 })
  })

  it('移動は差分だけずらし、大きさは変えない', () => {
    expect(dragCropRect('move', start, { x: 200, y: 300 }, { x: 250, y: 250 }, dims)).toEqual({
      x: 150,
      y: 150,
      width: 300,
      height: 400,
    })
  })

  it('移動は画像の外へ出ない', () => {
    expect(dragCropRect('move', start, { x: 200, y: 300 }, { x: 0, y: 0 }, dims)).toEqual({
      x: 0,
      y: 0,
      width: 300,
      height: 400,
    })
    expect(dragCropRect('move', start, { x: 200, y: 300 }, { x: 600, y: 900 }, dims)).toEqual({
      x: 300,
      y: 500,
      width: 300,
      height: 400,
    })
  })
})

describe('isFullRect', () => {
  it('画像全体と一致するかを見る', () => {
    const dims = { width: 100, height: 80 }
    expect(isFullRect({ x: 0, y: 0, width: 100, height: 80 }, dims)).toBe(true)
    expect(isFullRect({ x: 0, y: 0, width: 100, height: 79 }, dims)).toBe(false)
    expect(isFullRect({ x: 1, y: 0, width: 99, height: 80 }, dims)).toBe(false)
  })
})

describe('computeTrimBounds', () => {
  it('四方に余白がある画像を絵の実体まで詰める', () => {
    const { pixels: p, dims } = pixels([
      '......',
      '..##..',
      '..##..',
      '......',
    ])
    expect(computeTrimBounds(p, dims)).toEqual({ x: 2, y: 1, width: 2, height: 2 })
  })

  it('全面不透明なら原寸のまま返す（詰める余地なし）', () => {
    const { pixels: p, dims } = pixels(['####', '####'])
    const rect = computeTrimBounds(p, dims)
    expect(rect).toEqual({ x: 0, y: 0, width: 4, height: 2 })
    expect(isFullRect(rect!, dims)).toBe(true)
  })

  it('**全面透明はトリムしない**（全消しを避けて安全側に倒す）', () => {
    const { pixels: p, dims } = pixels(['....', '....'])
    expect(computeTrimBounds(p, dims)).toBeNull()
  })

  it('片側だけ余白があるケース', () => {
    // 左だけ余白
    const left = pixels(['..##', '..##'])
    expect(computeTrimBounds(left.pixels, left.dims)).toEqual({ x: 2, y: 0, width: 2, height: 2 })
    // 下だけ余白
    const bottom = pixels(['####', '####', '....'])
    expect(computeTrimBounds(bottom.pixels, bottom.dims)).toEqual({
      x: 0,
      y: 0,
      width: 4,
      height: 2,
    })
  })

  it('1px の絵でも潰さない', () => {
    const { pixels: p, dims } = pixels(['.....', '..#..', '.....'])
    expect(computeTrimBounds(p, dims)).toEqual({ x: 2, y: 1, width: 1, height: 1 })
  })

  it('離れた点は両方を含む外接矩形になる', () => {
    const { pixels: p, dims } = pixels([
      '#....',
      '.....',
      '....#',
    ])
    expect(computeTrimBounds(p, dims)).toEqual({ x: 0, y: 0, width: 5, height: 3 })
  })

  it('既定のしきい値は「完全透明のみ」＝半透明は残す（落ち影を巻き込まない）', () => {
    // '1' = アルファ 25（薄い落ち影のつもり）
    const { pixels: p, dims } = pixels(['1111', '.##.', '1111'])
    expect(computeTrimBounds(p, dims)).toEqual({ x: 0, y: 0, width: 4, height: 3 })
  })

  it('しきい値を上げると半透明も余白として落とす', () => {
    const { pixels: p, dims } = pixels(['1111', '.##.', '1111'])
    expect(computeTrimBounds(p, dims, 25)).toEqual({ x: 1, y: 1, width: 2, height: 1 })
  })

  it('寸法とデータ長が食い違うときは手を出さない', () => {
    const { pixels: p } = pixels(['##', '##'])
    expect(computeTrimBounds(p, { width: 10, height: 10 })).toBeNull()
  })

  it('サイズ 0 は拒否する', () => {
    expect(computeTrimBounds(new Uint8ClampedArray(0), { width: 0, height: 0 })).toBeNull()
  })
})

describe('dataUriBytes', () => {
  it('base64 の実データ長からバイト数を出す', () => {
    // "hello" (5バイト) = aGVsbG8=
    expect(dataUriBytes('data:image/png;base64,aGVsbG8=')).toBe(5)
    // "hi" (2バイト) = aGk=
    expect(dataUriBytes('data:image/png;base64,aGk=')).toBe(2)
    // パディング無し（3の倍数）
    expect(dataUriBytes('data:image/png;base64,YWJj')).toBe(3)
  })

  it('data URI でなければ 0', () => {
    expect(dataUriBytes('https://example.test/a.png')).toBe(0)
    expect(dataUriBytes('')).toBe(0)
  })
})
