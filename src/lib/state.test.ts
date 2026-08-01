import { describe, expect, it } from 'vitest'
import { normalizeState } from './state'
import { cssFilename } from './download'
import { DEFAULT_OPTIONS, DEFAULT_SPEAK } from './types'

describe('normalizeState', () => {
  it('空入力は空 state', () => {
    expect(normalizeState(null)).toEqual({ users: [], presets: [], pairings: [] })
    expect(normalizeState(undefined)).toEqual({ users: [], presets: [], pairings: [] })
    expect(normalizeState('nope')).toEqual({ users: [], presets: [], pairings: [] })
  })

  it('旧形（options を持ち presets が無い）は破棄して空 state', () => {
    const old = {
      users: [{ id: '1', name: 'a', imageUrl: 'data:...' }],
      options: { left: 100 },
    }
    expect(normalizeState(old)).toEqual({ users: [], presets: [], pairings: [] })
  })

  it('新形を検証して採用する', () => {
    const s = normalizeState({
      users: [{ id: '1', name: 'ユーザーA' }],
      presets: [{ id: 'p1', name: 'プリセットA', imageUrl: 'data:x', left: 10, bottom: 20 }],
      pairings: [{ userId: '1', presetId: 'p1' }],
    })
    expect(s.users).toEqual([{ id: '1', name: 'ユーザーA' }])
    expect(s.presets).toHaveLength(1)
    expect(s.presets[0].id).toBe('p1')
    expect(s.pairings).toEqual([{ userId: '1', presetId: 'p1' }])
  })

  it('不正なユーザー / プリセットを弾く', () => {
    const s = normalizeState({
      users: [{ id: '1', name: 'ok' }, { id: 2, name: 'bad-id' }, 'nope', { name: 'no-id' }],
      presets: [{ id: 'p1', name: 'ok' }, { name: 'no-id' }, 42, null],
    })
    expect(s.users).toEqual([{ id: '1', name: 'ok' }])
    expect(s.presets).toHaveLength(1)
    expect(s.presets[0].id).toBe('p1')
  })

  it('部分 preset を既定で補完する', () => {
    const s = normalizeState({
      users: [],
      presets: [{ id: 'p1', left: 123, speak: { jumpPx: 5 } }],
    })
    const p = s.presets[0]
    expect(p.name).toBe('')
    expect(p.imageUrl).toBe('')
    expect(p.left).toBe(123)
    expect(p.bottom).toBe(DEFAULT_OPTIONS.bottom)
    expect(p.width).toBeUndefined()
    expect(p.dimWhenQuiet).toBe(DEFAULT_OPTIONS.dimWhenQuiet)
    expect(p.speak.jumpPx).toBe(5)
    expect(p.speak.outline).toBe(DEFAULT_SPEAK.outline)
    expect(p.speak.outlineColor).toBe(DEFAULT_SPEAK.outlineColor)
    expect(p.speak.durationMs).toBe(DEFAULT_SPEAK.durationMs)
  })

  it('壊れた pairing（存在しない userId / presetId 参照）を落とす', () => {
    const s = normalizeState({
      users: [{ id: '1', name: 'a' }],
      presets: [{ id: 'p1', name: 'A' }],
      pairings: [
        { userId: '1', presetId: 'p1' }, // valid
        { userId: '999', presetId: 'p1' }, // 不明ユーザー
        { userId: '1', presetId: 'pX' }, // 不明プリセット
        { userId: '1' }, // 不正形
      ],
    })
    expect(s.pairings).toEqual([{ userId: '1', presetId: 'p1' }])
  })

  it('重複 pairing を 1 件に畳む', () => {
    const s = normalizeState({
      users: [{ id: '1', name: 'a' }],
      presets: [{ id: 'p1', name: 'A' }],
      pairings: [
        { userId: '1', presetId: 'p1' },
        { userId: '1', presetId: 'p1' },
      ],
    })
    expect(s.pairings).toEqual([{ userId: '1', presetId: 'p1' }])
  })
})

describe('cssFilename', () => {
  it('表示名から安全なファイル名を作る', () => {
    expect(cssFilename('ユーザーA')).toBe('streamkit-ユーザーA.css')
    expect(cssFilename('a/b c')).toBe('streamkit-a_b_c.css')
    expect(cssFilename('   ')).toBe('streamkit-streamkit.css')
  })
})
