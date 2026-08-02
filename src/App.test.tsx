import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import App from './App'

beforeEach(() => localStorage.clear())
afterEach(() => {
  cleanup()
  localStorage.clear()
})

/** ②に入り、新規プリセットへ URL 画像を設定する共通手順。 */
async function addPresetWithImage(dataUri: string) {
  fireEvent.click(screen.getByRole('button', { name: /次へ/ })) // ① → ②
  fireEvent.click(screen.getByRole('button', { name: /新規プリセット/ }))
  fireEvent.click(screen.getByRole('button', { name: '画像URL' })) // 排他セグメントを URL に
  fireEvent.change(screen.getByLabelText(/画像URL/), { target: { value: dataUri } })
  fireEvent.click(screen.getByRole('button', { name: /画像URLを反映/ }))
  expect(await screen.findByText(/画像を設定しました/)).toBeInTheDocument()
}

describe('App', () => {
  it('初期表示：見出しと空メッセージ', () => {
    render(<App />)
    expect(
      screen.getByRole('heading', { name: 'OBS 立ち絵ジェネレーター' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/まだ登録がありません/)).toBeInTheDocument()
  })

  it('ユーザー追加 → プリセット＋画像 → ③選択で出力CSSに反映される', async () => {
    render(<App />)

    // ① ユーザー
    fireEvent.change(screen.getByLabelText('Discord ユーザーID'), {
      target: { value: '123456789012345678' },
    })
    fireEvent.click(screen.getByRole('button', { name: '追加' }))
    const listPanel = screen.getByRole('heading', { name: /登録ユーザー/ }).closest('.panel')!
    expect(
      await within(listPanel as HTMLElement).findByText('123456789012345678'),
    ).toBeInTheDocument()

    // ② プリセット＋画像
    await addPresetWithImage('data:image/png;base64,AAAA')

    // ③ 組み合わせ & 出力（作業中選択は先頭ユーザー×先頭プリセットに自動フォールバック）
    fireEvent.click(screen.getByRole('button', { name: /次へ/ }))
    const out = screen.getByRole('heading', { name: /出力 CSS/ }).closest('.panel')!
    const textarea = within(out as HTMLElement).getByRole<HTMLTextAreaElement>('textbox')
    expect(textarea.value).toContain('body::after')
    expect(textarea.value).toContain('--img-stand-url-123456789012345678')
  })

  it('ユーザーselectをBに変えると出力IDだけ変わり、画像（プリセット）は据え置き', async () => {
    render(<App />)

    // ① 2人（A / B）
    const idInput = () => screen.getByLabelText('Discord ユーザーID')
    const addBtn = () => screen.getByRole('button', { name: '追加' })
    fireEvent.change(idInput(), { target: { value: '111111111111111111' } })
    fireEvent.click(addBtn())
    fireEvent.change(idInput(), { target: { value: '222222222222222222' } })
    fireEvent.click(addBtn())

    // ② プリセット＋画像
    await addPresetWithImage('data:image/png;base64,ZZZZ')

    // ③ ユーザーを B に差し替え
    fireEvent.click(screen.getByRole('button', { name: /次へ/ }))
    const userSelect = screen.getByLabelText('ユーザー（ID）') as HTMLSelectElement
    fireEvent.change(userSelect, { target: { value: '222222222222222222' } })

    const out = screen.getByRole('heading', { name: /出力 CSS/ }).closest('.panel')!
    const textarea = within(out as HTMLElement).getByRole<HTMLTextAreaElement>('textbox')
    expect(textarea.value).toContain('--img-stand-url-222222222222222222')
    expect(textarea.value).not.toContain('--img-stand-url-111111111111111111')
    expect(textarea.value).toContain('data:image/png;base64,ZZZZ')
  })

  it('「保存」で作業中の組が保存リストに出る', async () => {
    render(<App />)

    fireEvent.change(screen.getByLabelText('Discord ユーザーID'), {
      target: { value: '123456789012345678' },
    })
    fireEvent.click(screen.getByRole('button', { name: '追加' }))
    await addPresetWithImage('data:image/png;base64,AAAA')

    fireEvent.click(screen.getByRole('button', { name: /次へ/ })) // ② → ③
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    expect(await screen.findByLabelText('保存ペア1を呼び戻す')).toBeInTheDocument()
  })
})
