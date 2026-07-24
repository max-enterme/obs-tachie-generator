import { describe, expect, it } from 'vitest'
import { computeResizeDimensions, isWithinSizeLimit } from './image'

describe('computeResizeDimensions', () => {
  it('maxWidth 未指定なら原寸のまま', () => {
    expect(computeResizeDimensions({ width: 960, height: 540 })).toEqual({
      width: 960,
      height: 540,
    })
  })

  it('maxWidth 以下なら拡大しない', () => {
    expect(computeResizeDimensions({ width: 400, height: 300 }, 800)).toEqual({
      width: 400,
      height: 300,
    })
  })

  it('maxWidth 超過はアスペクト比を保って縮小する', () => {
    expect(computeResizeDimensions({ width: 960, height: 540 }, 480)).toEqual({
      width: 480,
      height: 270,
    })
  })

  it('高さの端数は四捨五入する', () => {
    expect(computeResizeDimensions({ width: 1000, height: 333 }, 500)).toEqual({
      width: 500,
      height: 167,
    })
  })

  it('極端な縮小でも高さは最低 1px', () => {
    expect(computeResizeDimensions({ width: 1000, height: 2 }, 1)).toEqual({
      width: 1,
      height: 1,
    })
  })

  it('maxWidth が 0 以下ならリサイズしない', () => {
    expect(computeResizeDimensions({ width: 960, height: 540 }, 0)).toEqual({
      width: 960,
      height: 540,
    })
  })
})

describe('isWithinSizeLimit', () => {
  it('上限以下は true', () => {
    expect(isWithinSizeLimit({ size: 1000 } as File, 2000)).toBe(true)
  })
  it('上限超過は false', () => {
    expect(isWithinSizeLimit({ size: 3000 } as File, 2000)).toBe(false)
  })
})
