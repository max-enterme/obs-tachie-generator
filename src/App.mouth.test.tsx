import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react'
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
  it('口開き絵を外すと設定メッセージが消える', async () => {
    render(<App />)
    await addPresetWithImage('data:image/png;base64,AAAA')
    fireEvent.change(screen.getByLabelText('口開き絵のURL'), { target: { value: 'data:image/png;base64,BBBB' } })
    fireEvent.click(screen.getByRole('button', { name: '口開き絵のURLを反映' }))
    expect(await screen.findByText(/口開き絵を設定しました/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '口開き絵を外す' }))
    expect(screen.queryByText(/口開き絵を設定しました/)).not.toBeInTheDocument()
  })

  it('確定した説明文と注意、周期の補足を表示する', async () => {
    render(<App />)
    await addPresetWithImage('data:image/png;base64,AAAA')
    expect(screen.getByText('口パク（任意）')).toBeInTheDocument()
    expect(screen.getByText('話している間だけ、立ち絵と『口開き』の絵を交互に切り替えます。声の大きさには連動しません。')).toBeInTheDocument()
    expect(screen.getByText('立ち絵と同じ縦横比・同じ構図で用意してください（立ち絵だけを切り抜くとズレます）')).toBeInTheDocument()
    expect(screen.getByText(/「動きの速さ・周期」に合わせて開閉します（いまは 375ms で/)).toBeInTheDocument()
    expect(screen.getByLabelText('口パクの回数（動き1回あたり）')).toBeDisabled()
  })

  it('C1-5 回数を変えると補足の ms が変わる', async () => {
    render(<App />)
    await addPresetWithImage('data:image/png;base64,AAAA')
    fireEvent.change(screen.getByLabelText('口開き絵のURL'), { target: { value: 'data:image/png;base64,BBBB' } })
    fireEvent.click(screen.getByRole('button', { name: '口開き絵のURLを反映' }))
    await screen.findByText(/口開き絵を設定しました/)
    fireEvent.change(screen.getByLabelText('口パクの回数（動き1回あたり）'), { target: { value: '3' } })
    expect(screen.getByText(/いまは 250ms/)).toBeInTheDocument()
  })

  it('M22 縦横比が違うと警告し、同じなら出さない', async () => {
    render(<App />)
    await addPresetWithImage('data:image/png;base64,AAAA')
    fireEvent.change(screen.getByLabelText('口開き絵のURL'), { target: { value: 'data:image/png;base64,BBBB' } })
    fireEvent.click(screen.getByRole('button', { name: '口開き絵のURLを反映' }))
    expect(await screen.findByText(/口開き絵の縦横比が立ち絵と違います（立ち絵 600×900 \/ 口開き 600×600）/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('口開き絵のURL'), { target: { value: 'data:image/png;base64,AAAA' } })
    fireEvent.click(screen.getByRole('button', { name: '口開き絵のURLを反映' }))
    const warning = screen.getByRole('alert')
    await waitForElementToBeRemoved(warning)
    expect(await screen.findByText(/口開き絵を設定しました/)).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText(/口開き絵の縦横比が立ち絵と違います/)).toBeNull())
  })
})
