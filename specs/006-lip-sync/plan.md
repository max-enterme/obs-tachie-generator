---
feature: lip-sync
test: npm run typecheck && npm run lint && npx vitest run && npx playwright install chromium && npx playwright test
---

# 実装計画 — 口パク(話している間だけ口開きの絵と交互に切り替える)

> plan.md — 「どう作るか」。spec.md の受け入れ条件を満たす設計。
> `test` は 004 と同じ形(単体テスト + Playwright)。画面の見た目・OBS 実機は人手(T5)。

## アプローチ
- **口開き絵は `Preset` に任意の 2 フィールドで足す**(`mouthImageUrl` / `mouthIntervalMs`)。未指定=従来どおり。
  003 のアンカーと同じ流儀(任意フィールド + `resolve*` に既定の解決を集約 + `normalizePreset` で欠損を既定へ倒す + 保存キーのバージョンは上げない)。
- **出力は `body::after` の `background-image` を `@keyframes` で切り替える**。擬似要素を増やさない(002 の「立ち絵1枚+名前1つ」を守る)。
  `background-image` の 2 値間は Chromium が**クロスフェードで補間する**ので、`animation-timing-function: steps(1, end)` で補間させず離散に切り替える。
  `alternate` は使わない(往復ではなく、keyframe の 0%→50%→100% で閉じ→開き→閉じ)。
- **既存の発話演出と同じ発話中ルールに `animation` を足す**(`animation` はカンマ区切りで複数並べられ、口パクは `background-image`、ぴょこぴょこは `transform`/`bottom`、枠・後光は `filter`、点滅は `opacity` と**プロパティが重ならない**ので併用できる)。
- **背景方式(実サイズが測れているとき)でだけ出す。** 従来の `content: var(...)` 方式は画像の切替を持たないため。実サイズが測れないときは口パクを出さず、出力パネルで知らせる(`alignUnavailable` と同じ流儀 = 設定が黙って消えない)。
- 口開き絵は**立ち絵と同じ縦横比・同じ構図で用意する前提**。箱の大きさは立ち絵の実サイズで決まり、口開き絵は `background-size: contain` + 中央で収まる。縦横比が違うときは画面で警告するだけ(自動補正はしない)。
- 純粋な判定(縦横比の差)は `src/lib/mouth.ts` に置く(005 の `speakMargin.ts` と同じ「純粋関数 + UI は表示だけ」)。
- 並べ方: データ層(B1)→ CSS 生成(B2)/ 画面(B3)は B1 の後で互いに独立 → 実ブラウザ(B4)は B2 の後。

## 変更点
| 対象(ファイル / 関数) | 変更 |
|---|---|
| `src/lib/types.ts:2` `interface TachieUser` | `mouthImageUrl?: string` を足す(口開き絵。空・未指定なら口パクなし) |
| `src/lib/types.ts:132` `interface GenerateOptions`(`imageNaturalHeight?` の直後 :167) | `mouthIntervalMs?: number` を足す |
| `src/lib/types.ts:190` `interface Preset`(`nameLabel` の直後 :214) | `mouthImageUrl?: string` と `mouthIntervalMs?: number` を足す |
| `src/lib/types.ts:251` `presetToOptions` | 返すオブジェクトに `mouthIntervalMs: p.mouthIntervalMs` を足す |
| `src/lib/types.ts:273` `renderUser` | 返すオブジェクトに `mouthImageUrl: p.mouthImageUrl \|\| undefined` を足す |
| `src/lib/types.ts:301` `resetPresetOptions` | `{ ...makeDefaultPreset(p.id), name: p.name, imageUrl: p.imageUrl, mouthImageUrl: p.mouthImageUrl }`(口開き絵は画像側として保持。周期は既定に戻る) |
| `src/lib/types.ts` の `DEFAULT_SPEAK`(:341)の直前 | 定数 `DEFAULT_MOUTH_INTERVAL_MS` / `MIN_MOUTH_INTERVAL_MS` と関数 `resolveMouthIntervalMs` を足す(003 の `resolveAnchorX` と同じ置き方) |
| `src/lib/state.ts:153` `normalizePreset` の `nameLabel: normalizeNameLabel(o.nameLabel),` の直後 | `mouthImageUrl` / `mouthIntervalMs` を検証して足す(下の「新規インターフェース」) |
| `src/lib/mouth.ts`(新規) | `mouthAspectNote` を置く |
| `src/lib/generateCss.ts:1-` の `from './types'` の import | `resolveMouthIntervalMs` を足す |
| `src/lib/generateCss.ts:498` `rootBlock` | 第 2 引数 `withMouth = false` を足し、true かつ `u.mouthImageUrl` があれば立ち絵の行の次に `--img-mouth-url-<id>` の行を出す。`generateCombinedCss`(:666)の呼び出しは変えない |
| `src/lib/generateCss.ts:462-480` `KEYFRAMES_BLINK` の直後 | `KEYFRAMES_MOUTH(id)` を足す(`KEYFRAMES_BLINK` と同じ「文字列を返す const」。下の「新規インターフェース」) |
| `src/lib/generateCss.ts:557-562`(`generateStandaloneCss` の `box` を決める行の直後) | `const mouthOn = box != null && (user.mouthImageUrl ?? '').trim() !== ''` を足す |
| `src/lib/generateCss.ts:597` `rootBlock([user])` | `rootBlock([user], mouthOn)` にする |
| `src/lib/generateCss.ts:609-624` 発話中ルール | 条件を `effects.length > 0 \|\| dimWhenQuiet \|\| mouthOn` に。`animation:` は `[effects があれば animationValue(...), mouthOn なら口パクの 1 項目].join(',')` で組む |
| `src/lib/generateCss.ts:649` `...keyframeBlocks(effects, speak, 'transform', pos.transforms),` の直後 | `...(mouthOn ? [KEYFRAMES_MOUTH(id)] : []),` を足す |
| `src/ui/MouthImageField.tsx`(新規) | 口パクの設定欄(口開き絵の設定・外す・周期・警告) |
| `src/ui/PresetPanel.tsx:482` `<div className="subhead">名前表示</div>` の直前 | `<MouthImageField preset={editing} maxWidth={maxWidth} onChange={onChange} />` を置く。import を足す |
| `src/ui/TachiePreview.tsx:93` の `useEffect`(`naturalW` リセット)の後 | 次の 3 つを足す。(1) `const [mouthOpen, setMouthOpen] = useState(false)`。(2) `useEffect`: `const mouthUrl = (preset?.mouthImageUrl ?? '').trim()` とし、`effectiveSpeaking && mouthUrl !== ''` のときだけ `const t = window.setInterval(() => setMouthOpen((o) => !o), resolveMouthIntervalMs(preset?.mouthIntervalMs) / 2)`、cleanup は `window.clearInterval(t); setMouthOpen(false)`。依存配列は `[effectiveSpeaking, preset?.mouthImageUrl, preset?.mouthIntervalMs]`(`resolveMouthIntervalMs` は `../lib/types` から import)。(3) `<img>`(:265-271)の `src` を `mouthOpen && mouthUrl !== '' ? preset.mouthImageUrl : preset.imageUrl` にする(`mouthUrl` は描画側でも同じ式で求める。プリセットが変わって口開き絵が無くなっても空にならない)。`onLoad`(:270)は `e.currentTarget.getAttribute('src') === preset.imageUrl` のときだけ `setNaturalW`(切替が速くて load の順序が入れ替わっても口開き絵の幅で上書きしない) |
| `src/ui/OutputPanel.tsx:45` `alignUnavailable` の直後 | `const mouthUnavailable = (preset?.mouthImageUrl ?? '').trim() !== '' && tachieBoxSize(preset?.width ?? undefined, imageNaturalWidth ?? undefined, imageNaturalHeight ?? undefined) === null`(`generateCss` の `mouthOn` と同じ条件)を足し、既存の注意(:63-64)と同じ形の `<p className="hint" style={{ color: 'var(--warn)' }} role="status">` を足す。`tachieBoxSize` は `../lib/generateCss` から import(export 済み) |
| `src/lib/types.test.ts` / `src/lib/state.test.ts` / `src/lib/mouth.test.ts`(新規)/ `src/lib/generateCss.test.ts` / `src/ui/TachiePreview.test.tsx`(新規)/ `src/App.test.tsx` / `e2e/render.spec.ts` | 下の「テストケース」 |

変更しないもの: `src/lib/crop.ts` / `src/ui/CropEditor.tsx`(トリミングは立ち絵だけ)、`src/index.css`(新しい CSS は足さない。既存の `field` / `row` / `thumb` / `small.why` / `hint` を使う)、`src/App.tsx`、`DEFAULT_OPTIONS` / `DEFAULT_SPEAK` の値、`generateCombinedCss`。

## 新規インターフェース
```ts
// src/lib/types.ts
/** 口パクの周期(ms)の既定。口閉じ→口開き→口閉じの 1 往復の長さ。 */
export const DEFAULT_MOUTH_INTERVAL_MS = 300
/** 口パクの周期(ms)の下限。これ未満は丸める。 */
export const MIN_MOUTH_INTERVAL_MS = 50
/** 未指定・非数・0 以下 → 300。1〜49 → 50。それ以外はそのまま。 */
export function resolveMouthIntervalMs(v?: number): number
//   v === undefined / NaN / Infinity / 0 以下 → DEFAULT_MOUTH_INTERVAL_MS
//   0 < v < 50 → MIN_MOUTH_INTERVAL_MS
//   それ以外 → v

// TachieUser    += mouthImageUrl?: string      // 口開き絵。空・未指定なら口パクなし
// GenerateOptions += mouthIntervalMs?: number  // 未指定は resolveMouthIntervalMs が 300 にする
// Preset        += mouthImageUrl?: string; mouthIntervalMs?: number
```
```ts
// src/lib/state.ts normalizePreset が足す 2 行(未指定・不正は undefined)
mouthImageUrl:
  typeof o.mouthImageUrl === 'string' && o.mouthImageUrl.trim() !== '' ? o.mouthImageUrl : undefined,
mouthIntervalMs:
  typeof o.mouthIntervalMs === 'number' && Number.isFinite(o.mouthIntervalMs) && o.mouthIntervalMs > 0
    ? o.mouthIntervalMs
    : undefined,
```
```ts
// src/lib/mouth.ts
import type { Dimensions } from './image'

/** 縦横比の差がこの割合(1%)を超えたら警告する。 */
export const MOUTH_ASPECT_TOLERANCE = 0.01

/**
 * 口開き絵の縦横比が立ち絵と違うときの警告文。どちらかが測れていなければ null(何も出さない)。
 * 差 = |立ち絵の幅/高さ − 口開き絵の幅/高さ| / (立ち絵の幅/高さ)。
 */
export function mouthAspectNote(base: Dimensions | null, mouth: Dimensions | null): string | null
// 差 > MOUTH_ASPECT_TOLERANCE → `口開き絵の縦横比が立ち絵と違います（立ち絵 ${bw}×${bh} / 口開き ${mw}×${mh}）。口開き絵は立ち絵の枠に収めて中央に出します。`
// それ以外 → null
```
```ts
// src/lib/generateCss.ts(export しない const。KEYFRAMES_BLINK と同じ置き方)
const KEYFRAMES_MOUTH = (id: string) => `/* 口パク：話している間だけ立ち絵（口閉じ）と口開き絵を交互に出す。口開き絵は立ち絵と同じ縦横比で用意すること */
@keyframes speak-mouth {
  0% { background-image: var(--img-stand-url-${id}); }
  50% { background-image: var(--img-mouth-url-${id}); }
  100% { background-image: var(--img-stand-url-${id}); }
}`
// 発話中ルールの animation に並べる 1 項目:
//   `${resolveMouthIntervalMs(options.mouthIntervalMs)}ms infinite steps(1, end) speak-mouth`
```
```tsx
// src/ui/MouthImageField.tsx
interface Props {
  /** 編集中のプリセット。 */
  preset: Preset
  /** 埋め込み最大幅(px)。PresetPanel の `pr-maxw` と同じ値(0 で原寸)。 */
  maxWidth: number
  onChange: (preset: Preset) => void
}
export default function MouthImageField({ preset, maxWidth, onChange }: Props): JSX.Element
```
要素の id: ファイル入力 `pr-mouth-file` / URL 入力 `pr-mouth-url` / 周期 `pr-mouth-ms`。
ボタン名(**既存の App テストは `getByRole('button', { name: '画像URL' })`・`getByLabelText(/画像URL/)`・`getByLabelText(/表示名/)` で引くので、口開き側は同じ語を単独で使わない**): `口開き絵: アップロード` / `口開き絵: 画像URL`(`aria-pressed` の切替)/ `口開き絵のURLを反映` / `口開き絵を外す`。ラベル: URL 入力は `口開き絵のURL`、ファイル入力は `口開き絵のアップロード`、周期は `口パクの周期(ms)`。`aria-label` / `title` に `画像URL` を含めない。
挙動の決め(テストが前提にする):
- 入力方式の既定は **URL**(立ち絵側と同じ。`useState<'upload' | 'url'>('url')`)。URL 入力欄は `type="url"`、`resolveImageSource(value, 'auto', …)` の `note` / `warning` を成功メッセージに使う。
- 成功メッセージ: URL → `口開き絵を設定しました（${resolved.note}）。`(warning があれば `${resolved.note}／⚠️ ${resolved.warning}` を続ける)/ アップロード → `口開き絵を設定しました（data URI 埋め込み）。`。失敗は `画像の読み込みに失敗しました。`、8MB 超は `画像が大きすぎます（8MB まで）。`(立ち絵側と同じ文言)。
- 周期の欄の値は**生値**(`preset.mouthIntervalMs ?? DEFAULT_MOUTH_INTERVAL_MS`)を表示する(`resolveMouthIntervalMs` を通すと「120」を打つ途中の「1」が 50 に化けて打てない)。入力が空文字なら `mouthIntervalMs: undefined` を保存、それ以外は `Number(value)`。
- 無効化: 立ち絵(`preset.imageUrl`)が空なら、モード切替・ファイル入力・URL 入力・反映ボタン・周期を `disabled`。`口開き絵を外す` は**口開き絵があるときだけ有効**(立ち絵の有無に関係なく。立ち絵を消した後に口開き絵が黙って残って復活するのを避ける)。立ち絵があり口開き絵が空なら周期だけ `disabled`(補足 `口開き絵を設定すると使えます`)。
- 「口開き絵を外す」は `mouthImageUrl` と `mouthIntervalMs` を両方 `undefined` にする(周期は既定に戻る)。周期の `<input type="number">` は `min={50}` `step={10}`。口開き絵のサムネ `<img>` の `alt` は `口開き絵`。
- 警告の出し方: 立ち絵未設定の案内は `<p className="hint" style={{ color: 'var(--warn)' }} role="status">`、縦横比の警告は `<p className="hint" style={{ color: 'var(--danger)' }} role="alert">`(`small.why` は `.field > label` の中でしか色が付かないので使わない)。周期の補足だけ `label` の中の `<small>`。
内部では `fileToDataUri(file, { maxWidth: maxWidth > 0 ? maxWidth : undefined })` と `resolveImageSource(value, 'auto', maxWidth > 0 ? maxWidth : undefined)`、`useImageNaturalSize` を、立ち絵側(`PresetPanel.tsx:114-148`)と同じ呼び方で使う。

## 採らない案
- **口だけの画像を立ち絵に重ねる** — 重ねるには擬似要素がもう 1 つ要るが `::before`(名前)/ `::after`(立ち絵)で使い切っている(002)。
- **`animation-direction: alternate` で往復させる** — `alternate` は 2 周期で 1 往復になり、`steps(1, end)` と組むと切替の位置がずれる。0%/50%/100% を明示するほうが周期の意味(閉じ→開き→閉じの 1 往復)が一目で分かる。
- **補間をそのまま使う(クロスフェード)** — 口パクがぼやけて「切り替わる」より「溶ける」見た目になる。`steps(1, end)` で離散にする。
- **口開き絵を `Preset.speak` の中に入れる** — `speak` は「動き」の設定(bounce/outline/blink)で、画像は持たない。画像は `Preset.imageUrl` と同じ層(`Preset` 直下)に置く。003 の「画像の複数登録は別フィーチャー」とも矛盾しない(口パクは「立ち絵のもう 1 枚」であってユーザーごとの複数画像ではない)。
- **口パクの ON/OFF のチェックを別に持つ** — 口開き絵が設定されていれば ON、外せば OFF とする。状態が 1 つで済み、「ON なのに絵が無い」を作れない。
- **口開き絵にもトリミングを掛ける** — 立ち絵だけを切り抜くと構図がずれるが、口開き絵に同じ矩形を自動で掛けるには寸法が一致する前提が要り、不一致の扱いが増える。縦横比の警告で知らせるにとどめる(spec のスコープ外)。
- **実サイズが測れないときも `content` 方式で口パクを出す** — `content` は 2 値の離散切替が `@keyframes` で保証されない(`content` の補間は仕様上不定)。測れない状態は読み込み中・読めない URL なので、出さずに注意を出す。
- **プレビューを `@keyframes` で切り替える** — プレビューは `<img>` 1 枚で、既に ぴょこぴょこ/点滅 の keyframe が `transform`/`opacity` を使う。画像の入れ替えは `src` の差し替えのほうが衝突しない(出力CSSとは実装が違うが、見た目は同じ周期・同じ順序)。
- **口開き絵の寸法を `GenerateOptions` に足して箱を 2 枚分で決める** — 箱は立ち絵基準のまま。口開き絵は `contain` で収める。口開き絵の実寸は画面の警告にだけ使う(出力CSSには入れない)。

## 確定値
モック: ダッシュボード Pages の `obs-tachie-generator/006-lip-sync-mock.html`。2026-10-31 に MAX が「この形でOK」と確定済み。実装はこの表を読む(モックは見ない)。

| 項目 | 値 |
|---|---|
| 置き場 | 「発話演出」節の直後・「名前表示」節の直前(`PresetPanel.tsx:482` の直前) |
| 小見出し | `口パク（任意）` |
| 説明 | `話している間だけ、立ち絵と『口開き』の絵を交互に切り替えます。声の大きさには連動しません。` |
| 常に出す注意(`small`) | `立ち絵と同じ縦横比・同じ構図で用意してください（立ち絵だけを切り抜くとズレます）` |
| 周期の欄 | **(変更 C1 で置き換え)** ~~ラベル `口パクの周期(ms)`、補足 `口閉じ→口開き→口閉じの1往復の長さ`、`min=50`、既定 300~~ |
| 縦横比の警告 | `mouthAspectNote` の文言(上)。危険色の `<p className="hint" style={{ color: 'var(--danger)' }} role="alert">` |
| 立ち絵が未設定のとき | 欄は全部無効、注意色の `<p>` に `先に上の「立ち絵画像」を設定してください` |
| 口開き絵が未設定のとき | 周期の欄は無効、補足 `口開き絵を設定すると使えます` |
| 出力パネルの注意 | `口パクは出力CSSに入りません（立ち絵の実サイズが測れていません。画像が読み込めているか確認してください）` |
| プレビューの切替 | 発話中だけ、周期の半分(例: 300ms なら 150ms)ごとに `src` を 立ち絵⇄口開き絵。**近似**: 縦横比が違う口開き絵は出力CSS(`contain` で収める)と違い、プレビューでは引き伸ばして出る(警告で知らせる) |

## テスト
- `resolveMouthIntervalMs`: 未指定 → 300 / 0・負・NaN → 300 / 10 → 50 / 50 → 50 / 120 → 120。
- `mouthAspectNote`: 同じ縦横比(600×900 と 300×450)→ null / 差が 1% 以内(600×900 と 600×905)→ null / 違う(600×900 と 600×600)→ 警告文 / どちらかが null → null。
- `normalizePreset`: 口パクのフィールドが無い旧データ → `mouthImageUrl` / `mouthIntervalMs` が undefined / 空白のみ・数値・オブジェクトの `mouthImageUrl` → undefined / 正しい値はそのまま。
- `presetToOptions` / `renderUser` / `resetPresetOptions` が口パクの値を渡す・保持する。
- `generateCss`: 口開き絵 + 実サイズあり → `--img-mouth-url-<id>`・`@keyframes speak-mouth`・発話中の `animation` に口パクが入る / 演出を全部 OFF でも口パクだけで発話中ルールが出る / 実サイズなし → 口パクは一切入らない / 口開き絵なし・空白 → 従来と完全一致 / 周期が反映される / `dimWhenQuiet` と併用できる / `generateCombinedCss` には出ない。
- 画面(App): 口開き絵を URL で設定 → サムネが出て周期の欄が有効に / 「口開き絵を外す」で戻る / 立ち絵が無いと欄が無効 / 縦横比が違うと警告(jsdom は画像の寸法を測れないので `measureNaturalSize` をモックして寸法を与える)/ 実サイズが測れないと出力パネルに注意。
- プレビュー: 発話にすると周期の半分ごとに `src` が入れ替わり、静かにすると立ち絵に戻る。
- 実ブラウザ(Chromium): 静止時は立ち絵だけ / 発話中の周期の前半は立ち絵・後半は口開き絵 / ぴょこぴょこ + 枠・後光を ON にしていても同じ。
- `src/lib/generateCss.test.ts` の既存テスト(非退行の完全一致 `:828-868` を含む)は無修正で緑。

## テストケース
共通の前提(`src/lib/generateCss.test.ts`): `const MOUTH_USER: TachieUser = { ...USER_A, mouthImageUrl: 'data:image/png;base64,MMMMNNNN' }`、実サイズ付きの `opts({ imageNaturalWidth: 600, imageNaturalHeight: 900, ... })`。`USER_A.id` = `123456789012345678`。

| テスト名 | 置き場(ファイル) | 入力・前提 | 期待値 |
|---|---|---|---|
| `describe('resolveMouthIntervalMs')` › `M1 既定・下限・そのまま` | `src/lib/types.test.ts` | `undefined` / `0` / `-5` / `NaN` / `10` / `50` / `120` | `300` / `300` / `300` / `300` / `50` / `50` / `120` |
| `describe('presetToOptions')` › `M2 口パクの周期を渡す` | `src/lib/types.test.ts` | `presetToOptions({ ...base, mouthIntervalMs: 120 })` と `presetToOptions(base)` | `.mouthIntervalMs` が `120` と `undefined` |
| `describe('renderUser')` › `M3 口開き絵を渡し、空は undefined` | `src/lib/types.test.ts` | `renderUser(user, { ...base, mouthImageUrl: 'data:x' })` / `renderUser(user, { ...base, mouthImageUrl: '' })` / `renderUser(user, base)` | `.mouthImageUrl` が `'data:x'` / `undefined` / `undefined` |
| `describe('既定プリセット')` › `M4 resetPresetOptions は口開き絵を保持し周期は既定へ` | `src/lib/types.test.ts` | `resetPresetOptions({ ...makeDefaultPreset('p1'), imageUrl: 'data:a', mouthImageUrl: 'data:b', mouthIntervalMs: 120 })` | `.mouthImageUrl` が `'data:b'`、`.mouthIntervalMs` が `undefined`、`.imageUrl` が `'data:a'` |
| `describe('normalizeState')` › `M5 口パクの無い旧データは口パクなし` | `src/lib/state.test.ts` | `normalizeState({ users: [], presets: [{ id: 'p1' }] })` | `presets[0].mouthImageUrl` と `presets[0].mouthIntervalMs` が `undefined` |
| `describe('normalizeState')` › `M6 口パクの不正値は落とし、正しい値は残す` | `src/lib/state.test.ts` | presets に `{ id: 'a', mouthImageUrl: '   ', mouthIntervalMs: 0 }` / `{ id: 'b', mouthImageUrl: 5, mouthIntervalMs: 'x' }` / `{ id: 'c', mouthImageUrl: 'data:m', mouthIntervalMs: 120 }` | a・b は両方 `undefined`。c は `'data:m'` と `120` |
| `describe('mouthAspectNote')` › `M7 縦横比が同じなら出さない` | `src/lib/mouth.test.ts` | `({600,900}, {300,450})` / `({600,900}, {600,905})` | どちらも `null` |
| `describe('mouthAspectNote')` › `M8 違うときだけ警告` | `src/lib/mouth.test.ts` | `({width:600,height:900}, {width:600,height:600})` | `口開き絵の縦横比が立ち絵と違います（立ち絵 600×900 / 口開き 600×600）。口開き絵は立ち絵の枠に収めて中央に出します。` |
| `describe('mouthAspectNote')` › `M9 測れていなければ出さない` | `src/lib/mouth.test.ts` | `(null, {600,900})` / `({600,900}, null)` / `(null, null)` | すべて `null` |
| `describe('口パク')` › `M10 口開き絵と実サイズがあれば変数・keyframe・animation が入る` | `src/lib/generateCss.test.ts` | `generateCss([MOUTH_USER], opts({ imageNaturalWidth: 600, imageNaturalHeight: 900 }))`(既定の演出: ぴょこぴょこ+枠・後光) | `--img-mouth-url-123456789012345678: url("data:image/png;base64,MMMMNNNN");` を含む / `@keyframes speak-mouth {` と `0% { background-image: var(--img-stand-url-123456789012345678); }` と `50% { background-image: var(--img-mouth-url-123456789012345678); }` を含む / `animation: 750ms infinite alternate ease-in-out speak-jump,750ms infinite alternate ease-in-out speak-light,300ms infinite steps(1, end) speak-mouth;` を含む |
| `describe('口パク')` › `M11 演出を全部 OFF でも口パクだけで発話中ルールが出る` | `src/lib/generateCss.test.ts` | `opts({ imageNaturalWidth: 600, imageNaturalHeight: 900, speak: { bounce: false, outline: false, blink: false } })` | `animation: 300ms infinite steps(1, end) speak-mouth;` を含む / `speak-jump` と `speak-light` を含まない / `body:has(img[src*="avatars/123456789012345678"][class*="Voice_avatarSpeaking__"])::after` を含む |
| `describe('口パク')` › `M12 実サイズが無ければ口パクは入らない` | `src/lib/generateCss.test.ts` | `generateCss([MOUTH_USER], opts())`(実サイズなし)と `opts({ imageNaturalWidth: 600 })`(縦なし) | どちらも `img-mouth-url` と `speak-mouth` を含まない |
| `describe('口パク')` › `M13 口開き絵が空・空白なら従来と完全一致` | `src/lib/generateCss.test.ts` | `const o = opts({ imageNaturalWidth: 600, imageNaturalHeight: 900 })`、`generateCss([{ ...USER_A, mouthImageUrl: '  ' }], o)` と `generateCss([{ ...USER_A, mouthImageUrl: undefined }], o)` と `generateCss([USER_A], o)`。**B2 の最初の作業として、コードを変える前にこのテストを書いて緑にする** | 3 つが `toBe` で同一。かつ `generateCss([USER_A], o)` が下の「M13 の期待リテラル」(口パク追加前の main の出力そのもの)と `toBe` で一致する(背景方式 + 発話中ルールの経路はリテラルの完全一致が今まで無い) |
| `describe('口パク')` › `M14 周期が反映され、下限で丸まる` | `src/lib/generateCss.test.ts` | `mouthIntervalMs` を `120` / `10` / 未指定にして M10 の前提で生成 | `120ms infinite steps(1, end) speak-mouth` / `50ms infinite steps(1, end) speak-mouth` / `300ms infinite steps(1, end) speak-mouth` を含む |
| `describe('口パク')` › `M15 静かな人を暗くする設定と併用できる` | `src/lib/generateCss.test.ts` | M11 の前提 + `dimWhenQuiet: true` | 発話中ルールに `filter: brightness(100%);` と `speak-mouth` の両方を含む |
| `describe('口パク')` › `M16 まとめ版には出さない` | `src/lib/generateCss.test.ts` | `generateCombinedCss([MOUTH_USER], opts())` | `img-mouth-url` と `speak-mouth` を含まない |
| `describe('TachiePreview 口パク')` › `M17 発話中だけ周期の半分ごとに絵が入れ替わる` | `src/ui/TachiePreview.test.tsx` | `vi.useFakeTimers()`。`render(<TachiePreview preset={{ ...makeDefaultPreset('p1'), imageUrl: 'data:A', mouthImageUrl: 'data:B', mouthIntervalMs: 300 }} />)`。`getByRole('button', { name: /立ち絵プレビュー/ })` をクリックして発話にし、`act(() => vi.advanceTimersByTime(150))` を 2 回 | 発話前の `<img>` の `src` は `data:A`。発話直後は `data:A`。150ms 後 `data:B`、さらに 150ms 後 `data:A`。もう一度クリックして静かにすると `data:A` のまま `advanceTimersByTime(300)` しても動かない |
| `describe('TachiePreview 口パク')` › `M18 口開き絵が無ければ入れ替わらない` | `src/ui/TachiePreview.test.tsx` | M17 と同じ操作で `mouthImageUrl` なし | 発話中 600ms 進めても `src` は `data:A` のまま |
| `describe('TachiePreview 口パク')` › `M18b 周期は resolveMouthIntervalMs を通した値の半分` | `src/ui/TachiePreview.test.tsx` | M17 と同じ前提で `mouthIntervalMs: 10`。発話にして `advanceTimersByTime(24)` → `advanceTimersByTime(1)` | 24ms 時点では `src` が `data:A`、25ms 時点で `data:B`(10 → 50 に丸めた半分 = 25ms。出力CSSの 50ms と一致) |
| `describe('TachiePreview 口パク')` › `M18c 発話中にプリセットが変わっても src が空にならない` | `src/ui/TachiePreview.test.tsx` | M17 の前提で発話にして 150ms 進め(`data:B` の状態)、`rerender` で `preset` を `{ ...makeDefaultPreset('p2'), imageUrl: 'data:C' }`(口開き絵なし)に替える | `<img>` の `src` は `data:C`(空でも `data:B` でもない) |
| `M19 口開き絵を設定・外せる` | `src/App.test.tsx` | 既存の `addPresetWithImage('data:image/png;base64,AAAA')` の後(画面は ②。口開き絵欄の入力方式は既定で URL)。`getByLabelText('口開き絵のURL')` に `data:image/png;base64,BBBB` を入れ、`getByRole('button', { name: '口開き絵のURLを反映' })` をクリック → `await findByText(/口開き絵を設定しました/)`。続けて `getByRole('button', { name: '口開き絵を外す' })` をクリック | 反映後 `getByLabelText(/口パクの周期/)` が `toBeEnabled`、`getByRole('button', { name: '口開き絵を外す' })` が `toBeEnabled`。外した後は `getByLabelText(/口パクの周期/)` が `toBeDisabled` で、`getByRole('button', { name: '口開き絵を外す' })` も `toBeDisabled` |
| `M20 立ち絵が未設定なら口開き絵の欄は使えない` | `src/App.test.tsx` | ①→②へ進み「新規プリセット」を押しただけ(画像なし) | `getByText(/先に上の「立ち絵画像」を設定してください/)` が居る。`getByLabelText('口開き絵のURL')`・`getByRole('button', { name: '口開き絵のURLを反映' })`・`getByLabelText(/口パクの周期/)` がすべて `toBeDisabled` |
| `M21 実サイズが測れないときだけ出力パネルに注意` | `src/App.test.tsx` | **2 つの `it` に分ける**。(a) `addPresetWithImage(...)` のあと口開き絵を設定せずに `getByRole('button', { name: /次へ/ })` で ③ へ。(b) `addPresetWithImage(...)` のあと M19 と同じ手順で口開き絵を設定し、`getByRole('button', { name: /次へ/ })` で ③ へ(jsdom は画像の寸法を測れないので実サイズは `null` のまま) | (a) `queryByText(/口パクは出力CSSに入りません/)` が `null`。(b) `getByText(/口パクは出力CSSに入りません/)` が居て、`getByRole('heading', { name: /出力 CSS/ }).closest('.panel')` 内の textbox の `value` に `speak-mouth` を含まない |
| `M22 縦横比が違うと警告` | `src/App.mouth.test.tsx`(新規) | このファイルは `App.test.tsx` の `beforeEach` / `afterEach`(`localStorage.clear()` と `cleanup()`)と `addPresetWithImage` を**自前で複製**して持つ(未 export のため)。先頭で `vi.mock('./lib/image', async (orig) => ({ ...(await orig<typeof import('./lib/image')>()), measureNaturalSize: async (u: string) => (u.endsWith('AAAA') ? { width: 600, height: 900 } : { width: 600, height: 600 }) }))`。`addPresetWithImage('data:image/png;base64,AAAA')` のあと M19 と同じ手順で `data:image/png;base64,BBBB` を口開き絵に設定 | `await findByText(/口開き絵の縦横比が立ち絵と違います（立ち絵 600×900 / 口開き 600×600）/)` が出る。口開き絵を `data:image/png;base64,AAAA`(同じ縦横比)にした場合はこの文が出ない |
| `R5 発話中は周期の前半が立ち絵・後半が口開き絵になる` | `e2e/render.spec.ts` | 立ち絵=赤 600×900 / 口開き=青 600×900 の PNG(canvas で作る)。`mouthIntervalMs: 400`、`speak: { ...DEFAULT_SPEAK, bounce: false, outline: false }`、`imageNaturalWidth: 600, imageNaturalHeight: 900`。`page.setContent` に出力CSS + `<img src="http://127.0.0.1:9/avatars/42.png" class="Voice_avatarSpeaking__x">`(`user.id` は `42`)。`document.getAnimations()` から `animationName === 'speak-mouth'` を取り `pause()` して `currentTime` を **40・190(前半: 10%・47%)** と **240・390(後半: 60%・97%)** にし、それぞれ `expect.poll` で期待色が見つかるまで撮り直し(timeout 5000)、見つかった後に反対色が 0 画素かを 1 回見る | 40・190 では赤の外接矩形が 600×900 で見つかり青は 0 画素。240・390 では青が見つかり赤は 0 画素。**190 と 390 を入れるのは、`steps(1, end)` が欠けて線形補間(クロスフェード)になっていても 40・240 だけでは緑になるため**(190 では混色または逆の色になり、赤が見つからず落ちる) |
| `R6 静止時は立ち絵だけ` | `e2e/render.spec.ts` | R5 と同じ CSS・同じ前提で、発話クラスを付けない(`<img src="http://127.0.0.1:9/avatars/42.png">`) | 赤が見つかり青は 0 画素。`getAnimations()` に `speak-mouth` が無い |
| `R7 ぴょこぴょこ・枠・後光と併用しても切り替わる` | `e2e/render.spec.ts` | R5 と同じ前提で `speak` を既定(`DEFAULT_SPEAK` = ぴょこぴょこ + 枠・後光)にする。`currentTime` を `40`・`190` と `240`・`390` に | 40・190 で赤が見つかり青は 0 画素 / 240・390 で青が見つかり赤は 0 画素(位置は跳ねで動くので外接矩形の幅だけを見る) |

### M13 の期待リテラル
`generateCss([USER_A], opts({ imageNaturalWidth: 600, imageNaturalHeight: 900 }))` の、**口パク追加前の main** の出力(末尾は改行 1 つ)。テストでは `toBe` の相手に使う(長いので、テストファイルの先頭でテンプレートリテラルの定数にする。`${` と `` は含まない)。

```css
:root {
  /* ユーザーA (123456789012345678) */
  --img-stand-url-123456789012345678: url("data:image/png;base64,AAAABBBBCCCC");
}

/* 立ち絵は body::after ただ1つで描画（唯一の描画源＝位置ズレが起きない）。
   Streamkit の実要素は全部隠し、発話だけ検知して body::after を演出する。 */

body, #root {
  overflow: hidden !important;
}

/* 立ち絵（常時表示：通話に居ても居なくても同じ位置）
   描画サイズ 600x900px は立ち絵画像の実サイズから算出。**画像を差し替えたらCSSを出し直すこと**。 */
body::after {
  content: "";
  position: fixed;
  left: 0px;
  bottom: 0px;
  display: block;
  width: 600px;
  height: 900px;
  background-image: var(--img-stand-url-123456789012345678);
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
}

/* 発話中：非表示の実 img に付く Voice_avatarSpeaking__ を :has() で検知して body::after を演出 */
body:has(img[src*="avatars/123456789012345678"][class*="Voice_avatarSpeaking__"])::after {
  animation: 750ms infinite alternate ease-in-out speak-jump,750ms infinite alternate ease-in-out speak-light;
}

img {
  display: none !important;
}

[class*="Voice_name__"], [class*="Voice_user__"] {
  display: none !important;
}

@keyframes speak-jump {
  0% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
  100% { transform: translateY(0); }
}

@keyframes speak-light {
  0% { filter: drop-shadow(0 0 2px #FFFFFF) drop-shadow(2px 2px 0px #FFFFFF) drop-shadow(-2px -2px 0px #FFFFFF) drop-shadow(-2px 2px 0px #FFFFFF) drop-shadow(2px -2px 0px #FFFFFF); }
  50% { filter: drop-shadow(0 0 8px #FFFFFF) drop-shadow(2px 2px 0px #FFFFFF) drop-shadow(-2px -2px 0px #FFFFFF) drop-shadow(-2px 2px 0px #FFFFFF) drop-shadow(2px -2px 0px #FFFFFF); }
  100% { filter: drop-shadow(0 0 2px #FFFFFF) drop-shadow(2px 2px 0px #FFFFFF) drop-shadow(-2px -2px 0px #FFFFFF) drop-shadow(-2px 2px 0px #FFFFFF) drop-shadow(2px -2px 0px #FFFFFF); }
}
```

e2e の画素判定は既存 `measureRedBoundingBox`(`e2e/render.spec.ts:30-71`)を `measureColorBoundingBox(page, 'red' | 'blue')` に一般化し、`measureRedBoundingBox` は `measureColorBoundingBox(page, 'red')` を呼ぶ薄い関数として残す(R1〜R4 は無修正)。青の判定は `b > 200 && r < 60 && g < 60`。画像の生成も `makeRedImageDataUrl`(`:6`)を `makeColorImageDataUrl(page, '#ff0000' | '#0000ff')` に一般化し、`makeRedImageDataUrl` はそれを呼ぶ薄い関数として残す。口パクの検証用の描画は `buildCssAndRender`(`:93`)ではなく、この 3 テスト専用のヘルパ `renderMouthPage(page, { speaking, speak })` を同じファイルに足す。

## 実装ブロック
| ブロック | 対象タスク | 触るファイル | 確認コマンド |
|---|---|---|---|
| B1 | T1 | `src/lib/types.ts`, `src/lib/state.ts`, `src/lib/mouth.ts`(新規), `src/lib/types.test.ts`, `src/lib/state.test.ts`, `src/lib/mouth.test.ts`(新規) | `npm run typecheck && npm run lint && npx vitest run src/lib` |
| B2 | T2 | `src/lib/generateCss.ts`, `src/lib/generateCss.test.ts` | `npm run typecheck && npm run lint && npx vitest run src/lib` |
| B3 | T3 | `src/ui/MouthImageField.tsx`(新規), `src/ui/PresetPanel.tsx`, `src/ui/TachiePreview.tsx`, `src/ui/TachiePreview.test.tsx`(新規), `src/ui/OutputPanel.tsx`, `src/App.test.tsx`, `src/App.mouth.test.tsx`(新規) | `npm run typecheck && npm run lint && npx vitest run` |
| B4 | T4 | `e2e/render.spec.ts` | `npx playwright install chromium && npx playwright test` |
| B5 | T6 | `src/lib/types.ts`, `src/lib/state.ts`, `src/ui/MouthImageField.tsx`, `src/ui/TachiePreview.tsx`, `src/lib/types.test.ts`, `src/lib/state.test.ts`, `src/lib/generateCss.test.ts`(追記のみ), `src/ui/TachiePreview.test.tsx`, `src/App.test.tsx`, `src/App.mouth.test.tsx` | frontmatter の `test`(feature 全体) |

人手の T5 はブロックに入れない(OBS 実機)。

## 変更 C1 — 口パクの周期を「動きの速さ・周期」に合わせる(2026-10-31、実装後に本人の依頼で追加)

**この節が、上の「周期」に関する記述(`Preset.mouthIntervalMs`・周期の欄・M2/M4/M5/M6/M17/M18b/M19/M20 の周期部分)より優先する。** `GenerateOptions.mouthIntervalMs`・`resolveMouthIntervalMs`・`generateCss`・`e2e` は**変えない**(出力側は「渡された周期で切り替える」のまま)。

### 考え方
- ぴょこぴょこ・枠/後光・点滅は全部 `speak.durationMs`(画面の「動きの速さ・周期」、既定 750ms)で `alternate` 往復する。口パクは同じ発話中ルールで同時に始まるので、**口パクの周期 = `speak.durationMs` ÷ 整数**にすれば永久にずれない。
- 利用者が選ぶのは ms ではなく**回数**(動き 1 回あたりの口パク回数、1〜4、既定 2 = 750ms なら 375ms)。
- 計算結果は丸めない(750 ÷ 4 = 187.5ms をそのまま CSS に出す。丸めるとずれが溜まる)。50ms 未満だけは `resolveMouthIntervalMs` が 50ms に上げる(そのときだけ揃わない。`durationMs` が 200ms 未満でしか起きない)。
- データ: この feature は main 未リリースなので、`Preset.mouthIntervalMs` は互換なしで**取り除く**(保存済みの値は `normalizePreset` で無視される)。

### 新規インターフェース(`src/lib/types.ts`。`resolveMouthIntervalMs` の直後)
```ts
/** 口パクの回数(「動きの速さ・周期」1 回あたり)の既定。 */
export const DEFAULT_MOUTH_PER_MOVE = 2
/** 選べる回数。 */
export const MOUTH_PER_MOVE_CHOICES = [1, 2, 3, 4] as const
/** 1〜4 の整数ならそのまま、それ以外(未指定・非数・小数・範囲外)は 2。 */
export function resolveMouthPerMove(v?: number): number
/** 口パクの周期(ms) = resolveMouthIntervalMs(speak.durationMs / resolveMouthPerMove(mouthPerMove))。 */
export function mouthIntervalForPreset(p: Pick<Preset, 'speak' | 'mouthPerMove'>): number
// Preset: mouthIntervalMs?: number を削除し、mouthPerMove?: number を足す
```

### 変更点
| 対象 | 変更 |
|---|---|
| `src/lib/types.ts` `interface Preset` | `mouthIntervalMs?` を削除、`mouthPerMove?: number`(口パクの回数。未指定は 2)を足す |
| `src/lib/types.ts` `presetToOptions` | `mouthIntervalMs: mouthIntervalForPreset(p)`(常に入れる。口開き絵が無いと generateCss は使わないので出力は変わらない) |
| `src/lib/types.ts` `resetPresetOptions` | 形は今のまま(`mouthPerMove` は持ち越さず既定へ戻る) |
| `src/lib/state.ts` `normalizePreset` | `mouthIntervalMs` の検証を削除し、`mouthPerMove`: 1〜4 の整数のときだけ残す(他は `undefined`) |
| `src/ui/MouthImageField.tsx` | 周期の欄を下の「確定値 C1」の選択欄に置き換える。「口開き絵を外す」は `mouthImageUrl` と `mouthPerMove` を `undefined` に |
| `src/ui/TachiePreview.tsx` | 入れ替え間隔を `mouthIntervalForPreset(preset) / 2` に。`useEffect` の依存はその間隔の値 |

### 確定値 C1(画面)
| 項目 | 値 |
|---|---|
| 欄 | `<select id="pr-mouth-per-move">`、ラベル `口パクの回数（動き1回あたり）`、選択肢 `1回` `2回` `3回` `4回`(value 1〜4)、既定 `2回` |
| 補足(常に・ラベルの外の `small`) | `「動きの速さ・周期」に合わせて開閉します（いまは {N}ms で 口閉じ→口開き→口閉じ）`。{N} は `mouthIntervalForPreset(preset)` を `String()` したもの(187.5 はそのまま) |
| 口開き絵が未設定のとき | 欄は無効、補足 `口開き絵を設定すると使えます`(従来どおり併記) |
| 立ち絵が未設定のとき | 欄は無効(従来どおり) |

### テストケース C1(置き換え・追加。既存の該当行はこの表で置き換える)
| テスト名 | 置き場 | 入力・前提 | 期待値 |
|---|---|---|---|
| `describe('resolveMouthPerMove')` › `C1-1 1〜4 の整数だけ通す` | `src/lib/types.test.ts` | `undefined` / `0` / `5` / `1.5` / `NaN` / `1` / `4` | `2` / `2` / `2` / `2` / `2` / `1` / `4` |
| `describe('mouthIntervalForPreset')` › `C1-2 動きの周期 ÷ 回数、下限は 50` | `src/lib/types.test.ts` | `speak.durationMs` 750 と回数未指定 / 600 と 3 / 750 と 4 / 100 と 4 | `375` / `200` / `187.5` / `50` |
| `describe('presetToOptions')` › `M2 口パクの周期は動きに合わせる`(M2 を置き換え) | `src/lib/types.test.ts` | `presetToOptions({ ...base, speak: { ...base.speak, durationMs: 600 }, mouthPerMove: 3 })` と `presetToOptions(base)` | `.mouthIntervalMs` が `200` と `375` |
| `M4`(置き換え) | `src/lib/types.test.ts` | `resetPresetOptions({ ...makeDefaultPreset('p1'), imageUrl: 'data:a', mouthImageUrl: 'data:b', mouthPerMove: 3 })` | `.mouthImageUrl` `'data:b'`、`.mouthPerMove` `undefined`、`.imageUrl` `'data:a'` |
| `M5`(置き換え) | `src/lib/state.test.ts` | `normalizeState({ users: [], presets: [{ id: 'p1' }] })` | `mouthImageUrl` と `mouthPerMove` が `undefined` |
| `M6`(置き換え) | `src/lib/state.test.ts` | `{ id: 'a', mouthImageUrl: '   ', mouthPerMove: 0 }` / `{ id: 'b', mouthImageUrl: 5, mouthPerMove: 'x' }` / `{ id: 'c', mouthImageUrl: 'data:m', mouthPerMove: 3 }` / `{ id: 'd', mouthPerMove: 1.5 }` / `{ id: 'e', mouthIntervalMs: 120 }` | a・b・d・e の `mouthPerMove` は `undefined`、e に `mouthIntervalMs` プロパティが無い。c は `'data:m'` と `3` |
| `describe('口パク')` › `C1-3 動きの速さに合わせた周期が出力に入る` | `src/lib/generateCss.test.ts`(追記) | `generateCss([MOUTH_USER], presetToOptions({ ...makeDefaultPreset('p'), imageUrl: MOUTH_USER.imageUrl, mouthImageUrl: MOUTH_USER.mouthImageUrl, speak: { ...DEFAULT_SPEAK, durationMs: 600 } }, 600, 900))` | `600ms infinite alternate ease-in-out speak-jump` と `300ms infinite steps(1, end) speak-mouth` を含む |
| `M17` / `M18c`(前提だけ置き換え) | `src/ui/TachiePreview.test.tsx` | `mouthIntervalMs: 300` → `speak: { ...DEFAULT_SPEAK, durationMs: 600 }, mouthPerMove: 2`(周期 300 → 150ms ごと) | 既存の期待値のまま |
| `M18b`(置き換え) | `src/ui/TachiePreview.test.tsx` | `speak.durationMs: 100, mouthPerMove: 4`(25 → 下限 50 → 25ms ごと) | 24ms で `data:A`、25ms で `data:B` |
| `C1-4 動きの速さを変えるとプレビューも追従` | `src/ui/TachiePreview.test.tsx` | M17 の前提で発話中に `rerender` して `durationMs: 1200`(周期 600 → 300ms ごと) | 再描画後 299ms で切り替わらず、300ms で切り替わる |
| `M19` / `M20`(引き方だけ置き換え) | `src/App.test.tsx` | `/口パクの周期/` → `/口パクの回数/` | 既存の期待値のまま(有効・無効) |
| 文言のテスト(置き換え) | `src/App.mouth.test.tsx` | 立ち絵ありで口パク欄を開く | `口閉じ→口開き→口閉じの1往復の長さ` の代わりに `/「動きの速さ・周期」に合わせて開閉します（いまは 375ms で/` が出る |
| `C1-5 回数を変えると補足の ms が変わる` | `src/App.mouth.test.tsx` | 口開き絵を設定 → `口パクの回数（動き1回あたり）` を `3` に | 補足が `いまは 250ms` を含む |

## 依存 / 前提
- B2 と B3 は B1 の後(型と `resolveMouthIntervalMs` を使う)。B2 と B3 は互いに独立。B4 は B2 の後。
- spec 004(PR #42 = 実ブラウザの基盤 `e2e/` と `playwright.config.ts`)は main に入っている。

## リスク / 降りる箇所
- **OBS 内蔵ブラウザで口が切り替わるか**は Chromium の自動テストでは保証できない。T5 で OBS 32 系に出力CSSを貼り、話している間だけ口開きの絵が交互に出るか、話し始めの 1 回目から口開きが空白フレームなしで出るかを見る(絵は立ち絵と同じ大きさの 2 枚。手元に無ければ赤・青の単色 PNG でよい)。切り替わらない・補間でぼやける場合は**実装側で代替に切り替えず止めて**人に返す。
- `@keyframes` 内の `var()`(`background-image: var(--img-mouth-url-<id>)`)は Chromium では動く想定。R5〜R7 が落ちたら、`var()` を data URI の直書きに変えるのは設計変更(CSS が倍になる)なので止めて報告する。
- 保存容量: 口開き絵で data URI が増える。`saveState` は容量超過を黙って捨てる(既存の挙動)。この feature では変えない。
