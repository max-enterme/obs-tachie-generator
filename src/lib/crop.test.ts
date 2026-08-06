import { describe, expect, it } from 'vitest'
import {
  computeTrimBounds,
  dataUriBytes,
  isFullRect,
  normalizeCropRect,
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
