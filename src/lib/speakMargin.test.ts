import { describe, expect, it } from 'vitest'
import { requiredSpeakMargin, speakMarginNote } from './speakMargin'
import { DEFAULT_SPEAK } from './types'

describe('requiredSpeakMargin', () => {
  it('S1 枠・後光は幅×6を上下左右に', () => {
    for (const [w, expected] of [
      [2, 12],
      [4, 24],
      [6, 36],
      [12, 72],
    ] as const) {
      const speak = { ...DEFAULT_SPEAK, bounce: false, outline: true, outlineWidth: w }
      expect(requiredSpeakMargin(speak, 'right', 'bottom')).toEqual({ x: expected, y: expected })
    }
  })

  it('S2 幅0以下は1として数え、端数は切り上げ', () => {
    for (const [w, expected] of [
      [0, 6],
      [2.5, 15],
      [2.3, 14],
    ] as const) {
      const speak = { ...DEFAULT_SPEAK, bounce: false, outline: true, outlineWidth: w }
      expect(requiredSpeakMargin(speak, 'left', 'bottom').x).toBe(expected)
    }
  })

  it('S3 上アンカーだけ縦に跳ね量を足す', () => {
    const speak = { ...DEFAULT_SPEAK, outline: true, outlineWidth: 2, bounce: true, jumpPx: 10 }
    expect(requiredSpeakMargin(speak, 'left', 'top')).toEqual({ x: 12, y: 22 })
    expect(requiredSpeakMargin(speak, 'left', 'bottom')).toEqual({ x: 12, y: 12 })

    const speakHalf = { ...speak, jumpPx: 10.5 }
    expect(requiredSpeakMargin(speakHalf, 'left', 'top')).toEqual({ x: 12, y: 23 })
  })

  it('S4 枠なし・ぴょこぴょこだけ', () => {
    const speak = { ...DEFAULT_SPEAK, outline: false, bounce: true, jumpPx: 10 }
    expect(requiredSpeakMargin(speak, 'left', 'top')).toEqual({ x: 0, y: 10 })
    expect(requiredSpeakMargin(speak, 'left', 'bottom')).toEqual({ x: 0, y: 0 })
  })

  it('S5 jumpPx 0 は足さない', () => {
    const speak = { ...DEFAULT_SPEAK, outline: false, bounce: true, jumpPx: 0 }
    expect(requiredSpeakMargin(speak, 'left', 'top')).toEqual({ x: 0, y: 0 })
  })

  it('S6 中央アンカーの軸は null', () => {
    expect(requiredSpeakMargin(DEFAULT_SPEAK, 'center', 'bottom')).toEqual({ x: null, y: 12 })
    expect(requiredSpeakMargin(DEFAULT_SPEAK, 'left', 'middle')).toEqual({ x: 12, y: null })
    expect(requiredSpeakMargin(DEFAULT_SPEAK, 'center', 'middle')).toEqual({ x: null, y: null })
  })
})

describe('speakMarginNote', () => {
  it('S7 足りないときだけ警告', () => {
    expect(speakMarginNote(12, 0)).toEqual({
      warn: true,
      text: '発話演出が端で切れます。12px 以上にしてください',
    })
    expect(speakMarginNote(12, 12)).toEqual({
      warn: false,
      text: '発話演出に必要な余白: 12px',
    })
    expect(speakMarginNote(12, 16)).toEqual({
      warn: false,
      text: '発話演出に必要な余白: 12px',
    })
    expect(speakMarginNote(24, 23)).toEqual({
      warn: true,
      text: '発話演出が端で切れます。24px 以上にしてください',
    })
    expect(speakMarginNote(24, 24)).toEqual({
      warn: false,
      text: '発話演出に必要な余白: 24px',
    })
  })

  it('S8 必要値0・nullは出さない', () => {
    expect(speakMarginNote(0, 0)).toBeNull()
    expect(speakMarginNote(null, 0)).toBeNull()
  })
})
