---
feature: image-width-render
test: npm run typecheck && npm run lint && npx vitest run && npx playwright install chromium && npx playwright test
---

# 実装計画 — 立ち絵の幅指定を出力CSSでも効かせる

> plan.md — 「どう作るか」。spec.md の受け入れ条件を満たす設計。

## アプローチ
- 立ち絵 `body::after` を**背景画像方式**に切り替える: `content: "";` にして、画像は `background-image` で描き、
  箱の大きさを `width` / `height`(px)で明示し、`background-size: contain` で箱に収める。
  背景は置換要素ではないので、**箱の大きさ = 描かれる絵の大きさ**になり、ベースライン下の 7px も入らない。
- 背景方式は箱の高さが自動で決まらないため、**画像の実寸(横・縦)をアプリ側で測り、出力へ焼き込む**。
  いまの `imageNaturalWidth`(横)と同じ経路に `imageNaturalHeight`(縦)を足す。
- 箱の大きさは新しい純粋関数 `tachieBoxSize` 1 か所で決める(幅指定 > 実寸。プレビュー `TachiePreview.tsx:106` の
  `effWidth = width ?? naturalW ?? FALLBACK_WIDTH` と同じ優先順)。
- **実寸が横・縦そろって渡されないときは、`afterDecls` を変更前と同じ行のまま出す**(読み込み中・読めない URL でも表示は保つ)。
  既存の単体テストは実寸の縦を渡していないので、この分岐で**無変更のまま通る**。
- 並べ方: lib(出力CSS)→ 実寸の受け渡し(UI 配線)/ 実ブラウザでの外形テスト、の順。後ろ 2 つは互いに独立。

## 変更点
| 対象(ファイル / 関数) | 変更 |
|---|---|
| `src/lib/generateCss.ts` 新規 `tachieBoxSize`(`generateStandaloneCss` の直前に置く) | 箱サイズを返す純粋関数を追加(下の「新規インターフェース」) |
| `src/lib/generateCss.ts:532` `generateStandaloneCss` の `afterDecls`(`:541-551`)と `parts` の `body::after` 見出しコメント(`:558`) | `tachieBoxSize(width, imageNaturalWidth, imageNaturalHeight)` が非 null なら下の「背景方式の宣言」(見出しコメント込み)を出す。null なら `:541-551` と `:558` の現行行をそのまま出す |
| `src/lib/generateCss.ts:534` の分割代入 | `imageNaturalWidth`, `imageNaturalHeight` を足す |
| `src/lib/types.ts:162-167` `GenerateOptions.imageNaturalWidth` | doc を「名前ラベルの箱幅と、立ち絵の描画サイズ(背景方式)に使う」に直す |
| `src/lib/types.ts` `GenerateOptions`(`imageNaturalWidth` の直後) | `imageNaturalHeight?: number` を追加 |
| `src/lib/types.ts:251` `presetToOptions` | 第 3 引数 `imageNaturalHeight?: number` を足し、戻り値に `imageNaturalHeight` を入れる |
| `src/lib/image.ts:64-84` `measureNaturalWidth` | `measureNaturalSize(url, timeoutMs = 8000): Promise<Dimensions \| null>` に置き換える(`measureNaturalWidth` は削除。呼び出し元は `useImageNaturalWidth.ts` だけ) |
| `src/ui/useImageNaturalWidth.ts` | 削除し、`src/ui/useImageNaturalSize.ts` を新規作成(`useImageNaturalSize(imageUrl): Dimensions \| null`。中身は同じ `useEffect` の形で `measureNaturalSize` を呼ぶ) |
| `src/App.tsx:9, 58-59` | `useImageNaturalSize` に差し替え、`focusedNatural` / `selectedNatural`(`Dimensions \| null`)にする |
| `src/App.tsx:164` | `imageNaturalWidth={focusedNatural?.width ?? null}`(PresetPanel の props は変えない) |
| `src/App.tsx:209` | `imageNaturalWidth={selectedNatural?.width ?? null}` と `imageNaturalHeight={selectedNatural?.height ?? null}` |
| `src/ui/OutputPanel.tsx:6-13, 20, 30-35` | props に `imageNaturalHeight?: number \| null` を足し、`presetToOptions(preset, imageNaturalWidth ?? undefined, imageNaturalHeight ?? undefined)`、`useMemo` の依存配列に `imageNaturalHeight` を足す |
| `package.json` | devDependencies に `@playwright/test`(最新の 1.x)、scripts に `"test:render": "playwright test"` |
| `playwright.config.ts`(新規) | `testDir: 'e2e'`、`projects` は chromium 1 本、`use.viewport` は `{ width: 1920, height: 1080 }`、`webServer` なし |
| `e2e/render.spec.ts`(新規) | 下の「テストケース」の R1〜R4 |
| `tsconfig.json` `include` | `"e2e"` と `"playwright.config.ts"` を足す(型チェック対象にする) |
| `.gitignore` | `test-results/` と `playwright-report/` を足す |

変更しないもの: `src/ui/TachiePreview.tsx`、`src/ui/PresetPanel.tsx`、`nameBlock`、`generateCombinedCss`、`composeTransform`、keyframes、`vite.config.ts`(vitest の `include` は `src/**` なので `e2e/` は拾われない)。

### 背景方式の宣言(`tachieBoxSize` が `{ width: W, height: H }` を返したとき)
ブロック見出しのコメントは、`generateStandaloneCss` の `parts` にある現行の
`/* 立ち絵（常時表示：通話に居ても居なくても同じ位置） */` を、背景方式のときだけ次の 2 行に置き換える
(`nameBlock` の `generateCss.ts:434-438` が実測幅を使ったときに出す注記と同じ流儀。従来方式のときは現行のまま):

```
/* 立ち絵（常時表示：通話に居ても居なくても同じ位置）
   描画サイズ ${W}x${H}px は立ち絵画像の実サイズから算出。**画像を差し替えたらCSSを出し直すこと**。 */
```

宣言の順序はこのとおり(位置と transform の行は現行と同じ位置に置く):

```
  content: "";
  position: fixed;
  <pos.decls — 現行と同じ>
  display: none | block;        ← 現行と同じ
  transform: ...;               ← 現行と同じ(staticTransform があるときだけ)
  width: Wpx;
  height: Hpx;
  background-image: var(--img-stand-url-<id>);
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  filter: brightness(50%);      ← 現行と同じ(dimWhenQuiet のときだけ)
```

`:root` の `--img-stand-url-<id>` 変数(`rootBlock`)はそのまま使う。

## 新規インターフェース
```ts
// src/lib/generateCss.ts
/**
 * 立ち絵 body::after の描画サイズ(px)。背景画像方式は箱の高さが自動で決まらないため、ここで焼き込む。
 * 実寸(横・縦)のどちらかが無い / 0 以下なら null(= 呼び出し側は従来の content 方式に戻す)。
 * 幅指定(> 0)があればその幅に縦横比を保って合わせる。無ければ実寸。
 */
export function tachieBoxSize(
  width: number | undefined,
  naturalWidth: number | undefined,
  naturalHeight: number | undefined,
): { width: number; height: number } | null
// 高さは Math.max(1, Math.round(width * naturalHeight / naturalWidth))

// src/lib/types.ts — GenerateOptions に追加
/** 立ち絵画像の実サイズ(高さ px)。imageNaturalWidth と対で、立ち絵の描画サイズ(背景方式)に使う。 */
imageNaturalHeight?: number

// src/lib/types.ts
export function presetToOptions(p: Preset, imageNaturalWidth?: number, imageNaturalHeight?: number): GenerateOptions

// src/lib/image.ts(Dimensions は同ファイル :17 の既存型)
export async function measureNaturalSize(url: string, timeoutMs = 8000): Promise<Dimensions | null>
// 空 URL / 読めない / タイムアウト / naturalWidth か naturalHeight が 0 → null

// src/ui/useImageNaturalSize.ts
export function useImageNaturalSize(imageUrl: string | undefined): Dimensions | null
```

## 採らない案
- **`content: url()` のまま `width` + `height` を足す(比較ページの b)** — 実測で縮まない。置換要素の `content` は箱の大きさに追従しない。
- **`transform: scale()` で縮める(比較ページの d)** — 見た目は収まるが、静止時 / speak-jump / 名前帯の `transform` を
  `composeTransform` 1 か所に集めた 003 の不変条件と衝突する。さらに `scale` は位置の基準点もずらすため、アンカー距離の意味が変わる。
- **幅指定のときだけ背景方式にし、原寸は `content` のまま** — 原寸で 7px 浮く問題が残る。MAX が「そろえる」を選んだ(2026-09-16)。
- **実寸が測れないとき、幅だけ出して高さを出さない** — 背景方式で高さが無いと箱の高さが 0 になり、**絵が消える**。現行出力へ戻す方が安全。
- **CSS の `aspect-ratio` で高さを決める** — 縦横比の値そのものは実寸の縦が無いと書けないので、測る手間は同じ。`height` の px の方が OBS(CEF 127)での挙動が単純。
- **Jenkins でブラウザテストを回す** — パイプラインは別リポジトリ(`jenkins-pipelines/pipelines/obs-tachie-generator.Jenkinsfile`)で、docker イメージ `node:22-bookworm` にブラウザ依存が無い。この feature では入れない。
- **外形テストを jsdom(vitest)で書く** — jsdom は描画しないので、今回のバグ(箱と絵の大きさの食い違い)を検出できない。

## テスト
- `tachieBoxSize`: 幅 300 × 実寸 600×900 → 300×450 / 幅未指定 → 600×900 / 幅 0 → 600×900 / 実寸の横か縦が無い・0 → null / 幅 301 × 600×900 → 301×452(451.5 を四捨五入)。
- `generateStandaloneCss` に実寸 600×900 と幅 300 を渡すと、`body::after` に `content: "";` / `width: 300px;` / `height: 450px;` /
  `background-image: var(--img-stand-url-<id>);` / `background-size: contain;` / `background-repeat: no-repeat;` / `background-position: center;` が出て、
  `content: var(--img-stand-url-` は出ない。
- 背景方式の出力には `描画サイズ 300x450px は立ち絵画像の実サイズから算出。**画像を差し替えたらCSSを出し直すこと**。` が含まれる。
  従来方式の出力には `画像を差し替えたらCSSを出し直すこと` が含まれない(名前ラベル OFF のとき)。
- 幅未指定 + 実寸 600×900 → `width: 600px;` と `height: 900px;` が出る。
- 実寸を渡さない(幅 300 だけ)→ 変更前の出力と完全一致(`content: var(--img-stand-url-` と `width: 300px;` が出て、`background-size` は出ない)。
- 中央アンカー(`anchorX: 'center'`, `anchorY: 'middle'`)で、実寸あり / なしの 2 つの出力から `transform:` を含む行を抜き出すと、同じ配列になる。
- `presetToOptions(p, 600, 900)` → `imageNaturalWidth: 600`, `imageNaturalHeight: 900`。
- `measureNaturalSize('')` → null。
- **既存の `src/lib/generateCss.test.ts` と `src/App.test.tsx` は 1 行も変えずに通る**(実寸の縦を渡していないため従来分岐)。
- 実ブラウザ(Chromium, 1920×1080)で出力CSSを描き、赤一色 600×900 の画像の外形を測る(R1〜R4)。許容誤差 ±1px。

## テストケース
| テスト名 | 置き場(ファイル) | 入力・前提 | 期待値 |
|---|---|---|---|
| `describe('tachieBoxSize')` › `幅指定は縦横比を保って縮める` | `src/lib/generateCss.test.ts` | `(300, 600, 900)` / `(301, 600, 900)` | `{ width: 300, height: 450 }` / `{ width: 301, height: 452 }` |
| `describe('tachieBoxSize')` › `幅未指定・0 は実寸` | `src/lib/generateCss.test.ts` | `(undefined, 600, 900)` / `(0, 600, 900)` | どちらも `{ width: 600, height: 900 }` |
| `describe('tachieBoxSize')` › `実寸がそろわなければ null` | `src/lib/generateCss.test.ts` | `(300, undefined, 900)` / `(300, 600, undefined)` / `(300, 0, 900)` / `(300, 600, 0)` | すべて `null` |
| `describe('背景画像方式')` › `実寸があると背景画像方式で出す(幅指定)` | `src/lib/generateCss.test.ts` | `generateStandaloneCss(USER_A, opts({ width: 300, imageNaturalWidth: 600, imageNaturalHeight: 900 }))` | 上の「テスト」2 項目めの 7 行を `toContain`、`content: var(--img-stand-url-` を `not.toContain` |
| `describe('背景画像方式')` › `背景方式だけ差し替えの注記を出す` | `src/lib/generateCss.test.ts` | `opts({ width: 300, imageNaturalWidth: 600, imageNaturalHeight: 900 })` と `opts({ width: 300 })` | 前者は `描画サイズ 300x450px は立ち絵画像の実サイズから算出。**画像を差し替えたらCSSを出し直すこと**。` を `toContain`、後者は `画像を差し替えたらCSSを出し直すこと` を `not.toContain` |
| `describe('背景画像方式')` › `実寸があると背景画像方式で出す(原寸)` | `src/lib/generateCss.test.ts` | `opts({ width: undefined, imageNaturalWidth: 600, imageNaturalHeight: 900 })` | `width: 600px;` と `height: 900px;` を `toContain` |
| `describe('背景画像方式')` › `実寸が無ければ出力は従来のまま` | `src/lib/generateCss.test.ts` | `opts({ width: 300 })` と `opts({ width: 300, imageNaturalWidth: 600 })`(縦なし) | 2 つの出力が文字列として等しく、`content: var(--img-stand-url-` と `width: 300px;` を含み、`background-size` を含まない |
| `describe('背景画像方式')` › `中央アンカーの transform は方式で変わらない` | `src/lib/generateCss.test.ts` | `opts({ anchorX: 'center', anchorY: 'middle', width: 300 })` と、それに `imageNaturalWidth: 600, imageNaturalHeight: 900` を足したもの | 両出力を行に割って `/^\s*transform:/` に合う行を集めた配列が等しい |
| `describe('presetToOptions')`(既存) › `実寸の縦も渡す` | `src/lib/types.test.ts` | `presetToOptions(base, 600, 900)` | `imageNaturalWidth === 600` かつ `imageNaturalHeight === 900` |
| `describe('measureNaturalSize')` › `空 URL は null` | `src/lib/image.test.ts` | `await measureNaturalSize('')` | `null` |
| `R1 幅300は300×450に収まり、下16pxに付く` | `e2e/render.spec.ts` | 赤一色 600×900 PNG、`width: 300`、左下アンカー、`left: 40`, `bottom: 16`、実寸 600×900 | 外形 左 40 / 幅 300 / 高さ 450 / 下端 1064(= 1080 − 16) |
| `R2 原寸でも下16pxに付く(7px浮かない)` | `e2e/render.spec.ts` | R1 の `width` を `undefined` | 外形 幅 600 / 高さ 900 / 下端 1064 |
| `R3 右下アンカー距離0で画面内に収まる` | `e2e/render.spec.ts` | `width: 300`、`anchorX: 'right'`, `anchorY: 'bottom'`, `left: 0`, `bottom: 0` | 外形 右端 1920 / 下端 1080 / 幅 300 / 高さ 450 |
| `R4 中央アンカーで中心に来る` | `e2e/render.spec.ts` | `width: 300`、`anchorX: 'center'`, `anchorY: 'middle'`, `left: 0`, `bottom: 0` | 外形の中心 x = 960、y = 540 |

### `e2e/render.spec.ts` の組み立て(R1〜R4 共通)
1. `page.setContent('<html><body></body></html>')` のあと `page.evaluate` で `<canvas width=600 height=900>` を `#ff0000` で塗り、`toDataURL('image/png')` を受け取る。
2. Node 側で `import { generateStandaloneCss } from '../src/lib/generateCss'` と `import { DEFAULT_OPTIONS } from '../src/lib/types'` を使い、
   `{ ...DEFAULT_OPTIONS, alwaysShow: true, hideWhenAway: false, dimWhenQuiet: false, nameLabel: { ...DEFAULT_OPTIONS.nameLabel, show: false }, ...ケースの値 }` で CSS を作る。
   ユーザーは `{ id: '42', name: 'render-test', imageUrl: <1 の data URI> }`(実在の Discord ID や、それらしい桁数の数字を使わない。`src/lib/generateCss.test.ts` の `USER_A` と同じ形)。
3. `page.setContent` で `<style>html{background:#ffffff}</style><style>${css}</style>` と空の `<body>` を読み込む。
4. `page.screenshot()`(1920×1080)の PNG を base64 にして `page.evaluate` へ渡し、`Image` → `canvas` → `getImageData` で
   `r > 200 && g < 60 && b < 60` の画素の外接矩形 `{ left, top, right, bottom }`(right / bottom は最後の画素 + 1)を返す。
   背景画像の描画が撮影に間に合わないことがあるので、3〜4 は `expect.poll`(タイムアウト 5000ms)で
   「外形の幅が 0 より大きい」まで撮り直す。
5. 期待値との差が 1px 以内であることを `expect(Math.abs(実測 - 期待)).toBeLessThanOrEqual(1)` で見る。

## 実装ブロック
| ブロック | 対象タスク | 触るファイル | 確認コマンド |
|---|---|---|---|
| B1 | T1 | `src/lib/generateCss.ts`, `src/lib/types.ts`, `src/lib/generateCss.test.ts`, `src/lib/types.test.ts` | `npm run typecheck && npx vitest run src/lib` |
| B2 | T2 | `src/lib/image.ts`, `src/lib/image.test.ts`, `src/ui/useImageNaturalWidth.ts`(削除), `src/ui/useImageNaturalSize.ts`(新規), `src/App.tsx`, `src/ui/OutputPanel.tsx` | `npm run typecheck && npm run lint && npx vitest run` |
| B3 | T3 | `package.json`, `package-lock.json`, `playwright.config.ts`(新規), `e2e/render.spec.ts`(新規), `tsconfig.json`, `.gitignore` | `npx playwright install chromium && npx playwright test` |

## 依存 / 前提
- B2 と B3 は B1 の後(`GenerateOptions.imageNaturalHeight` と背景方式の出力を使う)。B2 と B3 は互いに独立。
- 003(`specs/003-position-anchor`)は main にマージ済み。`composeTransform` / `placementDecls` はそのまま使う。
- 初回の `npx playwright install chromium` はブラウザ本体をダウンロードする(ネットワークが要る)。

## リスク / 降りる箇所
- **OBS 実機の確認(T4)の下準備はエージェントが行う**(キットはリポジトリの外で git 管理も無いので、実装ブロックには入れない):
  1. OBS 確認キット(置き場はナレッジ `projects/obs-tachie-generator.md` の「OBS 実機確認を機械化する」節)の `verify/gen-css.ts` の `base()` に `imageNaturalWidth: 600, imageNaturalHeight: 900` を足す
     (画像 `assets-003/01-anchor-no-padding.png` は 600×900。足さないと実装後も従来方式の CSS が出て、確認にならない)。
  2. 同ファイルの `width: undefined` 行のコメント「幅指定は rail #621 の別バグがあるので既定では使わない」を「原寸」だけにする。
  3. `git -C <このリポジトリのチェックアウト> fetch origin` のあと、`node gen-css.mjs origin/004-image-width-render`
     (集約ブランチ。main へマージ済みなら `node gen-css.mjs main`)で CSS を作る。
- **OBS 実機の確認(T4)は人が行う**: OBS を起動し WebSocket を有効にした状態で、同じフォルダで `node run-a-checks.mjs` を実行し、
  `a1` の下端が 16px、`a1-width300` の外形が 300×450 になっているかを出力で見る。
- B3 で `e2e/render.spec.ts` から `../src/lib/generateCss` の読み込みが失敗したら(Playwright の TypeScript 読み込みが拡張子なしの
  import をたどれない)、`src/` を書き換えずに B3 を止めて報告する。
- `npx playwright install chromium` がネットワーク不通で失敗したら、B3 を止めて報告する(テストを消して緑にしない)。
- 既存の `src/lib/generateCss.test.ts` を書き換えないと通らない状態になったら、実装を止めて報告する
  (「実寸が無いときは出力不変」の前提が崩れている)。
