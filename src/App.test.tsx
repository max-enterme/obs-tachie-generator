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

  it('ユーザーを追加すると一覧と出力CSSに反映される', async () => {
    render(<App />)
    // --- ステップ①：フォームからユーザーを追加 ---
    fireEvent.change(screen.getByLabelText('Discord ユーザーID'), {
      target: { value: '123456789012345678' },
    })
    fireEvent.change(screen.getByLabelText(/画像URL/), {
      target: { value: 'data:image/png;base64,AAAA' },
    })
    fireEvent.click(screen.getByRole('button', { name: '追加' }))

    // 一覧に出る（登録ユーザーパネル内で確認、追加は非同期なので findBy で待つ）
    const listPanel = screen
      .getByRole('heading', { name: /登録ユーザー/ })
      .closest('.panel')!
    expect(
      await within(listPanel as HTMLElement).findByText('123456789012345678'),
    ).toBeInTheDocument()

    // --- ステップ④（CSSを出力）へ移動して出力CSSを確認 ---
    fireEvent.click(screen.getByRole('button', { name: /CSSを出力/ }))

    // 既定は「個別（常時表示）」モード → body::after と埋め込み変数がその人のIDで出る
    const out = screen.getByRole('heading', { name: '出力 CSS' }).closest('.panel')!
    const textarea = within(out as HTMLElement).getByRole<HTMLTextAreaElement>('textbox')
    expect(textarea.value).toContain('body::after')
    expect(textarea.value).toContain('--img-stand-url-123456789012345678')
  })
})
