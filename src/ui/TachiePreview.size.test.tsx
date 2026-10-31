import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useLayoutEffect } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TachiePreview from './TachiePreview'
import { DEFAULT_SPEAK, makeDefaultPreset, type Preset } from '../lib/types'

/**
 * 画像の読み込み完了（load）を、React が描画を確定した直後・effect が走る前に起こす。
 * 重い画面（大きい画像の data URI など）では実ブラウザでもこの順になり、
 * 画像を登録した直後のプレビュー幅が仮幅のまま戻らなかった（再読み込みで直る）。
 * 親の layout effect は子の描画確定後・passive effect（useEffect）より前に走るので、ここで発火させる。
 */
function LoadBeforeEffects({ preset, naturalWidth }: { preset: Preset; naturalWidth: number }) {
  useLayoutEffect(() => {
    const img = document.querySelector<HTMLImageElement>('img.tp-img')
    if (!img) return
    Object.defineProperty(img, 'naturalWidth', { configurable: true, value: naturalWidth })
    img.dispatchEvent(new Event('load'))
  }, [preset.imageUrl, naturalWidth])
  return <TachiePreview preset={preset} />
}

function imgWidth(container: HTMLElement): string | undefined {
  return container.querySelector<HTMLImageElement>('img.tp-img')?.style.width
}

describe('TachiePreview 原寸幅（画像の実サイズ）', () => {
  afterEach(cleanup)

  it('画像を登録した直後に load が effect より先に来ても、実サイズの幅で描く', () => {
    const base = { ...makeDefaultPreset('p1'), width: undefined }
    // 1920 より大きい画像（プレビューの枠からはみ出す大きさ）を登録した直後。
    const { container } = render(
      <LoadBeforeEffects preset={{ ...base, imageUrl: 'data:big' }} naturalWidth={2400} />,
    )
    expect(imgWidth(container)).toBe('125%')
  })

  it('画像を差し替えた直後も、新しい画像の実サイズの幅で描く', () => {
    const base = { ...makeDefaultPreset('p1'), width: undefined }
    const { container, rerender } = render(
      <LoadBeforeEffects preset={{ ...base, imageUrl: 'data:small' }} naturalWidth={960} />,
    )
    expect(imgWidth(container)).toBe('50%')
    rerender(<LoadBeforeEffects preset={{ ...base, imageUrl: 'data:big' }} naturalWidth={3840} />)
    expect(imgWidth(container)).toBe('200%')
  })

  it('別の画像に変わってまだ読めていない間は、前の画像の実サイズを使わない（仮幅）', () => {
    const base = { ...makeDefaultPreset('p1'), width: undefined }
    const { container, rerender } = render(
      <LoadBeforeEffects preset={{ ...base, imageUrl: 'data:small' }} naturalWidth={960} />,
    )
    expect(imgWidth(container)).toBe('50%')
    // load を起こさない素の TachiePreview に差し替え＝新しい画像はまだ読み込み中。
    rerender(<TachiePreview preset={{ ...base, imageUrl: 'data:other' }} />)
    expect(imgWidth(container)).toBe('20%')
  })

  it('口パクで口開き絵が読み込まれても、立ち絵の実サイズの幅のまま', () => {
    vi.useFakeTimers()
    try {
      const preset: Preset = {
        ...makeDefaultPreset('p1'),
        width: undefined,
        imageUrl: 'data:stand',
        mouthImageUrl: 'data:mouth',
        speak: { ...DEFAULT_SPEAK, durationMs: 600 },
        mouthPerMove: 2,
      }
      const { container } = render(<TachiePreview preset={preset} />)
      const img = () => container.querySelector<HTMLImageElement>('img.tp-img')!
      Object.defineProperty(img(), 'naturalWidth', { configurable: true, value: 960 })
      fireEvent.load(img())
      expect(imgWidth(container)).toBe('50%')
      // 発話にして口開き絵へ切り替わったところで、口開き絵の load（別の実サイズ）が来る。
      fireEvent.click(screen.getByRole('button', { name: /現在: 通話中・静か$/ }))
      act(() => vi.advanceTimersByTime(150))
      expect(img().getAttribute('src')).toBe('data:mouth')
      Object.defineProperty(img(), 'naturalWidth', { configurable: true, value: 300 })
      fireEvent.load(img())
      expect(imgWidth(container)).toBe('50%')
    } finally {
      vi.useRealTimers()
    }
  })
})
