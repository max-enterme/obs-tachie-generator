import { expect, test, type Page } from '@playwright/test'
import { generateSeatCss, generateStandaloneCss } from '../src/lib/generateCss'
import { DEFAULT_OPTIONS, DEFAULT_SPEAK, makeDefaultPreset, presetToOptions, seatPreset, type GenerateOptions, type TachieUser } from '../src/lib/types'

/** 一色 600×900 の PNG を canvas で作って data URI にする。 */
async function makeColorImageDataUrl(page: Page, color: '#ff0000' | '#0000ff'): Promise<string> {
  await page.setContent('<html><body></body></html>')
  return page.evaluate((fill) => {
    const canvas = document.createElement('canvas')
    canvas.width = 600
    canvas.height = 900
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2d context を取得できない')
    ctx.fillStyle = fill
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png')
  }, color)
}

async function makeRedImageDataUrl(page: Page): Promise<string> {
  return makeColorImageDataUrl(page, '#ff0000')
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
  return measureColorBoundingBox(page, 'red')
}

async function measureColorBoundingBox(page: Page, color: 'red' | 'blue'): Promise<BoundingBox> {
  const screenshot = await page.screenshot()
  return page.evaluate(({ base64, targetColor }) => {
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
            const matches = targetColor === 'red'
              ? r > 200 && g < 60 && b < 60
              : b > 200 && r < 60 && g < 60
            if (matches) {
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
  }, { base64: screenshot.toString('base64'), targetColor: color })
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

async function renderMouthPage(
  page: Page,
  { speaking, speak }: { speaking: boolean; speak: GenerateOptions['speak'] },
): Promise<void> {
  const standUrl = await makeColorImageDataUrl(page, '#ff0000')
  const mouthUrl = await makeColorImageDataUrl(page, '#0000ff')
  const user: TachieUser = { id: '42', name: 'render-test', imageUrl: standUrl, mouthImageUrl: mouthUrl }
  const options: GenerateOptions = {
    ...DEFAULT_OPTIONS,
    alwaysShow: true,
    hideWhenAway: false,
    dimWhenQuiet: false,
    nameLabel: { ...DEFAULT_OPTIONS.nameLabel, show: false },
    mouthIntervalMs: 400,
    speak,
    imageNaturalWidth: 600,
    imageNaturalHeight: 900,
  }
  const css = generateStandaloneCss(user, options)
  const speakingImage = speaking
    ? '<img src="http://127.0.0.1:9/avatars/42.png" class="Voice_avatarSpeaking__x">'
    : '<img src="http://127.0.0.1:9/avatars/42.png">'
  await page.setContent(`<style>html{background:#ffffff}</style><style>${css}</style><body>${speakingImage}</body>`)
}

async function seekMouthAnimation(page: Page, currentTime: number): Promise<void> {
  await page.evaluate((time) => {
    const animation = document.getAnimations().find((item) => item instanceof CSSAnimation && item.animationName === 'speak-mouth')
    if (!animation) throw new Error('speak-mouth animation が見つからない')
    animation.pause()
    animation.currentTime = time
  }, currentTime)
}

async function expectMouthColor(page: Page, expected: 'red' | 'blue', absent: 'red' | 'blue', checkHeight = true): Promise<void> {
  let box: BoundingBox = { left: 0, top: 0, right: 0, bottom: 0 }
  await expect.poll(async () => {
    box = await measureColorBoundingBox(page, expected)
    return box.right - box.left
  }, { timeout: 5000 }).toBeGreaterThan(0)
  expect(box.right - box.left).toBe(600)
  if (checkHeight) expect(box.bottom - box.top).toBe(900)
  expect((await measureColorBoundingBox(page, absent)).right).toBe(0)
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

test('R5 発話中は周期の前半が立ち絵・後半が口開き絵になる', async ({ page }) => {
  await renderMouthPage(page, { speaking: true, speak: { ...DEFAULT_OPTIONS.speak, bounce: false, outline: false } })
  for (const time of [40, 190]) {
    await seekMouthAnimation(page, time)
    await expectMouthColor(page, 'red', 'blue')
  }
  for (const time of [240, 390]) {
    await seekMouthAnimation(page, time)
    await expectMouthColor(page, 'blue', 'red')
  }
})

test('R6 静止時は立ち絵だけ', async ({ page }) => {
  await renderMouthPage(page, { speaking: false, speak: DEFAULT_OPTIONS.speak })
  expect(await page.evaluate(() => document.getAnimations().some((item) => item instanceof CSSAnimation && item.animationName === 'speak-mouth'))).toBe(false)
  await expectMouthColor(page, 'red', 'blue')
})

test('R7 ぴょこぴょこ・枠・後光と併用しても切り替わる', async ({ page }) => {
  await renderMouthPage(page, { speaking: true, speak: DEFAULT_OPTIONS.speak })
  for (const time of [40, 190]) {
    await seekMouthAnimation(page, time)
    await expectMouthColor(page, 'red', 'blue', false)
  }
  for (const time of [240, 390]) {
    await seekMouthAnimation(page, time)
    await expectMouthColor(page, 'blue', 'red', false)
  }
})

/** 席の CSS と、通話にいる人ぶんの img を置く。speaking なら発話クラスを付ける。 */
async function renderSeatPage(page: Page, imgs: Array<{ id: string; speaking?: boolean }>): Promise<void> {
  const redUrl = await makeColorImageDataUrl(page, '#ff0000')
  const blueUrl = await makeColorImageDataUrl(page, '#0000ff')
  const seat = { anchorX: 'right' as const, anchorY: 'bottom' as const, left: 0, bottom: 0 }
  const preset1 = { ...makeDefaultPreset('p1'), imageUrl: redUrl, width: 300, anchorX: 'left' as const, speak: { ...DEFAULT_SPEAK, outline: false } }
  const preset2 = { ...makeDefaultPreset('p2'), imageUrl: blueUrl, width: 300, anchorX: 'center' as const, speak: { ...DEFAULT_SPEAK, outline: false } }
  const candidates = [
    { user: { id: '42', name: 'render-red', imageUrl: redUrl }, options: presetToOptions(seatPreset(preset1, seat), 600, 900) },
    { user: { id: '43', name: 'render-blue', imageUrl: blueUrl }, options: presetToOptions(seatPreset(preset2, seat), 600, 900) },
  ]
  const css = generateSeatCss('render-seat', candidates)
  const images = imgs.map(({ id, speaking }) => `<img src="http://127.0.0.1:9/avatars/${id}.png"${speaking ? ' class="Voice_avatarSpeaking__x"' : ''}>`).join('')
  await page.setContent(`<style>html{background:#ffffff}</style><style>${css}</style><body>${images}</body>`)
}

test('R8 席: 1 番目だけ在室なら 1 番目だけ、席の位置に描かれる', async ({ page }) => {
  await renderSeatPage(page, [{ id: '42' }])
  const red = await pollBoundingBox(page)
  expectClose(red.left, 1620)
  expectClose(red.right, 1920)
  expectClose(red.bottom, 1080)
  expectClose((await measureColorBoundingBox(page, 'blue')).right, 0)
})

test('R9 席: 2 番目だけ在室なら 2 番目が同じ席の位置に描かれる', async ({ page }) => {
  await renderSeatPage(page, [{ id: '43' }])
  const blue = await expect.poll(async () => (await measureColorBoundingBox(page, 'blue')).right, { timeout: 5000 }).toBeGreaterThan(0)
  void blue
  const box = await measureColorBoundingBox(page, 'blue')
  expectClose(box.left, 1620)
  expectClose(box.right, 1920)
  expectClose(box.bottom, 1080)
  expectClose((await measureColorBoundingBox(page, 'red')).right, 0)
})

test('R10 席: 2 人とも在室なら上の候補だけ', async ({ page }) => {
  await renderSeatPage(page, [{ id: '43' }, { id: '42' }])
  const red = await pollBoundingBox(page)
  expectClose(red.left, 1620)
  expectClose(red.right, 1920)
  expectClose(red.bottom, 1080)
  expectClose((await measureColorBoundingBox(page, 'blue')).right, 0)
})

test('R11 席: 誰もいなければ何も描かれない', async ({ page }) => {
  await renderSeatPage(page, [])
  expect(await page.evaluate(() => [getComputedStyle(document.body, '::after').content, getComputedStyle(document.body, '::before').content])).toEqual(['none', 'none'])
})

test('R12 席: 出ていない候補が話しても、出ている候補は動かない', async ({ page }) => {
  await renderSeatPage(page, [{ id: '42' }, { id: '43', speaking: true }])
  const names = await page.evaluate(() => document.getAnimations().filter((item) => item instanceof CSSAnimation).map((item) => (item as CSSAnimation).animationName))
  expect(names.some((name) => name.endsWith('-c1'))).toBe(false)
  expect(names.some((name) => name.endsWith('-c2'))).toBe(false)
})

test('R13 席: 出ている候補が話すとその候補の演出だけ動く', async ({ page }) => {
  await renderSeatPage(page, [{ id: '42', speaking: true }, { id: '43' }])
  const names = await page.evaluate(() => document.getAnimations().filter((item) => item instanceof CSSAnimation).map((item) => (item as CSSAnimation).animationName))
  expect(names).toContain('speak-jump-c1')
  expect(names.some((name) => name.endsWith('-c2'))).toBe(false)
})
