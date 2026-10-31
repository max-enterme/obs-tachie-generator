import { expect, test, type Locator, type Page } from '@playwright/test'

/**
 * 「範囲を指定して切り抜き」のドラッグで、画像の四辺・四隅まで選べること。
 *
 * 編集画面の画像は縮小表示（600×900 → 高さ 260px、1 画面px ≒ 3.5 画像px）なので、
 * 端ぴったりを狙っても数 px ずれる。画像の外（点線の余白）から押し始められること・
 * 端の近くが端に吸い付くことで、端まで迷わず選べるのを実ブラウザで確かめる。
 */

const IMG_W = 600
const IMG_H = 900

/** 赤一色 600×900 の PNG を data URI で作る。 */
async function makeImageDataUrl(page: Page): Promise<string> {
  return page.evaluate(
    ([w, h]) => {
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('2d context を取得できない')
      ctx.fillStyle = '#ff0000'
      ctx.fillRect(0, 0, w, h)
      return canvas.toDataURL('image/png')
    },
    [IMG_W, IMG_H],
  )
}

/** プリセットに画像を入れて「範囲を指定して切り抜き」を開き、画像の表示位置を返す。 */
async function openRectCrop(page: Page): Promise<{ img: Locator }> {
  await page.goto('/')
  const dataUrl = await makeImageDataUrl(page)
  await page.getByLabel('Discord ユーザーID').fill('123456789012345678')
  await page.getByRole('button', { name: '追加' }).click()
  await page.getByRole('button', { name: /次へ/ }).click()
  await page.getByRole('button', { name: /新規プリセット/ }).click()
  await page.getByRole('button', { name: '画像URL', exact: true }).click()
  await page.locator('#pr-url').fill(dataUrl)
  await page.getByRole('button', { name: '画像URLを反映' }).click()
  await page.getByRole('button', { name: '範囲を指定して切り抜き' }).click()
  const img = page.locator('.crop-stage img')
  await expect(img).toBeVisible()
  await img.scrollIntoViewIfNeeded()
  // ページ内の他の画像（プレビュー等）の読み込みで位置がずれると、余白を狙った押下が外れる。
  // 全画像の読み込みと、画像の位置が落ち着くのを待ってから操作する。
  await page.waitForFunction(() => Array.from(document.images).every((i) => i.complete))
  await expect
    .poll(async () => {
      const before = await img.boundingBox()
      await page.waitForTimeout(100)
      const after = await img.boundingBox()
      return before && after && before.x === after.x && before.y === after.y
    })
    .toBe(true)
  return { img }
}

type Point = { x: number; y: number }

/** 画像の表示位置に対する相対座標（0〜1。範囲外は画像の外、`px` で画面px のずらし）。 */
async function at(img: Locator, fx: number, fy: number, px: Point = { x: 0, y: 0 }): Promise<Point> {
  const b = await img.boundingBox()
  if (!b) throw new Error('画像の表示位置が取れない')
  return { x: b.x + b.width * fx + px.x, y: b.y + b.height * fy + px.y }
}

async function drag(page: Page, from: Point, to: Point): Promise<void> {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 })
  await page.mouse.move(to.x, to.y, { steps: 4 })
  await page.mouse.up()
}

async function rectValues(page: Page): Promise<{ x: number; y: number; width: number; height: number }> {
  const read = async (key: string) => Number(await page.locator(`#pr-crop-${key}`).inputValue())
  return { x: await read('x'), y: await read('y'), width: await read('width'), height: await read('height') }
}

test.describe('範囲指定のドラッグで端まで選べる', () => {
  test('四隅を「少し内側」から反対の隅の少し内側へ → 吸着で画像全体', async ({ page }) => {
    const { img } = await openRectCrop(page)
    // 隅から 3 画面px 内側（吸着なしなら約 10 画像px ずれる）
    await drag(page, await at(img, 0, 0, { x: 3, y: 3 }), await at(img, 1, 1, { x: -3, y: -3 }))
    expect(await rectValues(page)).toEqual({ x: 0, y: 0, width: IMG_W, height: IMG_H })

    // 逆向き（右上 → 左下）でも同じ
    await drag(page, await at(img, 1, 0, { x: -3, y: 3 }), await at(img, 0, 1, { x: 3, y: -3 }))
    expect(await rectValues(page)).toEqual({ x: 0, y: 0, width: IMG_W, height: IMG_H })
  })

  for (const [name, fx, fy, expected] of [
    ['左上', 0, 0, { x: 0, y: 0, width: 300, height: 450 }],
    ['右上', 1, 0, { x: 300, y: 0, width: 300, height: 450 }],
    ['左下', 0, 1, { x: 0, y: 450, width: 300, height: 450 }],
    ['右下', 1, 1, { x: 300, y: 450, width: 300, height: 450 }],
  ] as const) {
    test(`${name}の隅の外（余白）から押し始めて中央へ → 隅から選べる`, async ({ page }) => {
      const { img } = await openRectCrop(page)
      const out = { x: fx === 0 ? -8 : 8, y: fy === 0 ? -8 : 8 }
      await drag(page, await at(img, fx, fy, out), await at(img, 0.5, 0.5))
      expect(await rectValues(page)).toEqual(expected)
    })
  }

  test('四辺それぞれ外から押し始めて内側へ → その辺から選べる', async ({ page }) => {
    const { img } = await openRectCrop(page)
    // 上辺の外 → 下辺の外（左右は中ほど）＝ 上下いっぱい
    await drag(page, await at(img, 0.25, 0, { x: 0, y: -8 }), await at(img, 0.75, 1, { x: 0, y: 8 }))
    let r = await rectValues(page)
    expect([r.y, r.height]).toEqual([0, IMG_H])
    expect(r.x).toBeGreaterThan(0)
    expect(r.x + r.width).toBeLessThan(IMG_W)

    // 左辺の外 → 右辺の外（上下は中ほど）＝ 左右いっぱい
    await drag(page, await at(img, 0, 0.25, { x: -8, y: 0 }), await at(img, 1, 0.75, { x: 8, y: 0 }))
    r = await rectValues(page)
    expect([r.x, r.width]).toEqual([0, IMG_W])
    expect(r.y).toBeGreaterThan(0)
    expect(r.y + r.height).toBeLessThan(IMG_H)
  })

  test('余白から続けてドラッグしても途切れない（文字選択に化けない）', async ({ page }) => {
    const { img } = await openRectCrop(page)
    // 1回目: 余白から押す。以前はここで文字選択が始まり、2回目が選択範囲のドラッグに化けて途切れた。
    await drag(page, await at(img, 1, 1, { x: 8, y: 8 }), await at(img, 0, 0, { x: 3, y: 3 }))
    expect(await rectValues(page)).toEqual({ x: 0, y: 0, width: IMG_W, height: IMG_H })
    await drag(page, await at(img, 0, 0.5, { x: -8, y: 0 }), await at(img, 0.5, 1, { x: 0, y: 8 }))
    expect(await rectValues(page)).toEqual({ x: 0, y: 450, width: 300, height: 450 })
  })

  test('端から離れた所は吸着せず、そのままの位置になる', async ({ page }) => {
    const { img } = await openRectCrop(page)
    await drag(page, await at(img, 0.25, 0.25), await at(img, 0.75, 0.75))
    const r = await rectValues(page)
    // 1 画面px ≒ 3.5 画像px なので、丸めの誤差ぶんの幅を持たせる
    expect(Math.abs(r.x - 150)).toBeLessThanOrEqual(4)
    expect(Math.abs(r.y - 225)).toBeLessThanOrEqual(4)
    expect(Math.abs(r.width - 300)).toBeLessThanOrEqual(4)
    expect(Math.abs(r.height - 450)).toBeLessThanOrEqual(4)
  })
})
