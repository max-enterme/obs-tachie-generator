---
feature: speak-margin-hint
test: npm run typecheck && npm run lint && npx vitest run
---

# 実装計画 — 発話演出に必要な余白を距離の入力欄に出す

> plan.md — 「どう作るか」。spec.md の受け入れ条件を満たす設計。

## アプローチ
- 必要余白の計算は `src/lib/speakMargin.ts` の純粋関数 `requiredSpeakMargin` 1 か所に置く。
  出力CSSの `src/lib/generateCss.ts` は**触らない**(演出の条件は `activeEffects`、幅 0 を 1 に倒すのは `KEYFRAMES_LIGHT` と同じ規則を写す)。
- 表示は `src/ui/PresetPanel.tsx` の距離の 2 欄(`pr-left` / `pr-bottom`)の `<label>` の中に、既存の補足文と同じ形(`<small>`)で足す。
  警告は既存の注意色 `small.why`(`src/index.css:375-378`)を使う。新しい CSS は足さない。
- 並べ方: lib(計算)→ UI(表示と画面テスト)。

## 変更点
| 対象(ファイル / 関数) | 変更 |
|---|---|
| `src/lib/speakMargin.ts`(新規) | `requiredSpeakMargin` と文言を作る `speakMarginNote` を置く(下の「新規インターフェース」) |
| `src/lib/speakMargin.test.ts`(新規) | 下の「テストケース」の S1〜S8 |
| `src/ui/PresetPanel.tsx:108` `const anchors = resolveAnchors(editing ?? {})` の直後 | 次の 3 行を足す: `const margin = editing ? requiredSpeakMargin(editing.speak, anchors.x, anchors.y) : null` / `const noteX = editing ? speakMarginNote(margin?.x ?? null, editing.left) : null` / `const noteY = editing ? speakMarginNote(margin?.y ?? null, editing.bottom) : null` |
| `src/ui/PresetPanel.tsx:340-343` `pr-left` の `<label>` | 既存の `OFFSET_X_HINT` の `<small>` の後ろに `{noteX && <small className={noteX.warn ? 'why' : undefined}>{noteX.text}</small>}` を足す |
| `src/ui/PresetPanel.tsx:352-355` `pr-bottom` の `<label>` | 既存の `OFFSET_Y_HINT` の `<small>` の後ろに `{noteY && <small className={noteY.warn ? 'why' : undefined}>{noteY.text}</small>}` を足す |
| `src/lib/types.ts:352-353` `DEFAULT_OPTIONS` の doc コメント | 「必要な余白を UI で知らせるのは別対応」を「必要な余白はプリセット編集の距離欄に出す(`requiredSpeakMargin`)」に直す(コメントだけ。値は変えない) |
| `src/App.test.tsx`(既存 `describe('App')` の末尾) | 下の「テストケース」の A1〜A4 |

変更しないもの: `src/lib/generateCss.ts`、`src/lib/generateCss.test.ts`、`DEFAULT_OPTIONS` / `DEFAULT_SPEAK` の値、`src/index.css`。

## 新規インターフェース
```ts
// src/lib/speakMargin.ts
import type { AnchorX, AnchorY, SpeakEffect } from './types'

/** 距離の欄ごとの必要余白(px)。中央アンカーの軸は「距離」ではなく「ズレ」なので null。 */
export interface SpeakMargin {
  x: number | null
  y: number | null
}

/** 枠・後光が立ち絵の外へ広がる量 = 幅 × この倍率(2026-09-18 の OBS 実測で最大約 6.7×〔幅 2/4/6/12 → 13/26〜27/34〜40/79〜80px〕。安全側に 7×)。 */
export const GLOW_EXTENT_PER_WIDTH = 7

/**
 * 発話演出が端で切れないための、アンカーからの距離の必要値(px)。
 * - 枠・後光(outline)が ON: 上下左右に 7 × 幅。幅 0 以下は 1 として数える(KEYFRAMES_LIGHT と同じ)
 * - ぴょこぴょこ(bounce && jumpPx > 0): 上方向にだけ動くので、anchorY === 'top' のときだけ縦に jumpPx を足す
 * - 各軸の合計を最後に Math.ceil で整数へ切り上げる(幅・跳ね高さが小数でも表示は整数 px)
 * - anchorX === 'center' なら x は null、anchorY === 'middle' なら y は null
 */
export function requiredSpeakMargin(speak: SpeakEffect, anchorX: AnchorX, anchorY: AnchorY): SpeakMargin

/** 距離の欄に出す文言。need が null か 0 以下なら null(何も出さない)。 */
export function speakMarginNote(
  need: number | null,
  distance: number,
): { warn: boolean; text: string } | null
// distance < need  → { warn: true,  text: `発話演出が端で切れます。${need}px 以上にしてください` }
// distance >= need → { warn: false, text: `発話演出に必要な余白: ${need}px` }
```

## 採らない案
- **常に警告を出す** — OBS 側でソースを動かして位置合わせする運用(距離 0 のまま)の人にも鳴り続ける。MAX が「足りないときだけ警告」を選んだ(2026-09-16)。
- **既定の距離を必要値に合わせて増やす** — 既存プリセットと出力CSSの見た目が変わる。rail #795 で「既定値は変えない」と決まっている。
- **`generateCss.ts` の中に計算を置く** — 出力CSSの差分ゼロを受け入れ条件にしているので、計算だけを別ファイルに分けて差分を 0 に保つ。
- **実測値(5.7×)をそのまま使う** — 端で 1px 切れうる。安全側の 6× を切り上げで使う(rail #795)。6× も 2026-09-18 の実測で 1〜8px 足りなかったため 7× に上げた。
- **中央アンカーにも必要値を出す** — 中央は「中央からのズレ」で端に寄せる設定ではなく、距離と比べる意味が無い。
- **Playwright で画面テストを書く** — spec 004(PR #42)が未マージで repo にまだ無い。表示は文字 1 行なので jsdom の画面テスト(`src/App.test.tsx`)で判定する。

## 確定値
| 項目 | 値 |
|---|---|
| 警告の文言 | `発話演出が端で切れます。{必要値}px 以上にしてください`(`small.why`) |
| 補足の文言 | `発話演出に必要な余白: {必要値}px`(`small`) |
| 置き場 | 距離の欄の `<label>` の中、既存の補足(`正で右` 等)の後ろ |
| 警告になる条件 | 距離 < 必要値(ちょうどは補足) |
| 何も出さない条件 | 必要値が 0(演出なし)/ その軸が中央アンカー |

モック: ダッシュボード Pages の `obs-tachie-generator/005-speak-margin-mock.html`(A 警告 / B 補足 / C 上アンカー / D 中央・演出なし)。

## テスト
- 枠・後光 ON・ぴょこぴょこ OFF・右下: 幅 2/4/6/12 → x・y とも 14/28/42/84。
- 幅 0 → 7(1 として数える)。幅 2.5 → 18、幅 2.3 → 17(切り上げ)。
- 枠・後光 ON 幅 2 + ぴょこぴょこ 10: 左上 → y 24 / 左下 → y 14。
- 枠・後光 OFF + ぴょこぴょこ 10: 左上 → x 0・y 10 / 左下 → x 0・y 0。ぴょこぴょこ ON でも jumpPx 0 → 足さない。
- 中央アンカー(下中央 / 左中央 / 中央): 該当軸が null。
- `speakMarginNote`: (12, 0) → 警告 / (12, 12) → 補足 / (12, 16) → 補足 / (0, 0) → null / (null, 0) → null。
- 画面(App)は 4 本に分け、**どれも既定のプリセット(左下・距離 0・枠 幅2・ぴょこぴょこ 10)から始める**(前のテストの操作を引き継がない):
  - A1: 左端・下端の欄に「14px 以上」の警告 → 左端を 16 にすると左端は「必要な余白: 14px」。
  - A2: 枠・後光の幅を 4 にすると下端に「28px 以上」。
  - A3: 左上を選ぶと上端に「24px 以上」(幅 2 のまま)→ 続けて下中央を選ぶと横の欄に余白の文言が無い。
  - A4: 枠・後光とぴょこぴょこを OFF にするとどの欄にも無い。
- `src/lib/generateCss.ts` / `src/lib/generateCss.test.ts` は変更しない(既存テストがそのまま緑)。

## テストケース
| テスト名 | 置き場(ファイル) | 入力・前提 | 期待値 |
|---|---|---|---|
| `describe('requiredSpeakMargin')` › `S1 枠・後光は幅×7を上下左右に` | `src/lib/speakMargin.test.ts` | `{ ...DEFAULT_SPEAK, bounce: false, outline: true, outlineWidth: w }`、`('right', 'bottom')`、w = 2/4/6/12 | `{ x: 7w, y: 7w }` = 14/28/42/84 |
| `describe('requiredSpeakMargin')` › `S2 幅0以下は1として数え、端数は切り上げ` | `src/lib/speakMargin.test.ts` | outlineWidth 0 / 2.5 / 2.3、`('left', 'bottom')` | x = 7 / 18 / 17 |
| `describe('requiredSpeakMargin')` › `S3 上アンカーだけ縦に跳ね量を足す` | `src/lib/speakMargin.test.ts` | `{ ...DEFAULT_SPEAK, outline: true, outlineWidth: 2, bounce: true, jumpPx: 10 }`、`('left', 'top')` と `('left', 'bottom')`。加えて `jumpPx: 10.5` の `('left', 'top')` | `{ x: 14, y: 24 }` と `{ x: 14, y: 14 }`。`jumpPx: 10.5` は `{ x: 14, y: 25 }`(24.5 を切り上げ) |
| `describe('requiredSpeakMargin')` › `S4 枠なし・ぴょこぴょこだけ` | `src/lib/speakMargin.test.ts` | `{ ...DEFAULT_SPEAK, outline: false, bounce: true, jumpPx: 10 }`、`('left', 'top')` と `('left', 'bottom')` | `{ x: 0, y: 10 }` と `{ x: 0, y: 0 }` |
| `describe('requiredSpeakMargin')` › `S5 jumpPx 0 は足さない` | `src/lib/speakMargin.test.ts` | `{ ...DEFAULT_SPEAK, outline: false, bounce: true, jumpPx: 0 }`、`('left', 'top')` | `{ x: 0, y: 0 }` |
| `describe('requiredSpeakMargin')` › `S6 中央アンカーの軸は null` | `src/lib/speakMargin.test.ts` | `DEFAULT_SPEAK`、`('center', 'bottom')` / `('left', 'middle')` / `('center', 'middle')` | `{ x: null, y: 14 }` / `{ x: 14, y: null }` / `{ x: null, y: null }` |
| `describe('speakMarginNote')` › `S7 足りないときだけ警告` | `src/lib/speakMargin.test.ts` | `(12, 0)` / `(12, 12)` / `(12, 16)` / `(24, 23)` / `(24, 24)` | `{ warn: true, text: '発話演出が端で切れます。12px 以上にしてください' }` / `{ warn: false, text: '発話演出に必要な余白: 12px' }` / 同じく補足 / `{ warn: true, text: '発話演出が端で切れます。24px 以上にしてください' }` / `{ warn: false, text: '発話演出に必要な余白: 24px' }` |
| `describe('speakMarginNote')` › `S8 必要値0・nullは出さない` | `src/lib/speakMargin.test.ts` | `(0, 0)` / `(null, 0)` | どちらも `null` |
| `A1 既定のプリセットでは距離の欄に余白の警告が出て、足りると補足になる` | `src/App.test.tsx` | 既存テスト `3×3 のアンカー選択…` と同じ手順(ユーザーID 入力 → 追加 → `addPresetWithImage`)。既定 = 左下・距離 0・枠 幅2・ぴょこぴょこ 10 | `document.querySelector('label[for="pr-left"]')` と `[for="pr-bottom"]` の textContent に `14px 以上にしてください`。`fireEvent.change(getByLabelText(/左端からの距離/), { target: { value: '16' } })` 後、`pr-left` は `発話演出に必要な余白: 14px` を含み `切れます` を含まない |
| `A2 枠・後光の幅を変えると必要値が追従する` | `src/App.test.tsx` | A1 と同じ前提から `fireEvent.change(getByLabelText(/枠・後光の幅/), { target: { value: '4' } })` | `pr-bottom` の label が `28px 以上にしてください` を含む |
| `A3 上アンカーは縦に跳ね量を足し、中央アンカーの欄には出さない` | `src/App.test.tsx` | A1 と同じ前提から、`radiogroup /基準の位置/` の `左上` をクリック → 次に `下中央` をクリック | 左上: `pr-bottom`(上端からの距離)の label が `24px 以上にしてください` を含む。下中央: `pr-left`(横中央からのズレ)の label が `余白` も `切れます` も含まない |
| `A4 演出を全部 OFF にすると余白の表示が消える` | `src/App.test.tsx` | A1 と同じ前提から、`getByRole('button', { name: /枠・後光/ })` と `getByRole('button', { name: /ぴょこぴょこ/ })` をクリックして OFF | `pr-left` と `pr-bottom` の label が `余白` も `切れます` も含まない |

## 実装ブロック
| ブロック | 対象タスク | 触るファイル | 確認コマンド |
|---|---|---|---|
| B1 | T1 | `src/lib/speakMargin.ts`(新規), `src/lib/speakMargin.test.ts`(新規) | `npm run typecheck && npx vitest run src/lib` |
| B2 | T2 | `src/ui/PresetPanel.tsx`, `src/App.test.tsx`, `src/lib/types.ts` | `npm run typecheck && npm run lint && npx vitest run` |

## 依存 / 前提
- B2 は B1 の後(`requiredSpeakMargin` / `speakMarginNote` を使う)。
- spec 004(PR #42)とは独立。重なるファイルは `src/lib/types.ts` だけで、004 は `GenerateOptions` / `presetToOptions`(160〜270 行付近)、005 は `DEFAULT_OPTIONS` の doc コメントを触る。
  004 が先にマージされて行番号がずれていたら、`DEFAULT_OPTIONS` の直前の doc コメント内「必要な余白を UI で知らせる」の文を探して直す。

## リスク / 降りる箇所
- **OBS 実機の確認(T3)は人が行う**: OBS で立ち絵のブラウザソースを右下アンカー・枠・後光 幅 4・距離 28 にした CSS で表示し、
  Discord で話して枠・後光が右端・下端で切れていないかを見る。数値で見るなら OBS 確認キットで
  `node --experimental-strip-types glow-extent.mjs 4` を回し、はみ出し量が 28px 以下かを出力で見る。
- `getByRole('button', { name: /枠・後光/ })` が名前ラベル側のボタンにも当たって複数一致したら、`src/App.test.tsx` の該当テストで
  `data-on` を持つ発話演出の `.chips` の中に `within` で絞る。それでも決まらなければ止めて報告する(PresetPanel.tsx にテスト用の属性を足さない)。
- 既存の `src/App.test.tsx` のテストが、距離の欄の label に文言が増えたことで落ちたら、実装を止めて報告する(既存テストを書き換えない)。
