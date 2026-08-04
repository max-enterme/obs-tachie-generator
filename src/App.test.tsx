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

  it('「画面に出す名前」＋プリセットの名前表示ONで、出力CSSに body::before が出る', async () => {
    render(<App />)

    // ① ユーザー（メモ名とは別の「画面に出す名前」を入れる）
    fireEvent.change(screen.getByLabelText('Discord ユーザーID'), {
      target: { value: '123456789012345678' },
    })
    fireEvent.change(screen.getByLabelText(/表示名/), { target: { value: 'ユーザーA' } })
    fireEvent.change(screen.getByLabelText('画面に出す名前（任意）'), {
      target: { value: '画面名A' },
    })
    fireEvent.click(screen.getByRole('button', { name: '追加' }))

    // ② プリセット＋画像 → 名前表示ON
    await addPresetWithImage('data:image/png;base64,AAAA')
    fireEvent.click(screen.getByLabelText(/名前を表示する/))
    fireEvent.change(screen.getByLabelText(/文字サイズ/), { target: { value: '48' } })

    // ③ 出力に反映される
    fireEvent.click(screen.getByRole('button', { name: /次へ/ }))
    const out = screen.getByRole('heading', { name: /出力 CSS/ }).closest('.panel')!
    const textarea = within(out as HTMLElement).getByRole<HTMLTextAreaElement>('textbox')
    expect(textarea.value).toContain('body::before {')
    expect(textarea.value).toContain('content: "画面名A";')
    expect(textarea.value).toContain('font-size: 48px;')
  })

  it('登録済みユーザーの「画面に出す名前」を一覧で後から変えられる', async () => {
    render(<App />)

    fireEvent.change(screen.getByLabelText('Discord ユーザーID'), {
      target: { value: '123456789012345678' },
    })
    fireEvent.change(screen.getByLabelText(/表示名/), { target: { value: 'ユーザーA' } })
    fireEvent.click(screen.getByRole('button', { name: '追加' }))

    const edit = await screen.findByLabelText('画面に出す名前')
    fireEvent.change(edit, { target: { value: '画面名B' } })

    await addPresetWithImage('data:image/png;base64,AAAA')
    fireEvent.click(screen.getByLabelText(/名前を表示する/))
    fireEvent.click(screen.getByRole('button', { name: /次へ/ }))

    const out = screen.getByRole('heading', { name: /出力 CSS/ }).closest('.panel')!
    const textarea = within(out as HTMLElement).getByRole<HTMLTextAreaElement>('textbox')
    expect(textarea.value).toContain('content: "画面名B";')
  })

  it('名前が空なら、③のプレビューに仮名を出さず「出力に入らない」と警告する', async () => {
    render(<App />)

    // ① ID だけ登録（表示名も画面に出す名前も空）
    fireEvent.change(screen.getByLabelText('Discord ユーザーID'), {
      target: { value: '123456789012345678' },
    })
    fireEvent.click(screen.getByRole('button', { name: '追加' }))

    // ② 名前表示ON（このステップでは仮名で見え方を確認できる）
    await addPresetWithImage('data:image/png;base64,AAAA')
    fireEvent.click(screen.getByLabelText(/名前を表示する/))
    expect(screen.getByText('名前')).toBeInTheDocument()

    // ③ 出力に名前は入らない。プレビューにも仮名を出さず、理由を出す
    fireEvent.click(screen.getByRole('button', { name: /次へ/ }))
    const out = screen.getByRole('heading', { name: /出力 CSS/ }).closest('.panel')!
    const textarea = within(out as HTMLElement).getByRole<HTMLTextAreaElement>('textbox')
    expect(textarea.value).not.toContain('body::before')
    expect(screen.getByText(/「画面に出す名前」が空のため/)).toBeInTheDocument()
    expect(screen.queryByText('名前')).not.toBeInTheDocument()
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
