import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useImageNaturalSizes } from './useImageNaturalSize'

vi.mock('../lib/image', () => ({
  measureNaturalSize: vi.fn(async (url: string) => ({ width: url.length, height: 1 })),
}))

import { measureNaturalSize } from '../lib/image'

describe('useImageNaturalSizes', () => {
  it('U1 URL ごとに測り、空は測らない', async () => {
    const { result } = renderHook(() => useImageNaturalSizes(['data:a', '', 'data:bb', 'data:a']))
    await waitFor(() => expect(result.current).toEqual({
      'data:a': { width: 6, height: 1 },
      'data:bb': { width: 7, height: 1 },
    }))
    await act(async () => {})
    expect(measureNaturalSize).toHaveBeenCalledTimes(2)
  })
})
