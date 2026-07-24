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
    expect(screen.getByText(/まだ登録がありません/)).toBeInTheDocument()
  })

  it('ユーザーを追加すると一覧と出力CSSに反映される', async () => {
    render(<App />)
    fireEvent.change(screen.getByLabelText('Discord ユーザーID'), {
      target: { value: '649228696229511179' },
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
      await within(listPanel as HTMLElement).findByText('649228696229511179'),
    ).toBeInTheDocument()
    // 出力CSSに body::after（常時表示・既定）が出る
    const out = screen.getByRole('heading', { name: '出力 CSS' }).closest('.panel')!
    const textarea = within(out as HTMLElement).getByRole<HTMLTextAreaElement>('textbox')
    expect(textarea.value).toContain('body::after')
    expect(textarea.value).toContain('--img-stand-url-649228696229511179')
  })
})
