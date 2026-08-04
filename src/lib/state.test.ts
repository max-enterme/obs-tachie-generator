import { describe, expect, it } from 'vitest'
import { normalizeState } from './state'
import { cssFilename } from './download'
import {
  DEFAULT_ANCHOR_X,
  DEFAULT_ANCHOR_Y,
  DEFAULT_NAME_LABEL,
  DEFAULT_OPTIONS,
  DEFAULT_SPEAK,
} from './types'

const EMPTY = { users: [], presets: [], pairings: [], selection: { userId: null, presetId: null } }

describe('normalizeState', () => {
  it('空入力は空 state', () => {
    expect(normalizeState(null)).toEqual(EMPTY)
    expect(normalizeState(undefined)).toEqual(EMPTY)
    expect(normalizeState('nope')).toEqual(EMPTY)
  })

  it('旧形（options を持ち presets が無い）は破棄して空 state', () => {
    const old = {
      users: [{ id: '1', name: 'a', imageUrl: 'data:...' }],
      options: { left: 100 },
    }
    expect(normalizeState(old)).toEqual(EMPTY)
  })

  it('新形を検証して採用する', () => {
    const s = normalizeState({
      users: [{ id: '1', name: 'ユーザーA' }],
      presets: [{ id: 'p1', name: 'プリセットA', imageUrl: 'data:x', left: 10, bottom: 20 }],
      pairings: [{ userId: '1', presetId: 'p1' }],
      selection: { userId: '1', presetId: 'p1' },
    })
    expect(s.users).toEqual([{ id: '1', name: 'ユーザーA' }])
    expect(s.presets).toHaveLength(1)
    expect(s.presets[0].id).toBe('p1')
    expect(s.pairings).toEqual([{ userId: '1', presetId: 'p1' }])
    expect(s.selection).toEqual({ userId: '1', presetId: 'p1' })
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
    expect(p.hideWhenAway).toBe(DEFAULT_OPTIONS.hideWhenAway)
    expect(p.speak.jumpPx).toBe(5)
    expect(p.speak.outline).toBe(DEFAULT_SPEAK.outline)
    expect(p.speak.outlineColor).toBe(DEFAULT_SPEAK.outlineColor)
    expect(p.speak.outlineWidth).toBe(DEFAULT_SPEAK.outlineWidth)
    expect(p.speak.durationMs).toBe(DEFAULT_SPEAK.durationMs)
  })

  it('ユーザーの displayName を保持し、型不一致は displayName だけ捨てる', () => {
    const s = normalizeState({
      users: [
        { id: '1', name: 'メモ名', displayName: '画面名A' },
        { id: '2', name: 'ok' },
        { id: '3', name: '型違い', displayName: 42 },
      ],
      presets: [],
    })
    // 任意フィールドの型不一致でユーザーごと落とさない（プリセット側の方針に揃える）
    expect(s.users).toEqual([
      { id: '1', name: 'メモ名', displayName: '画面名A' },
      { id: '2', name: 'ok' },
      { id: '3', name: '型違い' },
    ])
  })

  it('幅 0 以下は原寸（undefined）に倒す', () => {
    const s = normalizeState({
      users: [],
      presets: [
        { id: 'p1', width: 0 },
        { id: 'p2', width: -10 },
        { id: 'p3', width: 480 },
      ],
    })
    expect(s.presets[0].width).toBeUndefined()
    expect(s.presets[1].width).toBeUndefined()
    expect(s.presets[2].width).toBe(480)
  })

  it('アンカーが無い旧プリセットは既定（左下）で補完する', () => {
    const s = normalizeState({
      users: [],
      presets: [{ id: 'p1', left: 16, bottom: 16 }],
    })
    expect(s.presets[0].anchorX).toBe(DEFAULT_ANCHOR_X)
    expect(s.presets[0].anchorY).toBe(DEFAULT_ANCHOR_Y)
    expect(DEFAULT_ANCHOR_X).toBe('left')
    expect(DEFAULT_ANCHOR_Y).toBe('bottom')
  })

  it('不正なアンカー（別軸の値 / 数値 / null）は既定（左下）に倒す', () => {
    const s = normalizeState({
      users: [],
      presets: [
        { id: 'p1', anchorX: 'middle', anchorY: 'center' }, // 軸の取り違え
        { id: 'p2', anchorX: 0, anchorY: 1 },
        { id: 'p3', anchorX: null, anchorY: null },
        { id: 'p4', anchorX: 'LEFT', anchorY: 'BOTTOM' },
      ],
    })
    for (const p of s.presets) {
      expect(p.anchorX).toBe(DEFAULT_ANCHOR_X)
      expect(p.anchorY).toBe(DEFAULT_ANCHOR_Y)
    }
  })

  it('正しいアンカーはそのまま保持する', () => {
    const s = normalizeState({
      users: [],
      presets: [
        { id: 'p1', anchorX: 'right', anchorY: 'top' },
        { id: 'p2', anchorX: 'center', anchorY: 'middle' },
        { id: 'p3', anchorX: 'left', anchorY: 'bottom' },
      ],
    })
    expect(s.presets[0].anchorX).toBe('right')
    expect(s.presets[0].anchorY).toBe('top')
    expect(s.presets[1].anchorX).toBe('center')
    expect(s.presets[1].anchorY).toBe('middle')
    expect(s.presets[2].anchorX).toBe('left')
    expect(s.presets[2].anchorY).toBe('bottom')
  })

  it('片方だけ指定されたアンカーは、指定側を保持して他方だけ既定に倒す', () => {
    const s = normalizeState({
      users: [],
      presets: [
        { id: 'p1', anchorX: 'right' },
        { id: 'p2', anchorY: 'middle' },
      ],
    })
    expect(s.presets[0].anchorX).toBe('right')
    expect(s.presets[0].anchorY).toBe(DEFAULT_ANCHOR_Y)
    expect(s.presets[1].anchorX).toBe(DEFAULT_ANCHOR_X)
    expect(s.presets[1].anchorY).toBe('middle')
  })

  it('nameLabel が壊れていても（null / 配列 / 文字列）既定で補完する', () => {
    const s = normalizeState({
      users: [],
      presets: [
        { id: 'p1', nameLabel: null },
        { id: 'p2', nameLabel: [] },
        { id: 'p3', nameLabel: 'nope' },
      ],
    })
    for (const p of s.presets) expect(p.nameLabel).toEqual(DEFAULT_NAME_LABEL)
  })

  it('不正な fit は既定に倒す', () => {
    const s = normalizeState({
      users: [],
      presets: [
        { id: 'p1', nameLabel: { fit: 'cover' } },
        { id: 'p2', nameLabel: { fit: 'stretch' } },
      ],
    })
    expect(s.presets[0].nameLabel.fit).toBe(DEFAULT_NAME_LABEL.fit)
    expect(s.presets[1].nameLabel.fit).toBe('stretch')
  })

  it('nameLabel が無い旧プリセットは既定（表示OFF）で補完する', () => {
    const s = normalizeState({ users: [], presets: [{ id: 'p1' }] })
    expect(s.presets[0].nameLabel).toEqual(DEFAULT_NAME_LABEL)
    expect(s.presets[0].nameLabel.show).toBe(false)
  })

  it('部分 nameLabel を既定で補完し、不正な align は既定に倒す', () => {
    const s = normalizeState({
      users: [],
      presets: [{ id: 'p1', nameLabel: { show: true, fontSize: 64, align: 'middle' } }],
    })
    const n = s.presets[0].nameLabel
    expect(n.show).toBe(true)
    expect(n.fontSize).toBe(64)
    expect(n.align).toBe(DEFAULT_NAME_LABEL.align)
    expect(n.outlineColor).toBe(DEFAULT_NAME_LABEL.outlineColor)
    expect(n.offsetY).toBe(DEFAULT_NAME_LABEL.offsetY)
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

  it('selection の有効参照は保持、dangling は null に落とす', () => {
    const base = {
      users: [{ id: '1', name: 'a' }],
      presets: [{ id: 'p1', name: 'A' }],
    }
    expect(
      normalizeState({ ...base, selection: { userId: '1', presetId: 'p1' } }).selection,
    ).toEqual({ userId: '1', presetId: 'p1' })
    expect(
      normalizeState({ ...base, selection: { userId: '9', presetId: 'p1' } }).selection,
    ).toEqual({ userId: null, presetId: 'p1' })
    expect(
      normalizeState({ ...base, selection: { userId: '1', presetId: 'pX' } }).selection,
    ).toEqual({ userId: '1', presetId: null })
    expect(normalizeState(base).selection).toEqual({ userId: null, presetId: null })
  })
})

describe('cssFilename', () => {
  it('表示名から安全なファイル名を作る', () => {
    expect(cssFilename('ユーザーA')).toBe('streamkit-ユーザーA.css')
    expect(cssFilename('a/b c')).toBe('streamkit-a_b_c.css')
    expect(cssFilename('   ')).toBe('streamkit-streamkit.css')
  })
})
