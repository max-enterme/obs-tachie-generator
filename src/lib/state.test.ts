import { describe, expect, it } from 'vitest'
import { normalizeState } from './state'
import { cssFilename } from './download'
import { DEFAULT_OPTIONS } from './types'

describe('normalizeState', () => {
  it('空入力は既定オプション＋空ユーザー', () => {
    const s = normalizeState(null)
    expect(s.users).toEqual([])
    expect(s.options).toEqual(DEFAULT_OPTIONS)
  })

  it('不正なユーザーを弾き、正しいものだけ残す', () => {
    const s = normalizeState({
      users: [
        { id: '1', name: 'a', imageUrl: 'data:...' },
        { id: 2, name: 'bad' },
        'nope',
      ],
    })
    expect(s.users).toHaveLength(1)
    expect(s.users[0].id).toBe('1')
  })

  it('部分的な options を既定で埋める', () => {
    const s = normalizeState({ options: { left: 100, speak: { jumpPx: 5 } } })
    expect(s.options.left).toBe(100)
    expect(s.options.bottom).toBe(DEFAULT_OPTIONS.bottom)
    expect(s.options.speak.jumpPx).toBe(5)
    expect(s.options.speak.outline).toBe(DEFAULT_OPTIONS.speak.outline)
    expect(s.options.speak.outlineColor).toBe(DEFAULT_OPTIONS.speak.outlineColor)
  })
})

describe('cssFilename', () => {
  it('表示名から安全なファイル名を作る', () => {
    expect(cssFilename('ユーザーA')).toBe('streamkit-ユーザーA.css')
    expect(cssFilename('a/b c')).toBe('streamkit-a_b_c.css')
    expect(cssFilename('   ')).toBe('streamkit-streamkit.css')
  })
})
