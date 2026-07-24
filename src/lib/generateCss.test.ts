import { describe, expect, it } from 'vitest'
import {
  generateCombinedCss,
  generateCss,
  generateStandaloneCss,
} from './generateCss'
import {
  DEFAULT_OPTIONS,
  type GenerateOptions,
  type SpeakEffect,
  type TachieUser,
} from './types'

const USER_A: TachieUser = {
  id: '649228696229511179',
  name: 'てつん',
  imageUrl: 'data:image/png;base64,AAAABBBBCCCC',
}
const USER_B: TachieUser = {
  id: '553620056039358464',
  name: 'カハロ',
  imageUrl: 'data:image/png;base64,DDDDEEEEFFFF',
}

type OptionsOverride = Partial<Omit<GenerateOptions, 'speak'>> & {
  speak?: Partial<SpeakEffect>
}

const opts = (over: OptionsOverride = {}): GenerateOptions => ({
  ...DEFAULT_OPTIONS,
  ...over,
  speak: { ...DEFAULT_OPTIONS.speak, ...(over.speak ?? {}) },
})

describe('generateStandaloneCss (常時表示 / body::after)', () => {
  it('立ち絵を :root に data URI で埋め込む', () => {
    const css = generateStandaloneCss(USER_A, opts())
    expect(css).toContain(
      `--img-stand-url-649228696229511179: url("data:image/png;base64,AAAABBBBCCCC");`,
    )
  })

  it('body::after で常時表示し、content は変数を参照する', () => {
    const css = generateStandaloneCss(USER_A, opts())
    expect(css).toContain('body::after {')
    expect(css).toContain('content: var(--img-stand-url-649228696229511179);')
    expect(css).toContain('position: fixed;')
  })

  it('位置(left/bottom)を反映する', () => {
    const css = generateStandaloneCss(USER_A, opts({ left: 40, bottom: 24 }))
    expect(css).toContain('left: 40px;')
    expect(css).toContain('bottom: 24px;')
  })

  it('width 指定時のみ幅を出力する', () => {
    expect(generateStandaloneCss(USER_A, opts({ width: 480 }))).toContain(
      'width: 480px;',
    )
    expect(generateStandaloneCss(USER_A, opts({ width: undefined }))).not.toContain(
      'width:',
    )
  })

  it(':has() で発話検知し前方一致セレクタを使う', () => {
    const css = generateStandaloneCss(USER_A, opts())
    expect(css).toContain(
      'body:has(img[src*="avatars/649228696229511179"][class*="Voice_avatarSpeaking__"])::after',
    )
  })

  it('実要素（img / 名前）は隠す', () => {
    const css = generateStandaloneCss(USER_A, opts())
    expect(css).toMatch(/img\s*\{\s*display: none !important;/)
    expect(css).toContain('[class*="Voice_name__"]')
  })

  it('跳ね有効なら speak-jump キーフレームと animation を出す', () => {
    const css = generateStandaloneCss(USER_A, opts({ speak: { jumpPx: 12 } }))
    expect(css).toContain('@keyframes speak-jump')
    expect(css).toContain('translateY(-12px)')
    expect(css).toContain('speak-jump')
  })

  it('演出を全部切ると :has() ルールもキーフレームも出さない', () => {
    const css = generateStandaloneCss(USER_A, opts({ speak: { enabled: false } }))
    expect(css).not.toContain(':has(')
    expect(css).not.toContain('@keyframes')
    // 立ち絵自体は残る
    expect(css).toContain('body::after {')
  })

  it('白フチだけ・跳ねだけを個別に切り替えられる', () => {
    const jumpOnly = generateStandaloneCss(
      USER_A,
      opts({ speak: { whiteOutline: false } }),
    )
    expect(jumpOnly).toContain('@keyframes speak-jump')
    expect(jumpOnly).not.toContain('@keyframes speak-light')

    const lightOnly = generateStandaloneCss(
      USER_A,
      opts({ speak: { jumpPx: 0 } }),
    )
    expect(lightOnly).toContain('@keyframes speak-light')
    expect(lightOnly).not.toContain('@keyframes speak-jump')
  })
})

describe('generateCombinedCss (まとめ / per-img)', () => {
  it('全ユーザーの立ち絵を :root に並べる', () => {
    const css = generateCombinedCss([USER_A, USER_B], opts())
    expect(css).toContain('--img-stand-url-649228696229511179:')
    expect(css).toContain('--img-stand-url-553620056039358464:')
  })

  it('人ごとに img[src*="avatars/<id>"] を差し替える', () => {
    const css = generateCombinedCss([USER_A, USER_B], opts())
    expect(css).toContain('img[src*="avatars/649228696229511179"] {')
    expect(css).toContain('img[src*="avatars/553620056039358464"] {')
    expect(css).toContain('content: var(--img-stand-url-553620056039358464);')
  })

  it('発話演出は前方一致クラスへ当てる', () => {
    const css = generateCombinedCss([USER_A], opts())
    expect(css).toContain('[class*="Voice_avatarSpeaking__"] {')
  })

  it('combined の跳ねは bottom キーフレームを使う', () => {
    const css = generateCombinedCss([USER_A], opts({ speak: { jumpPx: 10 } }))
    expect(css).toContain('@keyframes speak-jump')
    expect(css).toMatch(/bottom: 10px;/)
  })
})

describe('generateCss (統一入口)', () => {
  it('alwaysShow かつ 1人 → 常時表示（body::after）', () => {
    const css = generateCss([USER_A], opts({ alwaysShow: true }))
    expect(css).toContain('body::after {')
    expect(css).not.toContain('img[src*="avatars/649228696229511179"] {')
  })

  it('alwaysShow=false → まとめ（per-img）', () => {
    const css = generateCss([USER_A], opts({ alwaysShow: false }))
    expect(css).toContain('img[src*="avatars/649228696229511179"] {')
    expect(css).not.toContain('body::after {')
  })

  it('alwaysShow を複数人に指定 → 注記付きでまとめ版', () => {
    const css = generateCss([USER_A, USER_B], opts({ alwaysShow: true }))
    expect(css).toContain('注: 常時表示は 1人=1ブラウザソース')
    expect(css).toContain('img[src*="avatars/553620056039358464"] {')
  })

  it('ユーザー未登録なら案内コメントだけ返す', () => {
    const css = generateCss([], opts())
    expect(css).toContain('ユーザーが未登録')
  })
})

describe('入力の頑健性', () => {
  it('ID の非数字を落として変数名・セレクタを安全化する', () => {
    const css = generateStandaloneCss(
      { id: ' 123-456 ', name: 'x', imageUrl: 'data:image/png;base64,Z' },
      opts(),
    )
    expect(css).toContain('--img-stand-url-123456:')
    expect(css).toContain('avatars/123456')
  })

  it('URL 内のダブルクォートをエスケープして url() を壊さない', () => {
    const css = generateStandaloneCss(
      { id: '1', name: '', imageUrl: 'https://ex.com/a".png' },
      opts(),
    )
    expect(css).toContain('url("https://ex.com/a\\".png")')
  })
})
