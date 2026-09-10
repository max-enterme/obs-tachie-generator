import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ANCHOR_X,
  DEFAULT_ANCHOR_Y,
  DEFAULT_OPTIONS,
  makeDefaultPreset,
  presetToOptions,
  resetPresetOptions,
  resolveAnchorX,
  resolveAnchorY,
  resolveAnchors,
  type AnchorX,
  type AnchorY,
  type Preset,
} from './types'

const ANCHOR_XS: AnchorX[] = ['left', 'center', 'right']
const ANCHOR_YS: AnchorY[] = ['top', 'middle', 'bottom']

describe('アンカーの解決', () => {
  it('既定は左下（003 以前の出力と同じ位置）', () => {
    expect(DEFAULT_ANCHOR_X).toBe('left')
    expect(DEFAULT_ANCHOR_Y).toBe('bottom')
  })

  it('アンカーからの距離の既定は 0（＝アンカーにぴったり付ける。位置合わせは OBS 側でやる）', () => {
    expect(DEFAULT_OPTIONS.left).toBe(0)
    expect(DEFAULT_OPTIONS.bottom).toBe(0)
  })

  it('未指定（undefined）は既定へ倒れる', () => {
    expect(resolveAnchorX(undefined)).toBe('left')
    expect(resolveAnchorY(undefined)).toBe('bottom')
    expect(resolveAnchorX()).toBe('left')
    expect(resolveAnchorY()).toBe('bottom')
    expect(resolveAnchors({})).toEqual({ x: 'left', y: 'bottom' })
  })

  it('指定された値はそのまま通す', () => {
    for (const x of ANCHOR_XS) expect(resolveAnchorX(x)).toBe(x)
    for (const y of ANCHOR_YS) expect(resolveAnchorY(y)).toBe(y)
  })

  it('9通りの組み合わせを resolveAnchors がそのまま返す', () => {
    for (const x of ANCHOR_XS) {
      for (const y of ANCHOR_YS) {
        expect(resolveAnchors({ anchorX: x, anchorY: y })).toEqual({ x, y })
      }
    }
  })

  it('片方だけ指定されたら、他方だけ既定に倒れる', () => {
    expect(resolveAnchors({ anchorX: 'right' })).toEqual({ x: 'right', y: 'bottom' })
    expect(resolveAnchors({ anchorY: 'middle' })).toEqual({ x: 'left', y: 'middle' })
  })
})

describe('presetToOptions', () => {
  const base: Preset = makeDefaultPreset('p1')

  it('アンカーを GenerateOptions へ受け渡す', () => {
    const o = presetToOptions({ ...base, anchorX: 'right', anchorY: 'top' })
    expect(o.anchorX).toBe('right')
    expect(o.anchorY).toBe('top')
  })

  it('アンカー未指定のプリセットは未指定のまま渡り、解決すると左下', () => {
    const legacy = { ...base }
    delete legacy.anchorX
    delete legacy.anchorY
    const o = presetToOptions(legacy)
    expect(o.anchorX).toBeUndefined()
    expect(o.anchorY).toBeUndefined()
    expect(resolveAnchors(o)).toEqual({ x: 'left', y: 'bottom' })
  })
})

describe('既定プリセット', () => {
  it('makeDefaultPreset のアンカーは既定（左下）', () => {
    const p = makeDefaultPreset('p1')
    expect(p.anchorX).toBe(DEFAULT_ANCHOR_X)
    expect(p.anchorY).toBe(DEFAULT_ANCHOR_Y)
    expect(p.left).toBe(DEFAULT_OPTIONS.left)
    expect(p.bottom).toBe(DEFAULT_OPTIONS.bottom)
  })

  it('resetPresetOptions はアンカーも既定に戻す（名前・画像は保持）', () => {
    const edited: Preset = {
      ...makeDefaultPreset('p1'),
      name: 'プリセットA',
      imageUrl: 'data:image/png;base64,AAAA',
      anchorX: 'center',
      anchorY: 'middle',
      left: 999,
      bottom: 999,
    }
    const reset = resetPresetOptions(edited)
    expect(reset.anchorX).toBe(DEFAULT_ANCHOR_X)
    expect(reset.anchorY).toBe(DEFAULT_ANCHOR_Y)
    expect(reset.left).toBe(DEFAULT_OPTIONS.left)
    expect(reset.bottom).toBe(DEFAULT_OPTIONS.bottom)
    expect(reset.name).toBe('プリセットA')
    expect(reset.imageUrl).toBe('data:image/png;base64,AAAA')
  })
})
