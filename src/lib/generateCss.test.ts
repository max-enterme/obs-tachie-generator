import { describe, expect, it } from 'vitest'
import {
  generateCombinedCss,
  generateCss,
  generateStandaloneCss,
} from './generateCss'
import {
  DEFAULT_OPTIONS,
  type GenerateOptions,
  type NameLabel,
  type SpeakEffect,
  type TachieUser,
} from './types'

const USER_A: TachieUser = {
  id: '123456789012345678',
  name: 'ユーザーA',
  imageUrl: 'data:image/png;base64,AAAABBBBCCCC',
}
const USER_B: TachieUser = {
  id: '987654321098765432',
  name: 'ユーザーB',
  imageUrl: 'data:image/png;base64,DDDDEEEEFFFF',
}

type OptionsOverride = Partial<Omit<GenerateOptions, 'speak' | 'nameLabel'>> & {
  speak?: Partial<SpeakEffect>
  nameLabel?: Partial<NameLabel>
}

const opts = (over: OptionsOverride = {}): GenerateOptions => ({
  ...DEFAULT_OPTIONS,
  ...over,
  speak: { ...DEFAULT_OPTIONS.speak, ...(over.speak ?? {}) },
  nameLabel: { ...DEFAULT_OPTIONS.nameLabel, ...(over.nameLabel ?? {}) },
})

/** 名前表示ONのオプション（テスト用の短縮）。 */
const nameOn = (over: Partial<NameLabel> = {}, rest: OptionsOverride = {}) =>
  opts({ ...rest, nameLabel: { show: true, ...over } })

describe('generateStandaloneCss (常時表示 / body::after)', () => {
  it('立ち絵を :root に data URI で埋め込む', () => {
    const css = generateStandaloneCss(USER_A, opts())
    expect(css).toContain(
      `--img-stand-url-123456789012345678: url("data:image/png;base64,AAAABBBBCCCC");`,
    )
  })

  it('body::after で常時表示し、content は変数を参照する', () => {
    const css = generateStandaloneCss(USER_A, opts())
    expect(css).toContain('body::after {')
    expect(css).toContain('content: var(--img-stand-url-123456789012345678);')
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
      'body:has(img[src*="avatars/123456789012345678"][class*="Voice_avatarSpeaking__"])::after',
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

  it('演出を全部切ると :has() ルールもキーフレームも出さない（＝静止）', () => {
    const css = generateStandaloneCss(
      USER_A,
      opts({ speak: { bounce: false, outline: false, blink: false } }),
    )
    expect(css).not.toContain(':has(')
    expect(css).not.toContain('@keyframes')
    // 立ち絵自体は残る
    expect(css).toContain('body::after {')
  })

  it('枠・点滅・ぴょこぴょこを個別に切り替えられる', () => {
    const jumpOnly = generateStandaloneCss(
      USER_A,
      opts({ speak: { outline: false, blink: false } }),
    )
    expect(jumpOnly).toContain('@keyframes speak-jump')
    expect(jumpOnly).not.toContain('@keyframes speak-light')
    expect(jumpOnly).not.toContain('@keyframes speak-blink')

    const lightOnly = generateStandaloneCss(
      USER_A,
      opts({ speak: { bounce: false, blink: false } }),
    )
    expect(lightOnly).toContain('@keyframes speak-light')
    expect(lightOnly).not.toContain('@keyframes speak-jump')

    const blinkOnly = generateStandaloneCss(
      USER_A,
      opts({ speak: { bounce: false, outline: false, blink: true } }),
    )
    expect(blinkOnly).toContain('@keyframes speak-blink')
    expect(blinkOnly).toContain('speak-blink')
    expect(blinkOnly).not.toContain('@keyframes speak-jump')
    expect(blinkOnly).not.toContain('@keyframes speak-light')
  })

  it('枠・後光の幅(outlineWidth)を反映する（既定2は従来通り、変更で blur/オフセット連動）', () => {
    // 既定 width=2 → blur 2↔8, オフセット ±2（従来相当）
    const w2 = generateStandaloneCss(USER_A, opts({ speak: { outlineColor: '#ff0000' } }))
    expect(w2).toContain('drop-shadow(0 0 2px #ff0000)')
    expect(w2).toContain('drop-shadow(2px 2px 0px #ff0000)')
    expect(w2).toContain('drop-shadow(0 0 8px #ff0000)')
    // width=4 → blur 4↔16, オフセット ±4
    const w4 = generateStandaloneCss(
      USER_A,
      opts({ speak: { outlineColor: '#ff0000', outlineWidth: 4 } }),
    )
    expect(w4).toContain('drop-shadow(0 0 4px #ff0000)')
    expect(w4).toContain('drop-shadow(4px 4px 0px #ff0000)')
    expect(w4).toContain('drop-shadow(-4px -4px 0px #ff0000)')
    expect(w4).toContain('drop-shadow(0 0 16px #ff0000)')
  })

  it('枠・後光の色を反映し、不正な色は白に倒す', () => {
    const red = generateStandaloneCss(USER_A, opts({ speak: { outlineColor: '#ff0000' } }))
    expect(red).toContain('drop-shadow(0 0 2px #ff0000)')
    const bad = generateStandaloneCss(
      USER_A,
      opts({ speak: { outlineColor: 'red; }body{display:none' } }),
    )
    expect(bad).toContain('drop-shadow(0 0 2px #FFFFFF)')
    expect(bad).not.toContain('display:none')
  })

  it('静かな人を暗くする：非発話は暗く・発話で明るく戻す', () => {
    const css = generateStandaloneCss(USER_A, opts({ dimWhenQuiet: true }))
    // body::after 既定は暗い
    expect(css).toMatch(/body::after \{[^}]*filter: brightness\(50%\)/)
    // outline(light) アニメが filter を持つので発話中は明るく戻る（明示 brightness は不要）
    expect(css).toContain(':has(')
  })

  it('静かな人を暗くする（点滅のみ）：発話ルールで明るさを明示的に戻す', () => {
    const css = generateStandaloneCss(
      USER_A,
      opts({ dimWhenQuiet: true, speak: { bounce: false, outline: false, blink: true } }),
    )
    expect(css).toMatch(/:has\([^)]*\)::after \{[^}]*filter: brightness\(100%\)/)
  })

  it('通話にいないときは隠す：hideWhenAway で在室時だけ表示する', () => {
    const on = generateStandaloneCss(USER_A, opts({ hideWhenAway: true }))
    // body::after の既定は非表示
    expect(on).toMatch(/body::after \{[^}]*display: none/)
    // 在室（:has で img 検知）のときだけ表示に戻す
    expect(on).toMatch(
      /body:has\(img\[src\*="avatars\/123456789012345678"\]\)::after \{\s*display: block/,
    )

    const off = generateStandaloneCss(USER_A, opts({ hideWhenAway: false }))
    // 既定は常時表示（block）で、在室検知の表示ルールは出さない
    expect(off).toMatch(/body::after \{[^}]*display: block/)
    expect(off).not.toMatch(
      /body:has\(img\[src\*="avatars\/[0-9]+"\]\)::after \{\s*display: block/,
    )
  })
})

describe('アンカー (9通りの基準位置)', () => {
  /** body::after ブロックだけを切り出す（発話ルールや keyframe を拾わないため）。 */
  const afterBlock = (css: string): string => {
    const m = /\nbody::after \{\n([\s\S]*?)\n\}/.exec(css)
    if (!m) throw new Error('body::after ブロックが見つからない')
    return m[1]
  }

  /** 位置に関わる宣言だけを行で拾う。 */
  const positionLines = (css: string): string[] =>
    afterBlock(css)
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => /^(left|right|top|bottom|transform):/.test(l))

  const anchored = (anchorX: 'left' | 'center' | 'right', anchorY: 'top' | 'middle' | 'bottom') =>
    generateStandaloneCss(USER_A, opts({ anchorX, anchorY, left: 40, bottom: 24 }))

  // 9通り。「アンカーからの距離」がどの位置プロパティに出るか、中央寄せの translate が付くか。
  const CASES: Array<{
    x: 'left' | 'center' | 'right'
    y: 'top' | 'middle' | 'bottom'
    lines: string[]
  }> = [
    { x: 'left', y: 'bottom', lines: ['left: 40px;', 'bottom: 24px;'] },
    { x: 'left', y: 'top', lines: ['left: 40px;', 'top: 24px;'] },
    {
      x: 'left',
      y: 'middle',
      lines: ['left: 40px;', 'bottom: calc(50% + 24px);', 'transform: translateY(50%);'],
    },
    { x: 'right', y: 'bottom', lines: ['right: 40px;', 'bottom: 24px;'] },
    { x: 'right', y: 'top', lines: ['right: 40px;', 'top: 24px;'] },
    {
      x: 'right',
      y: 'middle',
      lines: ['right: 40px;', 'bottom: calc(50% + 24px);', 'transform: translateY(50%);'],
    },
    {
      x: 'center',
      y: 'bottom',
      lines: ['left: calc(50% + 40px);', 'bottom: 24px;', 'transform: translateX(-50%);'],
    },
    {
      x: 'center',
      y: 'top',
      lines: ['left: calc(50% + 40px);', 'top: 24px;', 'transform: translateX(-50%);'],
    },
    {
      x: 'center',
      y: 'middle',
      lines: [
        'left: calc(50% + 40px);',
        'bottom: calc(50% + 24px);',
        'transform: translateX(-50%) translateY(50%);',
      ],
    },
  ]

  for (const c of CASES) {
    it(`${c.x} × ${c.y} の位置宣言`, () => {
      expect(positionLines(anchored(c.x, c.y))).toEqual(c.lines)
    })
  }

  it('未指定（保存済みの旧データ）は左下として読む', () => {
    const legacy = opts({ left: 40, bottom: 24 })
    delete legacy.anchorX
    delete legacy.anchorY
    expect(positionLines(generateStandaloneCss(USER_A, legacy))).toEqual([
      'left: 40px;',
      'bottom: 24px;',
    ])
    // 明示的な left/bottom 指定とバイト一致する（既定値の解決が1箇所であることの確認）。
    expect(generateStandaloneCss(USER_A, legacy)).toBe(
      generateStandaloneCss(USER_A, opts({ anchorX: 'left', anchorY: 'bottom', left: 40, bottom: 24 })),
    )
  })

  it('ズレ 0 の中央は calc を出さず 50% のまま', () => {
    const css = generateStandaloneCss(
      USER_A,
      opts({ anchorX: 'center', anchorY: 'middle', left: 0, bottom: 0 }),
    )
    expect(positionLines(css)).toEqual([
      'left: 50%;',
      'bottom: 50%;',
      'transform: translateX(-50%) translateY(50%);',
    ])
  })

  it('中央のズレは負で逆向き（calc の符号を出し分ける）', () => {
    const css = generateStandaloneCss(
      USER_A,
      opts({ anchorX: 'center', anchorY: 'middle', left: -30, bottom: -12 }),
    )
    expect(css).toContain('left: calc(50% - 30px);')
    expect(css).toContain('bottom: calc(50% - 12px);')
  })

  it('幅が原寸（width 未指定）でも中央寄せが成立する（自分のサイズ半分を戻すため）', () => {
    const css = generateStandaloneCss(
      USER_A,
      opts({ anchorX: 'center', left: 0, width: undefined }),
    )
    expect(css).toContain('left: 50%;')
    expect(css).toContain('transform: translateX(-50%);')
    expect(css).not.toContain('width:')
  })

  it('左下（既定）では transform を出さない', () => {
    expect(afterBlock(generateStandaloneCss(USER_A, opts()))).not.toContain('transform')
  })
})

describe('transform の衝突（中央寄せ × 発話演出）', () => {
  it('中央寄せ + ぴょこぴょこで keyframe に中央寄せ分を織り込む（立ち絵が飛ばない）', () => {
    const css = generateStandaloneCss(
      USER_A,
      opts({ anchorX: 'center', left: 0, speak: { bounce: true, jumpPx: 12 } }),
    )
    expect(css).toContain(`@keyframes speak-jump {
  0% { transform: translateX(-50%) translateY(0); }
  50% { transform: translateX(-50%) translateY(-12px); }
  100% { transform: translateX(-50%) translateY(0); }
}`)
  })

  it('中央 × 中央 + ぴょこぴょこは縦横どちらの中央寄せも保つ', () => {
    const css = generateStandaloneCss(
      USER_A,
      opts({ anchorX: 'center', anchorY: 'middle', left: 0, bottom: 0, speak: { jumpPx: 8 } }),
    )
    expect(css).toContain('50% { transform: translateX(-50%) translateY(50%) translateY(-8px); }')
    // 静止時とアニメで同じ中央寄せ断片を使う（片方だけ直す事故を防ぐ）。
    expect(css).toContain('transform: translateX(-50%) translateY(50%);')
  })

  it('左下（中央寄せなし）の keyframe は従来どおり translateY だけ', () => {
    const css = generateStandaloneCss(USER_A, opts({ speak: { jumpPx: 10 } }))
    expect(css).toContain(`@keyframes speak-jump {
  0% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
  100% { transform: translateY(0); }
}`)
  })

  it('名前帯のアンカーも同じ合成関数を通す（帯の translate が単独で出る）', () => {
    const css = generateStandaloneCss(
      USER_A,
      nameOn({ background: true, fit: 'text', align: 'center' }, { width: 400 }),
    )
    expect(css).toMatch(/body::before \{[^}]*transform: translateX\(-50%\);/)
  })

  it('名前帯が左寄せなら transform を出さない（空の合成は宣言を出さない）', () => {
    const css = generateStandaloneCss(
      USER_A,
      nameOn({ background: true, fit: 'text', align: 'left' }, { width: 400 }),
    )
    const before = /body::before \{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(before).not.toContain('transform')
  })
})

describe('名前ラベルのアンカー追従 (T9)', () => {
  /** body::before の位置に関わる宣言だけを行で拾う。 */
  const namePositionLines = (css: string): string[] => {
    const m = /\nbody::before \{\n([\s\S]*?)\n\}/.exec(css)
    if (!m) throw new Error('body::before ブロックが見つからない')
    return m[1]
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => /^(left|right|top|bottom|transform):/.test(l))
  }

  // 立ち絵は「アンカーからの距離 40 / 24」、名前は「立ち絵に対して右へ10・下へ8」。
  const TACHIE = { left: 40, bottom: 24 }
  const OFFSET = { offsetX: 10, offsetY: -8 }

  const named = (
    anchorX: 'left' | 'center' | 'right',
    anchorY: 'top' | 'middle' | 'bottom',
    over: Partial<NameLabel> = {},
    rest: OptionsOverride = {},
  ) => generateStandaloneCss(USER_A, nameOn({ ...OFFSET, ...over }, { ...TACHIE, ...rest, anchorX, anchorY }))

  describe('オフセットの符号（アンカー基準の距離に直す）', () => {
    it('左アンカーは足す（従来どおり）', () => {
      expect(namePositionLines(named('left', 'bottom', {}, { width: 400 }))).toEqual([
        'left: 50px;', // 40 + 10
        'bottom: 16px;', // 24 + (-8)
      ])
    })

    it('**右アンカーでは offsetX の符号が反転する**（右端からの距離が減る）', () => {
      expect(namePositionLines(named('right', 'bottom', {}, { width: 400 }))).toEqual([
        'right: 30px;', // 40 - 10
        'bottom: 16px;',
      ])
    })

    it('**上アンカーでは offsetY の符号が反転する**（上端からの距離が増える＝下へ）', () => {
      expect(namePositionLines(named('left', 'top', {}, { width: 400 }))).toEqual([
        'left: 50px;',
        'top: 32px;', // 24 - (-8)
      ])
    })

    it('縦中央は下基準のまま（正の offsetY = 上）', () => {
      expect(namePositionLines(named('left', 'middle', {}, { width: 400 }))).toEqual([
        'left: 50px;',
        'bottom: calc(50% + 16px);',
        'transform: translateY(50%);',
      ])
    })
  })

  describe('帯を文字幅に合わせるモード（行揃えぶん掴み位置をずらす）', () => {
    const hug: Partial<NameLabel> = { background: true, fit: 'text' }

    it('左アンカー × 行揃え（従来どおり 立ち絵の幅を足して自分のサイズで戻す）', () => {
      expect(namePositionLines(named('left', 'bottom', { ...hug, align: 'left' }, { width: 400 }))).toEqual([
        'left: 50px;',
        'bottom: 16px;',
      ])
      expect(namePositionLines(named('left', 'bottom', { ...hug, align: 'center' }, { width: 400 }))).toEqual([
        'left: 250px;', // 50 + 400/2
        'bottom: 16px;',
        'transform: translateX(-50%);',
      ])
      expect(namePositionLines(named('left', 'bottom', { ...hug, align: 'right' }, { width: 400 }))).toEqual([
        'left: 450px;', // 50 + 400
        'bottom: 16px;',
        'transform: translateX(-100%);',
      ])
    })

    it('**右アンカーでは行揃えの translate も向きが反転する**', () => {
      // 右端合わせ＝アンカーの自然位置なので、立ち絵の幅も translate も出てこない。
      expect(namePositionLines(named('right', 'bottom', { ...hug, align: 'right' }, { width: 400 }))).toEqual([
        'right: 30px;',
        'bottom: 16px;',
      ])
      expect(namePositionLines(named('right', 'bottom', { ...hug, align: 'center' }, { width: 400 }))).toEqual([
        'right: 230px;', // 30 + 400/2
        'bottom: 16px;',
        'transform: translateX(50%);', // 左アンカーの -50% と逆向き
      ])
      expect(namePositionLines(named('right', 'bottom', { ...hug, align: 'left' }, { width: 400 }))).toEqual([
        'right: 430px;', // 30 + 400
        'bottom: 16px;',
        'transform: translateX(100%);', // 左アンカーの -100% と逆向き
      ])
    })

    it('中央アンカー × 中央揃えは立ち絵の幅が要らない（掴み位置が自然位置と同じ）', () => {
      expect(namePositionLines(named('center', 'bottom', { ...hug, align: 'center' }, { width: 400 }))).toEqual([
        'left: calc(50% + 50px);', // 40 + 10
        'bottom: 16px;',
        'transform: translateX(-50%);',
      ])
    })

    it('中央アンカー × 左右揃えは立ち絵の幅で半分ずらす', () => {
      expect(namePositionLines(named('center', 'bottom', { ...hug, align: 'left' }, { width: 400 }))).toEqual([
        'left: calc(50% - 150px);', // 50 - 400/2
        'bottom: 16px;',
      ])
      expect(namePositionLines(named('center', 'bottom', { ...hug, align: 'right' }, { width: 400 }))).toEqual([
        'left: calc(50% + 250px);', // 50 + 400/2
        'bottom: 16px;',
        'transform: translateX(-100%);',
      ])
    })

    it('立ち絵の幅が分からないときはアンカーの自然位置に落とす（幅なしで成立する唯一の選択）', () => {
      // width 未指定 + 実測なし → 行揃えは効かせられない。
      const right = named('right', 'bottom', { ...hug, align: 'center' }, { width: undefined })
      expect(namePositionLines(right)).toEqual(['right: 30px;', 'bottom: 16px;'])
      const left = named('left', 'bottom', { ...hug, align: 'center' }, { width: undefined })
      expect(namePositionLines(left)).toEqual(['left: 50px;', 'bottom: 16px;'])
      const center = named('center', 'bottom', { ...hug, align: 'left' }, { width: undefined })
      expect(namePositionLines(center)).toEqual([
        'left: calc(50% + 50px);',
        'bottom: 16px;',
        'transform: translateX(-50%);',
      ])
    })
  })

  it('立ち絵と名前が同じアンカーの位置プロパティを使う（逆側に出ない）', () => {
    const css = named('right', 'top', {}, { width: 400 })
    // 両方 right/top 基準。片方だけ left/bottom で焼かれていたら画面の逆側に出る。
    expect(css).toMatch(/body::after \{[^}]*right: 40px;[^}]*top: 24px;/)
    expect(css).toMatch(/body::before \{[^}]*right: 30px;[^}]*top: 32px;/)
    expect(css).not.toMatch(/body::before \{[^}]*\bleft:/)
  })

  it('実測幅の注記は、実際に幅を使ったときだけ出す', () => {
    const usesWidth = generateStandaloneCss(
      USER_A,
      nameOn(
        { ...OFFSET, background: true, fit: 'text', align: 'left' },
        { ...TACHIE, anchorX: 'right', anchorY: 'bottom', width: undefined, imageNaturalWidth: 400 },
      ),
    )
    expect(usesWidth).toContain('位置合わせの基準幅 400px は立ち絵画像の実サイズ')

    // 右アンカー × 右端合わせは幅が要らない → 注記を出さない
    const noWidth = generateStandaloneCss(
      USER_A,
      nameOn(
        { ...OFFSET, background: true, fit: 'text', align: 'right' },
        { ...TACHIE, anchorX: 'right', anchorY: 'bottom', width: undefined, imageNaturalWidth: 400 },
      ),
    )
    expect(noWidth).not.toContain('位置合わせの基準幅')
  })
})

describe('名前表示 (body::before / 任意テキスト)', () => {
  it('既定（表示OFF）では body::before を出さない', () => {
    const css = generateStandaloneCss(USER_A, opts())
    expect(css).not.toContain('body::before')
  })

  it('表示ONで displayName を content に出す（メモ名より優先）', () => {
    const css = generateStandaloneCss({ ...USER_A, displayName: '画面名A' }, nameOn())
    expect(css).toContain('body::before {')
    expect(css).toContain('content: "画面名A";')
    expect(css).not.toContain('content: "ユーザーA";')
  })

  it('displayName が空ならメモ用の表示名を使う', () => {
    expect(generateStandaloneCss(USER_A, nameOn())).toContain('content: "ユーザーA";')
    expect(generateStandaloneCss({ ...USER_A, displayName: '   ' }, nameOn())).toContain(
      'content: "ユーザーA";',
    )
  })

  it('名前が空なら表示ONでも body::before を出さない', () => {
    const css = generateStandaloneCss({ ...USER_A, name: '', displayName: '' }, nameOn())
    expect(css).not.toContain('body::before')
    // 立ち絵は従来どおり出る
    expect(css).toContain('body::after {')
  })

  it('位置は立ち絵の left/bottom にオフセットを足した数値で出す', () => {
    const css = generateStandaloneCss(
      USER_A,
      nameOn({ offsetX: 12, offsetY: -20 }, { left: 100, bottom: 40 }),
    )
    expect(css).toMatch(/body::before \{[^}]*left: 112px;/)
    expect(css).toMatch(/body::before \{[^}]*bottom: 20px;/)
  })

  it('文字サイズ・色・太字・縁取りを反映する', () => {
    const css = generateStandaloneCss(
      USER_A,
      nameOn({ fontSize: 48, color: '#ff0000', bold: false, outlineWidth: 2, outlineColor: '#000000' }),
    )
    expect(css).toContain('font-size: 48px;')
    expect(css).toContain('font-weight: 400;')
    expect(css).toContain('color: #ff0000;')
    expect(css).toContain('text-shadow: 2px 0px 0 #000000,')
    expect(css).toContain('-2px -2px 0 #000000;')
  })

  it('縁取りOFFなら text-shadow を出さない', () => {
    expect(generateStandaloneCss(USER_A, nameOn({ outline: false }))).not.toContain('text-shadow')
  })

  it('行揃えと幅は箱幅が決まるときだけ出す（幅も実測も無ければ出さない）', () => {
    const withWidth = generateStandaloneCss(USER_A, nameOn({ align: 'center' }, { width: 480 }))
    expect(withWidth).toMatch(/body::before \{[^}]*width: 480px;/)
    expect(withWidth).toContain('text-align: center;')

    const noWidth = generateStandaloneCss(USER_A, nameOn({ align: 'center' }))
    expect(noWidth).not.toContain('text-align:')
  })

  it('幅が原寸でも、画像の実サイズがあれば行揃えの箱幅に使う（注記付き）', () => {
    const css = generateStandaloneCss(
      USER_A,
      nameOn({ align: 'center' }, { width: undefined, imageNaturalWidth: 640 }),
    )
    expect(css).toMatch(/body::before \{[^}]*width: 640px;/)
    expect(css).toContain('text-align: center;')
    // 立ち絵自体は原寸のまま（body::after に width を出さない）
    expect(css).not.toMatch(/body::after \{[^}]*width:/)
    // 焼き込みと分かる注記
    expect(css).toContain('立ち絵画像の実サイズ')
  })

  it('width 明示があれば実測より width を優先する', () => {
    const css = generateStandaloneCss(
      USER_A,
      nameOn({ align: 'right' }, { width: 300, imageNaturalWidth: 640 }),
    )
    expect(css).toMatch(/body::before \{[^}]*width: 300px;/)
    expect(css).not.toContain('width: 640px;')
    expect(css).not.toContain('立ち絵画像の実サイズ')
  })

  it('実測が 0 / 未指定なら箱幅を出さない', () => {
    const zero = generateStandaloneCss(USER_A, nameOn({}, { imageNaturalWidth: 0 }))
    expect(zero).not.toContain('text-align:')
    const none = generateStandaloneCss(USER_A, nameOn({}, { imageNaturalWidth: undefined }))
    expect(none).not.toContain('text-align:')
  })

  it('フォント名は指定時だけ出し、危険な文字を落として引用する', () => {
    expect(generateStandaloneCss(USER_A, nameOn())).not.toContain('font-family:')
    expect(generateStandaloneCss(USER_A, nameOn({ fontFamily: 'Noto Sans JP, メイリオ' }))).toContain(
      'font-family: "Noto Sans JP", "メイリオ";',
    )
    const injected = generateStandaloneCss(
      USER_A,
      nameOn({ fontFamily: 'x; } body { display: none' }),
    )
    expect(injected).toContain('font-family: "x body display none";')
    expect(injected).not.toContain('} body {')
  })

  it('数字始まり・ピリオド入りのフォント名も引用して有効な宣言にする', () => {
    // 無引用の識別子は数字始まりにできず、宣言ごと捨てられてしまう（黙って効かない）
    expect(generateStandaloneCss(USER_A, nameOn({ fontFamily: '07やさしさゴシック' }))).toContain(
      'font-family: "07やさしさゴシック";',
    )
    expect(generateStandaloneCss(USER_A, nameOn({ fontFamily: 'Foo.Bar' }))).toContain(
      'font-family: "Foo.Bar";',
    )
    // ジェネリックはキーワードとして解釈させたいので引用しない
    expect(
      generateStandaloneCss(USER_A, nameOn({ fontFamily: 'Meiryo, sans-serif' })),
    ).toContain('font-family: "Meiryo", sans-serif;')
    // CSS 全体キーワードは引用されてファミリ名になる（意図せぬ継承・初期化を防ぐ）
    expect(generateStandaloneCss(USER_A, nameOn({ fontFamily: 'inherit' }))).toContain(
      'font-family: "inherit";',
    )
  })

  it('メモ名で CSS コメントを閉じられない', () => {
    const css = generateStandaloneCss(
      { ...USER_A, name: '*/ body { display: none } /*', displayName: '画面名A' },
      nameOn(),
    )
    expect(css).not.toContain('*/ body { display: none }')
    expect(css).toContain('* / body { display: none } /*')
    // :root ブロックが割れていない（変数定義が同じブロックの中に残る）
    expect(css).toMatch(/:root \{[\s\S]*?--img-stand-url-123456789012345678:[\s\S]*?\n\}/)
  })

  it('文字サイズ 0（入力欄を空にした場合）は 1px に丸める', () => {
    expect(generateStandaloneCss(USER_A, nameOn({ fontSize: 0 }))).toContain('font-size: 1px;')
  })

  it('縁取りONでも幅0なら text-shadow を出さない', () => {
    expect(generateStandaloneCss(USER_A, nameOn({ outline: true, outlineWidth: 0 }))).not.toContain(
      'text-shadow',
    )
  })

  it('位置は小数でも読める桁に丸める', () => {
    const css = generateStandaloneCss(
      USER_A,
      nameOn({ offsetX: 0.05, offsetY: -8.2 }, { left: 16.1, bottom: 16.1 }),
    )
    expect(css).toMatch(/body::before \{[^}]*left: 16.15px;/)
    expect(css).toMatch(/body::before \{[^}]*bottom: 7.9px;/)
  })

  it('立ち絵の幅 0 は箱幅に採らない（立ち絵が消える指定を基準にしない）', () => {
    const css = generateStandaloneCss(USER_A, nameOn({ align: 'center' }, { width: 0 }))
    expect(css).not.toContain('text-align:')
  })

  it('行揃え × 帯の幅モードの組み合わせ', () => {
    // 背景OFF + stretch 指定 → 従来どおり width + text-align（背景は出ない）
    const noBg = generateStandaloneCss(
      USER_A,
      nameOn({ background: false, fit: 'stretch', align: 'right' }, { width: 400 }),
    )
    expect(noBg).toMatch(/body::before \{[^}]*width: 400px;/)
    expect(noBg).toContain('text-align: right;')
    expect(noBg).not.toContain('background:')

    // stretch + 左寄せ
    const stretchLeft = generateStandaloneCss(
      USER_A,
      nameOn({ background: true, fit: 'stretch', align: 'left' }, { left: 100, width: 400 }),
    )
    expect(stretchLeft).toContain('text-align: left;')
    expect(stretchLeft).toMatch(/body::before \{[^}]*left: 100px;/)

    // hug + 箱幅なし → align は無視され左寄せ相当（アンカーも出ない）
    const hugNoWidth = generateStandaloneCss(
      USER_A,
      nameOn({ background: true, fit: 'text', align: 'center' }, { left: 100 }),
    )
    expect(hugNoWidth).toMatch(/body::before \{[^}]*left: 100px;/)
    expect(hugNoWidth).not.toMatch(/body::before \{[^}]*transform:/)

    // stretch + 箱幅なし → width が出ないので実際は文字幅（注記が無いことも確認）
    expect(
      generateStandaloneCss(
        USER_A,
        nameOn({ background: true, fit: 'stretch', align: 'center' }, { left: 100 }),
      ),
    ).not.toMatch(/body::before \{[^}]*width:/)
  })

  it('まとめ版（combined）には名前を出さない', () => {
    const css = generateCombinedCss([USER_A], nameOn())
    expect(css).not.toContain('body::before')
  })

  it('名前のダブルクォート・バックスラッシュ・改行で CSS が壊れない', () => {
    const css = generateStandaloneCss(
      { ...USER_A, displayName: 'a"b\\c\nd' },
      nameOn(),
    )
    expect(css).toContain('content: "a\\"b\\\\c d";')
  })

  it('不正な文字色・縁取り色は白に倒す', () => {
    const css = generateStandaloneCss(
      USER_A,
      nameOn({ color: 'red; } body { display:none', outlineColor: 'nope' }),
    )
    expect(css).toContain('color: #FFFFFF;')
    expect(css).toContain('0 #FFFFFF')
    expect(css).not.toContain('display:none')
  })

  it('hideWhenAway では名前も在室時だけ表示する', () => {
    const css = generateStandaloneCss(USER_A, nameOn({}, { hideWhenAway: true }))
    expect(css).toMatch(/body::before \{[^}]*display: none;/)
    expect(css).toContain(
      'body:has(img[src*="avatars/123456789012345678"])::before,\nbody:has(img[src*="avatars/123456789012345678"])::after {',
    )
  })

  it('背景OFF（既定）では background / padding を出さない', () => {
    const css = generateStandaloneCss(USER_A, nameOn())
    expect(css).not.toContain('background:')
    expect(css).not.toContain('padding:')
    // keyframes 側の transform とは別に、名前ブロックには出さない
    expect(css).not.toMatch(/body::before \{[^}]*transform:/)
  })

  it('背景ON（文字に合わせる）：帯は文字幅＝width を出さず、transform で位置合わせ', () => {
    const css = generateStandaloneCss(
      USER_A,
      nameOn(
        { background: true, fit: 'text', align: 'center', backgroundOpacity: 60 },
        { left: 100, width: 400 },
      ),
    )
    expect(css).toMatch(/body::before \{[^}]*background: rgba\(0, 0, 0, 0\.6\);/)
    expect(css).toContain('padding: 6px 12px;')
    expect(css).toContain('border-radius: 6px;')
    // 帯は文字幅に縮むので width / text-align は出さない
    expect(css).not.toMatch(/body::before \{[^}]*width:/)
    expect(css).not.toContain('text-align:')
    // 立ち絵の中央（100 + 400/2）へアンカー
    expect(css).toMatch(/body::before \{[^}]*left: 300px;/)
    expect(css).toContain('transform: translateX(-50%);')
  })

  it('背景ON（立ち絵の幅いっぱい）：width + text-align + box-sizing を出す', () => {
    const css = generateStandaloneCss(
      USER_A,
      nameOn({ background: true, fit: 'stretch', align: 'center' }, { left: 100, width: 400 }),
    )
    expect(css).toMatch(/body::before \{[^}]*width: 400px;/)
    expect(css).toContain('text-align: center;')
    expect(css).toContain('box-sizing: border-box;')
    expect(css).toMatch(/body::before \{[^}]*left: 100px;/)
    expect(css).not.toMatch(/body::before \{[^}]*transform:/)
  })

  it('帯の右寄せは右端アンカー、左寄せはアンカーなし', () => {
    const right = generateStandaloneCss(
      USER_A,
      nameOn({ background: true, fit: 'text', align: 'right' }, { left: 100, width: 400 }),
    )
    expect(right).toMatch(/body::before \{[^}]*left: 500px;/)
    expect(right).toContain('transform: translateX(-100%);')

    const leftAligned = generateStandaloneCss(
      USER_A,
      nameOn({ background: true, fit: 'text', align: 'left' }, { left: 100, width: 400 }),
    )
    expect(leftAligned).toMatch(/body::before \{[^}]*left: 100px;/)
    expect(leftAligned).not.toMatch(/body::before \{[^}]*transform:/)
  })

  it('帯の色・不透明度・余白0・角丸0 を反映する', () => {
    const css = generateStandaloneCss(
      USER_A,
      nameOn({
        background: true,
        backgroundColor: '#ff0000',
        backgroundOpacity: 100,
        backgroundPadX: 0,
        backgroundPadY: 0,
        backgroundRadius: 0,
      }),
    )
    expect(css).toContain('background: rgba(255, 0, 0, 1);')
    expect(css).not.toContain('padding:')
    expect(css).not.toContain('border-radius:')
  })

  it('帯の色が不正なら白に倒し、不透明度は 0–100 に丸める', () => {
    const bad = generateStandaloneCss(
      USER_A,
      nameOn({ background: true, backgroundColor: 'red; } body { display:none', backgroundOpacity: 999 }),
    )
    expect(bad).toContain('background: rgba(255, 255, 255, 1);')
    expect(bad).not.toContain('display:none')

    const negative = generateStandaloneCss(
      USER_A,
      nameOn({ background: true, backgroundColor: '#000000', backgroundOpacity: -50 }),
    )
    expect(negative).toContain('background: rgba(0, 0, 0, 0);')
  })

  it('立ち絵より前面に出す（::after は後に描かれるため）', () => {
    expect(generateStandaloneCss(USER_A, nameOn())).toMatch(/body::before \{[^}]*z-index: 1;/)
  })
})

describe('名前OFF の出力（001 からの非退行）', () => {
  it('演出なし・名前OFF の出力が期待どおりの文字列と一致する', () => {
    const css = generateStandaloneCss(
      USER_A,
      opts({ speak: { bounce: false, outline: false, blink: false } }),
    )
    expect(css).toBe(
      `:root {
  /* ユーザーA (123456789012345678) */
  --img-stand-url-123456789012345678: url("data:image/png;base64,AAAABBBBCCCC");
}

/* 立ち絵は body::after ただ1つで描画（唯一の描画源＝位置ズレが起きない）。
   Streamkit の実要素は全部隠し、発話だけ検知して body::after を演出する。 */

body, #root {
  overflow: hidden !important;
}

/* 立ち絵（常時表示：通話に居ても居なくても同じ位置） */
body::after {
  content: var(--img-stand-url-123456789012345678);
  position: fixed;
  left: 16px;
  bottom: 16px;
  display: block;
}

img {
  display: none !important;
}

[class*="Voice_name__"], [class*="Voice_user__"] {
  display: none !important;
}
`,
    )
  })
})

describe('generateCombinedCss (まとめ / per-img)', () => {
  it('全ユーザーの立ち絵を :root に並べる', () => {
    const css = generateCombinedCss([USER_A, USER_B], opts())
    expect(css).toContain('--img-stand-url-123456789012345678:')
    expect(css).toContain('--img-stand-url-987654321098765432:')
  })

  it('人ごとに img[src*="avatars/<id>"] を差し替える', () => {
    const css = generateCombinedCss([USER_A, USER_B], opts())
    expect(css).toContain('img[src*="avatars/123456789012345678"] {')
    expect(css).toContain('img[src*="avatars/987654321098765432"] {')
    expect(css).toContain('content: var(--img-stand-url-987654321098765432);')
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

  it('静かな人を暗くする：Voice_avatar__ を暗くし発話クラスで戻す', () => {
    const css = generateCombinedCss([USER_A, USER_B], opts({ dimWhenQuiet: true }))
    expect(css).toMatch(/\[class\*="Voice_avatar__"\] \{\s*filter: brightness\(50%\)/)
    expect(css).toContain('[class*="Voice_avatarSpeaking__"] {')
  })
})

describe('generateCss (統一入口)', () => {
  it('alwaysShow かつ 1人 → 常時表示（body::after）', () => {
    const css = generateCss([USER_A], opts({ alwaysShow: true }))
    expect(css).toContain('body::after {')
    expect(css).not.toContain('img[src*="avatars/123456789012345678"] {')
  })

  it('alwaysShow=false → まとめ（per-img）', () => {
    const css = generateCss([USER_A], opts({ alwaysShow: false }))
    expect(css).toContain('img[src*="avatars/123456789012345678"] {')
    expect(css).not.toContain('body::after {')
  })

  it('alwaysShow を複数人に指定 → 注記付きでまとめ版', () => {
    const css = generateCss([USER_A, USER_B], opts({ alwaysShow: true }))
    expect(css).toContain('注: 常時表示は 1人=1ブラウザソース')
    expect(css).toContain('img[src*="avatars/987654321098765432"] {')
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
