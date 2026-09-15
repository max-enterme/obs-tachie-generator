import { expect, test, type Page } from '@playwright/test'
import { generateStandaloneCss } from '../src/lib/generateCss'
import { DEFAULT_OPTIONS, type GenerateOptions, type TachieUser } from '../src/lib/types'

/** 赤一色 600×900 の PNG を canvas で作って data URI にする。 */
async function makeRedImageDataUrl(page: Page): Promise<string> {
  await page.setContent('<html><body></body></html>')
  return page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 600
    canvas.height = 900
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2d context を取得できない')
    ctx.fillStyle = '#ff0000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png')
  })
}

/** 出力CSSを実ブラウザに読み込ませる。 */
async function renderCss(page: Page, css: string): Promise<void> {
  await page.setContent(
    `<style>html{background:#ffffff}</style><style>${css}</style><body></body>`,
  )
}

/** スクリーンショットを撮り、赤画素の外接矩形を返す。 */
type BoundingBox = { left: number; top: number; right: number; bottom: number }

async function measureRedBoundingBox(page: Page): Promise<BoundingBox> {
  const screenshot = await page.screenshot()
  return page.evaluate((base64) => {
    return new Promise<BoundingBox>((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('2d context を取得できない'))
          return
        }
        ctx.drawImage(img, 0, 0)
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
        let left = Infinity
        let top = Infinity
        let right = -Infinity
        let bottom = -Infinity
        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            const i = (y * canvas.width + x) * 4
            const r = data[i]
            const g = data[i + 1]
            const b = data[i + 2]
            if (r > 200 && g < 60 && b < 60) {
              if (x < left) left = x
              if (x > right) right = x
              if (y < top) top = y
              if (y > bottom) bottom = y
            }
          }
        }
        if (right < left) {
          resolve({ left: 0, top: 0, right: 0, bottom: 0 })
          return
        }
        resolve({ left, top, right: right + 1, bottom: bottom + 1 })
      }
      img.onerror = () => reject(new Error('画像の読み込みに失敗'))
      img.src = `data:image/png;base64,${base64}`
    })
  }, screenshot.toString('base64'))
}

/** 差が ±1px 以内であることを確認する。 */
function expectClose(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1)
}

async function buildCssAndRender(
  page: Page,
  imageUrl: string,
  overrides: Partial<GenerateOptions>,
): Promise<void> {
  const user: TachieUser = { id: '42', name: 'render-test', imageUrl }
  const options: GenerateOptions = {
    ...DEFAULT_OPTIONS,
    alwaysShow: true,
    hideWhenAway: false,
    dimWhenQuiet: false,
    nameLabel: { ...DEFAULT_OPTIONS.nameLabel, show: false },
    ...overrides,
  }
  const css = generateStandaloneCss(user, options)
  await renderCss(page, css)
}

/** 描画が撮影に間に合うまで撮り直しつつ、外接矩形を得る。 */
async function pollBoundingBox(page: Page): Promise<BoundingBox> {
  let box: BoundingBox = { left: 0, top: 0, right: 0, bottom: 0 }
  await expect
    .poll(
      async () => {
        box = await measureRedBoundingBox(page)
        return box.right - box.left
      },
      { timeout: 5000 },
    )
    .toBeGreaterThan(0)
  return box
}

test('R1 幅300は300×450に収まり、下16pxに付く', async ({ page }) => {
  const imageUrl = await makeRedImageDataUrl(page)
  await buildCssAndRender(page, imageUrl, {
    width: 300,
    left: 40,
    bottom: 16,
    imageNaturalWidth: 600,
    imageNaturalHeight: 900,
  })
  const box = await pollBoundingBox(page)
  expectClose(box.left, 40)
  expectClose(box.right - box.left, 300)
  expectClose(box.bottom - box.top, 450)
  expectClose(box.bottom, 1064)
})

test('R2 原寸でも下16pxに付く(7px浮かない)', async ({ page }) => {
  const imageUrl = await makeRedImageDataUrl(page)
  await buildCssAndRender(page, imageUrl, {
    width: undefined,
    left: 40,
    bottom: 16,
    imageNaturalWidth: 600,
    imageNaturalHeight: 900,
  })
  const box = await pollBoundingBox(page)
  expectClose(box.right - box.left, 600)
  expectClose(box.bottom - box.top, 900)
  expectClose(box.bottom, 1064)
})

test('R3 右下アンカー距離0で画面内に収まる', async ({ page }) => {
  const imageUrl = await makeRedImageDataUrl(page)
  await buildCssAndRender(page, imageUrl, {
    width: 300,
    anchorX: 'right',
    anchorY: 'bottom',
    left: 0,
    bottom: 0,
    imageNaturalWidth: 600,
    imageNaturalHeight: 900,
  })
  const box = await pollBoundingBox(page)
  expectClose(box.right, 1920)
  expectClose(box.bottom, 1080)
  expectClose(box.right - box.left, 300)
  expectClose(box.bottom - box.top, 450)
})

test('R4 中央アンカーで中心に来る', async ({ page }) => {
  const imageUrl = await makeRedImageDataUrl(page)
  await buildCssAndRender(page, imageUrl, {
    width: 300,
    anchorX: 'center',
    anchorY: 'middle',
    left: 0,
    bottom: 0,
    imageNaturalWidth: 600,
    imageNaturalHeight: 900,
  })
  const box = await pollBoundingBox(page)
  expectClose((box.left + box.right) / 2, 960)
  expectClose((box.top + box.bottom) / 2, 540)
})
