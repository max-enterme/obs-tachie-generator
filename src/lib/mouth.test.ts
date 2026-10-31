import { describe, expect, it } from 'vitest'
import { mouthAspectNote } from './mouth'

describe('mouthAspectNote', () => {
  it('M7 縦横比が同じなら出さない', () => {
    expect(mouthAspectNote({ width: 600, height: 900 }, { width: 300, height: 450 })).toBeNull()
    expect(mouthAspectNote({ width: 600, height: 900 }, { width: 600, height: 905 })).toBeNull()
  })

  it('M8 違うときだけ警告', () => {
    expect(mouthAspectNote({ width: 600, height: 900 }, { width: 600, height: 600 })).toBe(
      '口開き絵の縦横比が立ち絵と違います（立ち絵 600×900 / 口開き 600×600）。口開き絵は立ち絵の枠に収めて中央に出します。',
    )
  })

  it('M9 測れていなければ出さない', () => {
    expect(mouthAspectNote(null, { width: 600, height: 900 })).toBeNull()
    expect(mouthAspectNote({ width: 600, height: 900 }, null)).toBeNull()
    expect(mouthAspectNote(null, null)).toBeNull()
  })
})
