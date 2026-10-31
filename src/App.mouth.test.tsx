import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import App from './App'

vi.mock('./lib/image', async (orig) => ({
  ...(await orig<typeof import('./lib/image')>()),
  measureNaturalSize: async (u: string) =>
    u.endsWith('AAAA') ? { width: 600, height: 900 } : { width: 600, height: 600 },
}))

beforeEach(() => localStorage.clear())
afterEach(() => { cleanup(); localStorage.clear() })

async function addPresetWithImage(dataUri: string) {
  fireEvent.click(screen.getByRole('button', { name: /次へ/ }))
  fireEvent.click(screen.getByRole('button', { name: /新規プリセット/ }))
  fireEvent.click(screen.getByRole('button', { name: '画像URL' }))
  fireEvent.change(screen.getByLabelText(/画像URL/), { target: { value: dataUri } })
  fireEvent.click(screen.getByRole('button', { name: /画像URLを反映/ }))
  expect(await screen.findByText(/画像を設定しました/)).toBeInTheDocument()
}

describe('口パクの縦横比警告', () => {
  it('M22 縦横比が違うと警告し、同じなら出さない', async () => {
    render(<App />)
    await addPresetWithImage('data:image/png;base64,AAAA')
    fireEvent.change(screen.getByLabelText('口開き絵のURL'), { target: { value: 'data:image/png;base64,BBBB' } })
    fireEvent.click(screen.getByRole('button', { name: '口開き絵のURLを反映' }))
    expect(await screen.findByText(/口開き絵の縦横比が立ち絵と違います（立ち絵 600×900 \/ 口開き 600×600）/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('口開き絵のURL'), { target: { value: 'data:image/png;base64,AAAA' } })
    fireEvent.click(screen.getByRole('button', { name: '口開き絵のURLを反映' }))
    expect(await screen.findByText(/口開き絵を設定しました/)).toBeInTheDocument()
    expect(screen.queryByText(/口開き絵の縦横比が立ち絵と違います/)).toBeNull()
  })
})
