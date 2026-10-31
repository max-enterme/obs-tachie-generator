import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TachiePreview from './TachiePreview'
import { makeDefaultPreset } from '../lib/types'

describe('TachiePreview 口パク', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })
  it('M17 発話中だけ周期の半分ごとに絵が入れ替わる', () => {
    vi.useFakeTimers()
    const { container } = render(<TachiePreview preset={{ ...makeDefaultPreset('p1'), imageUrl: 'data:A', mouthImageUrl: 'data:B', mouthIntervalMs: 300 }} />)
    const img = () => container.querySelector('img.tp-img')!
    expect(img().getAttribute('src')).toBe('data:A')
    fireEvent.click(screen.getByRole('button', { name: /^立ち絵プレビュー。クリックで発話⇄静かを切替。現在: 通話中・静か$/ }))
    expect(img().getAttribute('src')).toBe('data:A')
    act(() => vi.advanceTimersByTime(150)); expect(img().getAttribute('src')).toBe('data:B')
    act(() => vi.advanceTimersByTime(150)); expect(img().getAttribute('src')).toBe('data:A')
    fireEvent.click(screen.getByRole('button', { name: /^立ち絵プレビュー。クリックで発話⇄静かを切替。現在: 通話中・発話中$/ }))
    act(() => vi.advanceTimersByTime(300)); expect(img().getAttribute('src')).toBe('data:A')
    vi.useRealTimers()
  })
  it('M18 口開き絵が無ければ入れ替わらない', () => {
    vi.useFakeTimers()
    const { container } = render(<TachiePreview preset={{ ...makeDefaultPreset('p1'), imageUrl: 'data:A' }} />)
    fireEvent.click(screen.getByRole('button', { name: /^立ち絵プレビュー。クリックで発話⇄静かを切替。現在: 通話中・静か$/ }))
    act(() => vi.advanceTimersByTime(600))
    expect(container.querySelector('img.tp-img')?.getAttribute('src')).toBe('data:A')
    vi.useRealTimers()
  })
  it('M18b 周期は resolveMouthIntervalMs を通した値の半分', () => {
    vi.useFakeTimers()
    const { container } = render(<TachiePreview preset={{ ...makeDefaultPreset('p1'), imageUrl: 'data:A', mouthImageUrl: 'data:B', mouthIntervalMs: 10 }} />)
    fireEvent.click(screen.getByRole('button', { name: /^立ち絵プレビュー。クリックで発話⇄静かを切替。現在: 通話中・静か$/ }))
    act(() => vi.advanceTimersByTime(24)); expect(container.querySelector('img.tp-img')?.getAttribute('src')).toBe('data:A')
    act(() => vi.advanceTimersByTime(1)); expect(container.querySelector('img.tp-img')?.getAttribute('src')).toBe('data:B')
    vi.useRealTimers()
  })
  it('M18c 発話中にプリセットが変わっても src が空にならない', () => {
    vi.useFakeTimers()
    const { container, rerender } = render(<TachiePreview preset={{ ...makeDefaultPreset('p1'), imageUrl: 'data:A', mouthImageUrl: 'data:B', mouthIntervalMs: 300 }} />)
    fireEvent.click(screen.getByRole('button', { name: /^立ち絵プレビュー。クリックで発話⇄静かを切替。現在: 通話中・静か$/ }))
    act(() => vi.advanceTimersByTime(150))
    rerender(<TachiePreview preset={{ ...makeDefaultPreset('p2'), imageUrl: 'data:C' }} />)
    expect(container.querySelector('img.tp-img')?.getAttribute('src')).toBe('data:C')
    vi.useRealTimers()
  })
})

