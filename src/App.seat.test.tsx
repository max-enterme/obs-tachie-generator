import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import App from './App'

vi.mock('./lib/image', async (orig) => ({
  ...(await orig<typeof import('./lib/image')>()),
  measureNaturalSize: async () => ({ width: 600, height: 900 }),
}))

beforeEach(() => localStorage.clear())
afterEach(() => {
  cleanup()
  localStorage.clear()
})

const ids = ['111111111111111111', '222222222222222222']
function addUser(id: string, name: string) {
  fireEvent.change(screen.getByLabelText('Discord ユーザーID'), { target: { value: id } })
  fireEvent.change(screen.getByLabelText('表示名（任意・メモ用）'), { target: { value: name } })
  fireEvent.click(screen.getByRole('button', { name: '追加' }))
}
async function addPresetWithImage() {
  fireEvent.click(screen.getByRole('button', { name: /次へ/ }))
  fireEvent.click(screen.getByRole('button', { name: /新規プリセット/ }))
  fireEvent.click(screen.getByRole('button', { name: '画像URL' }))
  fireEvent.change(screen.getByLabelText(/画像URL/), { target: { value: 'data:image/png;base64,AAAA' } })
  fireEvent.click(screen.getByRole('button', { name: /画像URLを反映/ }))
  await screen.findByText(/画像を設定しました/)
}
function goToSeats() {
  fireEvent.click(screen.getByRole('button', { name: /次へ/ }))
  fireEvent.click(screen.getByRole('button', { name: /次へ/ }))
  fireEvent.click(screen.getByRole('button', { name: /次へ/ }))
}
async function setupSeat() {
  render(<App />)
  addUser(ids[0], 'ゲストA')
  addUser(ids[1], 'ゲストB')
  await addPresetWithImage()
  goToSeats()
  fireEvent.click(screen.getByRole('button', { name: '新しい席' }))
  fireEvent.change(screen.getByLabelText('席の名前'), { target: { value: 'ゲスト席' } })
  fireEvent.change(screen.getByLabelText('追加するユーザー'), { target: { value: ids[0] } })
  fireEvent.click(screen.getByRole('button', { name: '候補に追加' }))
  fireEvent.change(screen.getByLabelText('追加するユーザー'), { target: { value: ids[1] } })
  fireEvent.click(screen.getByRole('button', { name: '候補に追加' }))
}
function output(): string {
  const panel = screen.getByRole('heading', { name: /出力 CSS/ }).closest('.panel')!
  return within(panel as HTMLElement).getByRole<HTMLTextAreaElement>('textbox').value
}

describe('App ④ 席', () => {
  it('AS1 ④ に席の画面がある', () => {
    render(<App />)
    goToSeats()
    expect(screen.getByRole('heading', { name: '席（入れ替わり）' })).toBeInTheDocument()
    expect(screen.getByText('席はまだありません。「新しい席」で作ります。')).toBeInTheDocument()
    expect(screen.getByText('候補を追加すると、ここに CSS が出ます。')).toBeInTheDocument()
  })
  it('AS2 席を作って候補 2 人を並べると両方の条件が出る', async () => {
    await setupSeat()
    expect(output()).toMatch(/^\/\* 席「ゲスト席」: 候補 2 人。/)
    expect(output()).toContain('body:has(img[src*="avatars/222222222222222222"]):not(:has(img[src*="avatars/111111111111111111"]))::after')
    expect(screen.getByRole('button', { name: '席「ゲスト席」を選ぶ' })).toHaveTextContent('ゲスト席（候補 2 人）')
  })
  it('AS3 下へで優先が入れ替わる', async () => {
    await setupSeat()
    fireEvent.click(screen.getByRole('button', { name: '候補1を下へ' }))
    expect(output()).toContain('body:has(img[src*="avatars/111111111111111111"]):not(:has(img[src*="avatars/222222222222222222"]))::after')
    expect(screen.getByRole('button', { name: '候補1を上へ' })).toBeDisabled()
  })
  it('AS4 同じユーザーは 2 回目を追加できない', async () => {
    render(<App />)
    addUser(ids[0], 'ゲストA')
    await addPresetWithImage()
    goToSeats()
    fireEvent.click(screen.getByRole('button', { name: '新しい席' }))
    fireEvent.click(screen.getByRole('button', { name: '候補に追加' }))
    expect(screen.getByRole('button', { name: '候補に追加' })).toBeDisabled()
    expect(screen.getByText('このユーザーはもう候補にいます（1 人 1 回まで）')).toBeInTheDocument()
  })
  it('AS5 ① でユーザーを消すと候補から消える', async () => {
    await setupSeat()
    fireEvent.click(screen.getByRole('button', { name: /ユーザー Discord ID/ }))
    const usersPanel = screen.getByRole('heading', { name: /登録ユーザー/ }).closest('.panel')!
    fireEvent.click(within(usersPanel as HTMLElement).getAllByRole('button', { name: '削除' })[0])
    goToSeats()
    expect(screen.getByRole('button', { name: '候補1を外す' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '候補2を外す' })).toBeNull()
    expect(output()).not.toContain(ids[0])
  })
  it('AS6 再描画しても席が残る', async () => {
    await setupSeat()
    cleanup()
    render(<App />)
    goToSeats()
    expect(screen.getByRole('button', { name: '席「ゲスト席」を選ぶ' })).toBeInTheDocument()
    expect(output()).toContain(ids[0])
    expect(output()).toContain(ids[1])
  })
  it('AS7 席を消すと出力が空に戻る', async () => {
    await setupSeat()
    fireEvent.click(screen.getByRole('button', { name: '席「ゲスト席」を削除' }))
    expect(screen.getByText('席はまだありません。「新しい席」で作ります。')).toBeInTheDocument()
    expect(screen.getByText('候補を追加すると、ここに CSS が出ます。')).toBeInTheDocument()
  })
  it('AS9 席の位置が出力とプレビューに効く', async () => {
    await setupSeat()
    fireEvent.click(screen.getByRole('radio', { name: '右下' }))
    fireEvent.change(screen.getByLabelText('右端からの距離(px)'), { target: { value: '20' } })
    expect(output()).toContain('right: 20px;')
    expect(output()).not.toContain('left: 0px;')
    const img = document.querySelector<HTMLImageElement>('.tp-img')!
    expect(img.style.right).not.toBe('')
    expect(img.style.left).toBe('')
  })
  it('AS10 候補を押すとプレビューの人が変わる', async () => {
    await setupSeat()
    expect(screen.getByRole('heading', { name: 'プレビュー（ゲストA）' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '候補2をプレビューで見る' }))
    expect(screen.getByRole('heading', { name: 'プレビュー（ゲストB）' })).toBeInTheDocument()
  })
  it('AS11 外すと出力から消える', async () => {
    await setupSeat()
    fireEvent.click(screen.getByRole('button', { name: '候補2を外す' }))
    expect(output()).not.toContain(ids[1])
    expect(screen.getByRole('button', { name: '席「ゲスト席」を選ぶ' })).toHaveTextContent('ゲスト席（候補 1 人）')
  })
  it('AS12 上へで優先が戻る', async () => {
    await setupSeat()
    fireEvent.click(screen.getByRole('button', { name: '候補1を下へ' }))
    fireEvent.click(screen.getByRole('button', { name: '候補2を上へ' }))
    expect(output()).toContain('body:has(img[src*="avatars/222222222222222222"]):not(:has(img[src*="avatars/111111111111111111"]))::after')
  })
  it('AS13 ② でプリセットを消すと候補から消える', async () => {
    await setupSeat()
    fireEvent.click(screen.getByRole('button', { name: /立ち絵・演出 プリセットを用意/ }))
    const presetsPanel = screen.getByRole('heading', { name: 'プリセット一覧' }).closest('.panel')!
    fireEvent.click(within(presetsPanel as HTMLElement).getAllByRole('button', { name: '削除' })[0])
    goToSeats()
    expect(screen.getByText('候補がいません。下から追加してください。')).toBeInTheDocument()
    expect(screen.getByText('候補を追加すると、ここに CSS が出ます。')).toBeInTheDocument()
  })
  it('AS14 画像の無い候補には注意が出る', () => {
    render(<App />)
    addUser(ids[0], 'ゲストA')
    fireEvent.click(screen.getByRole('button', { name: /次へ/ }))
    fireEvent.click(screen.getByRole('button', { name: /新規プリセット/ }))
    goToSeats()
    fireEvent.click(screen.getByRole('button', { name: '新しい席' }))
    fireEvent.click(screen.getByRole('button', { name: '候補に追加' }))
    expect(screen.getByRole('status')).toHaveTextContent('「ゲストA × (無名プリセット)」に立ち絵の画像がありません。')
  })
  it('AS15 席を選び直すとプレビューが先頭の候補に戻る', async () => {
    await setupSeat()
    fireEvent.click(screen.getByRole('button', { name: '候補2をプレビューで見る' }))
    fireEvent.click(screen.getByRole('button', { name: '新しい席' }))
    fireEvent.change(screen.getByLabelText('追加するユーザー'), { target: { value: ids[0] } })
    fireEvent.click(screen.getByRole('button', { name: '候補に追加' }))
    expect(screen.getByRole('heading', { name: 'プレビュー（ゲストA）' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '席「ゲスト席」を選ぶ' }))
    expect(screen.getByRole('heading', { name: 'プレビュー（ゲストA）' })).toBeInTheDocument()
  })

})
