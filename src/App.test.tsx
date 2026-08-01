import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import App from './App'

beforeEach(() => localStorage.clear())
afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('App', () => {
  it('初期表示：見出しと空メッセージ', () => {
    render(<App />)
    expect(
      screen.getByRole('heading', { name: 'OBS 立ち絵ジェネレーター' }),
    ).toBeInTheDocument()
    // ステップ①（ユーザー登録）が既定表示。登録が無い旨のメッセージが出る。
    expect(screen.getByText(/まだ登録がありません/)).toBeInTheDocument()
  })

  it('ユーザー追加 → プリセット追加 → ペア作成で出力CSSに反映される', async () => {
    render(<App />)

    // --- ステップ①：ユーザー（誰）を追加 ---
    fireEvent.change(screen.getByLabelText('Discord ユーザーID'), {
      target: { value: '649228696229511179' },
    })
    fireEvent.click(screen.getByRole('button', { name: '追加' }))
    const listPanel = screen
      .getByRole('heading', { name: /登録ユーザー/ })
      .closest('.panel')!
    expect(
      await within(listPanel as HTMLElement).findByText('649228696229511179'),
    ).toBeInTheDocument()

    // --- ステップ②：プリセット（見た目）を追加して画像を設定 ---
    fireEvent.click(screen.getByRole('button', { name: /次へ/ }))
    fireEvent.click(screen.getByRole('button', { name: /新規プリセット/ }))
    fireEvent.change(screen.getByLabelText(/画像URL/), {
      target: { value: 'data:image/png;base64,AAAA' },
    })
    fireEvent.click(screen.getByRole('button', { name: /画像URLを反映/ }))
    expect(await screen.findByText(/画像を設定しました/)).toBeInTheDocument()

    // --- ステップ③：ユーザー × プリセットのペアを作る ---
    fireEvent.click(screen.getByRole('button', { name: /次へ/ }))
    fireEvent.click(screen.getByRole('button', { name: 'ペアを追加' }))
    // ペア行が出る（ユーザー差し替え用セレクト）
    expect(await screen.findByLabelText('ペア1のユーザー')).toBeInTheDocument()

    // --- ステップ④：出力CSSにそのユーザーIDの body::after ＋ 埋め込み変数が出る ---
    fireEvent.click(screen.getByRole('button', { name: /次へ/ }))
    const out = screen.getByRole('heading', { name: /出力 CSS/ }).closest('.panel')!
    const textarea = within(out as HTMLElement).getByRole<HTMLTextAreaElement>('textbox')
    expect(textarea.value).toContain('body::after')
    expect(textarea.value).toContain('--img-stand-url-649228696229511179')
  })

  it('ペアのユーザーIDを差し替えると、出力のIDだけ変わり画像（プリセット）は据え置き', async () => {
    render(<App />)

    // --- ①：2人登録（A / B）---
    const idInput = () => screen.getByLabelText('Discord ユーザーID')
    const addBtn = () => screen.getByRole('button', { name: '追加' })
    fireEvent.change(idInput(), { target: { value: '111111111111111111' } })
    fireEvent.click(addBtn())
    fireEvent.change(idInput(), { target: { value: '222222222222222222' } })
    fireEvent.click(addBtn())

    // --- ②：プリセット＋画像 ---
    fireEvent.click(screen.getByRole('button', { name: /次へ/ }))
    fireEvent.click(screen.getByRole('button', { name: /新規プリセット/ }))
    fireEvent.change(screen.getByLabelText(/画像URL/), {
      target: { value: 'data:image/png;base64,ZZZZ' },
    })
    fireEvent.click(screen.getByRole('button', { name: /画像URLを反映/ }))
    expect(await screen.findByText(/画像を設定しました/)).toBeInTheDocument()

    // --- ③：ペアを作り、ユーザーを B に差し替える ---
    fireEvent.click(screen.getByRole('button', { name: /次へ/ }))
    fireEvent.click(screen.getByRole('button', { name: 'ペアを追加' }))
    const pairUserSelect = (await screen.findByLabelText(
      'ペア1のユーザー',
    )) as HTMLSelectElement
    fireEvent.change(pairUserSelect, { target: { value: '222222222222222222' } })

    // --- ④：出力は B のID・画像は据え置き（プリセット由来）---
    fireEvent.click(screen.getByRole('button', { name: /次へ/ }))
    const out = screen.getByRole('heading', { name: /出力 CSS/ }).closest('.panel')!
    const textarea = within(out as HTMLElement).getByRole<HTMLTextAreaElement>('textbox')
    expect(textarea.value).toContain('--img-stand-url-222222222222222222')
    expect(textarea.value).not.toContain('--img-stand-url-111111111111111111')
    expect(textarea.value).toContain('data:image/png;base64,ZZZZ')
  })
})
