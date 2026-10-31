---
feature: seat-switch
test: npm run typecheck && npm run lint && npx vitest run && npx playwright install chromium && npx playwright test
---

# 実装計画 — 席の主が入れ替わる(1 つのブラウザソースに候補を並べ、通話にいる人の立ち絵を出す)

> plan.md — 「どう作るか」。spec.md の受け入れ条件を満たす設計。
> `test` は 006 と同じ形(単体テスト + Playwright)。OBS 実機だけ人手(T6)。
> 決まっていること(2026-10-31 本人回答): 誰もいないときは何も出さない / 同時に 2 人以上いるときはリストの上の人。

## アプローチ
- **候補 k が「出ている」条件を、セレクタ 1 本で排他にする。** 候補を上から c1, c2, … とし、候補 k の条件を
  「k の img がある、かつ k より上の候補の img がどれも無い」=
  `body:has(img[src*="avatars/<k>"]):not(:has(img[src*="avatars/<c1>"])):not(:has(img[src*="avatars/<c2>"]))…` にする。
  条件が互いに重ならないので、候補ごとに `::after`(立ち絵)・`::before`(名前)・発話中のルールを**丸ごと別々に**書ける。
  ベースの `body::after` は書かない(どの候補の条件にも当たらなければ擬似要素は生成されない = 誰もいないときは何も出ない)。
- **位置(アンカー + 距離 2 つ)は席が持つ。それ以外の見た目は候補のプリセットそのまま**(2026-10-31 本人回答: 「席に位置を 1 つ持たせる」)。
  誰が出ても同じ場所に出る。幅・背景画像方式・名前の帯(立ち絵からの相対位置)・口パク・発話演出・暗くする、はプリセットの値。
  位置の差し替えは UI 側で `seatPreset(preset, seat)`(プリセットの `anchorX` / `anchorY` / `left` / `bottom` を席の値で上書きした写し)を作ってから
  `presetToOptions` に通す。出力とプレビューが同じ関数を通るので位置は食い違わない(在室の扱いだけは、出力が `hideWhenAway: false`・プレビューが `true` に倒す。どちらも「在室中だけ出す」を表すため)。`generateSeatCss` は位置のことを知らない。
- 常時表示(`generateStandaloneCss`)が `body::after` に書いている宣言を関数に切り出し、席ではセレクタだけ差し替えて同じ宣言を使う。
- **席の画面にもプレビューを置く**(2026-10-31 本人回答)。候補の行を押すとその人を、席の位置で映す。既存の `TachiePreview` に `seatPreset` の結果(`hideWhenAway` だけ true に倒したもの。確定値の「プレビュー」)を渡す。
- **keyframe 名は候補ごとに接尾辞 `-c<k>`(1 始まり)を付ける。** 跳ねる高さ・枠の色・口開き絵が候補ごとに違うため、
  同じ名前だと後勝ちで混ざる。常時表示は接尾辞なし(= 今の出力と 1 文字も変わらない)。
- **在室の扱いはプリセットの「通話にいないときは隠す」(`hideWhenAway`)を無視する。** 席は「在室の候補だけ出す」が
  定義なので、候補の options は `{ ...options, hideWhenAway: false }` に倒してから宣言を作る(`display: block` になる)。
- **データは `AppState.seats: Seat[]`。候補は既存の `Pairing`(userId × presetId)を並べたもの。** 並び = 優先順。
  保存キー `obs-tachie-generator:v1` はそのまま(`seats` が無い古いデータは `[]` として読む = 版を上げない)。
- **画面は新しいステップ ④。** ③(1 組の個別出力)は触らない。位置の入力欄は ② と同じ作り(9 マスのアンカー + 距離 2 欄)で、
  ラベルの定数は `PresetPanel.tsx` から `src/ui/anchorLabels.ts` に移して両方から使う(コンポーネントのファイルから定数を export すると
  `react-refresh/only-export-components` の警告が出るため、別ファイルにする)。
- **候補ごとに画像の実サイズを測る**(背景画像方式・口パク・名前の行揃えに要る)。今のフック `useImageNaturalSize` は
  1 枚用なので、複数枚用 `useImageNaturalSizes` を同じファイルに足す。

## 変更点
| 対象(ファイル / 関数) | 変更 |
|---|---|
| `src/lib/types.ts` `interface Pairing`(:226)の直後 | `interface Seat` を足す(下の「新規インターフェース」) |
| `src/lib/types.ts` `interface AppState`(:248) | `seats: Seat[]` を足す |
| `src/lib/types.ts` `makeDefaultPreset`(:298)の後 | `makeDefaultSeat(id)` と `seatPreset(p, seat)` を足す(下の「新規インターフェース」) |
| `src/lib/state.ts` `emptyState`(:33) | `seats: []` を足す |
| `src/lib/state.ts` `isPairing` の直後 | `normalizeSeat(raw, userIds, presetIds): Seat \| null` を足す(下の規則) |
| `src/lib/state.ts` `normalizeState`(:173〜:208) | `pairings` の後で `seats` を作り、戻り値に `seats` を足す。席 id が重複したら先のものだけ残す |
| `src/lib/state.ts` 冒頭コメント(:25 付近の「保存形は…」) | 保存形に `seats: Seat[]` を足した旨を 1 行足す |
| `src/App.tsx` :28〜:39(state と `saveState`) | B1: `const [seats] = useState<Seat[]>(initial.seats)` を足し、`saveState({ users, presets, pairings, selection, seats })` と依存配列に `seats`。B3: `[seats, setSeats]` にする |
| `src/lib/generateCss.ts` `KEYFRAMES_JUMP_TRANSFORM` / `KEYFRAMES_LIGHT` / `KEYFRAMES_BLINK` / `KEYFRAMES_MOUTH`(:448〜:487) | 引数の末尾に `suffix = ''` を足し、`@keyframes speak-<名前>${suffix} {` と出す。`KEYFRAMES_BLINK` は定数から `(suffix = '') => string` の関数にする。`KEYFRAMES_JUMP_BOTTOM`(まとめ版用)は変えない |
| `src/lib/generateCss.ts` `animationValue`(:499) | 引数の末尾に `suffix = ''`。各要素を `speak-${e}${suffix}` にする |
| `src/lib/generateCss.ts` `keyframeBlocks`(:521) | 引数の末尾に `suffix = ''` を足し、上の 3 つに渡す |
| `src/lib/generateCss.ts` `nameBlock`(:360) | 引数の末尾に `selector = 'body::before'` を足し、`${header}\n${selector} {\n…` と出す |
| `src/lib/generateCss.ts` `generateStandaloneCss`(:562〜:671) | :577〜:602 の `afterDecls` の組み立てを `tachieAfterDecls` に、:623〜:634 の `speakingDecls` の組み立てを `speakingDecls` に切り出して呼ぶ。**出力は 1 文字も変えない**(既存の `generateCss.test.ts` を書き換えずに通す) |
| `src/lib/generateCss.ts` `generateCombinedCss` の前 | `SeatCandidate` / `seatActiveSelector` / `generateSeatCss` を足す(下の「新規インターフェース」と「出力の形」) |
| `src/ui/useImageNaturalSize.ts` | `useImageNaturalSizes(imageUrls: string[])` を足す |
| `src/ui/anchorLabels.ts`(新規) | `PresetPanel.tsx` :37〜:59 の `ANCHOR_ROWS` / `ANCHOR_COLS` / `ANCHOR_LABEL` / `OFFSET_X_LABEL` / `OFFSET_Y_LABEL` / `OFFSET_X_HINT` / `OFFSET_Y_HINT` を中身そのままで移し、`export const` にする |
| `src/ui/PresetPanel.tsx` :37〜:59 | 上の定数の定義を消し、`./anchorLabels` から import する(画面と出力は変えない)。`AnchorX` を使っていたのは移す定数だけなので、`type AnchorX` の import を外す(`AnchorY` は `NAME_EDGE` :62 が使うので残す。`noUnusedLocals` で typecheck が落ちるため) |
| `src/ui/SeatPanel.tsx`(新規) | 席の一覧と席の中身(名前・位置・候補・追加欄)。位置欄は `PresetPanel.tsx` :303〜:370 の「位置とサイズ」から幅欄を除いた形を写す(下の「確定値」) |
| `src/ui/SeatOutputPanel.tsx`(新規) | 席 1 つぶんの出力 CSS(下の「確定値」)。`OutputPanel.tsx` の構造(`.panel` > h2 > `.hint` > `role="status"` の注意 > `.output-block` > `ol.paste-steps`)をそのまま写す |
| `src/App.tsx` `STEPS`(:21〜:25) | 4 つ目 `{ key: '席（入れ替わり）', desc: '候補を並べて1ソースに' }` を足す |
| `src/App.tsx` :35 付近 | `const [focusSeatId, setFocusSeatId] = useState<string \| null>(null)`。有効な席は `seats.find((s) => s.id === focusSeatId) ?? seats[0] ?? null`(`focusedPreset` :41 と同じ形)。プレビュー用に `const [seatPreviewUserId, setSeatPreviewUserId] = useState<string \| null>(null)`。プレビューに映す候補は、有効な席の候補のうち `userId === seatPreviewUserId` のもの、無ければ先頭、候補 0 人なら無し。どちらも保存しない |
| `src/App.tsx` `removeUser`(:68) / `removePreset`(:83) | `setSeats((prev) => prev.map((s) => ({ ...s, candidates: s.candidates.filter((c) => c.userId !== id) })))`(プリセットは `c.presetId !== id`)を足す |
| `src/App.tsx` 席の操作(`removePairing` :108 の後) | `addSeat` / `removeSeat` / `renameSeat` / `addCandidate` / `moveCandidate` / `removeCandidate` を足す(下の「新規インターフェース」) |
| `src/App.tsx` `{step === 2 && …}`(:180〜:218)の後 | `{step === 3 && …}` のセクションを足す(下の「確定値」) |
| `src/App.tsx` ヘッダーの説明(:120〜:122) | 文言を差し替える(下の「確定値」) |
| `src/index.css` `.pair-item.active`(:208)の近く | 選択中の席の行の見た目: `.pair-item[aria-current="true"]` に `.pair-item.active` と同じ宣言を当てる(セレクタを `.pair-item.active,\n.pair-item[aria-current="true"]` に並べる) |
| `src/index.css` `.combine-grid`(:163)の後と、:215 の `@media` の中 | `.seat-grid { display: grid; grid-template-columns: minmax(0, 360px) minmax(0, 1fr); gap: 16px; margin-bottom: 16px; align-items: start; }` を足し、:215 の `@media` 内の `.combine-grid` のセレクタに `.seat-grid` を並べる(狭い画面で 1 列) |
| `README.md` 「出力は「個別」= 1 ペア = 1 ブラウザソース」節(:42〜:50) | 下の「確定値(文書)」 |
| `public/guide.html` `#steps` の ③ の `<li>`(:476〜:482)と `#obs` の `.note`(:496) | 下の「確定値(文書)」 |

### `normalizeSeat` の規則(`src/lib/state.ts`)
- `raw` がオブジェクトでない → `null`。
- `id` が空でない文字列でない → `null`(id は UI 側の `newId()` で作る。ここでは作らない = `normalizeState` は決定的なまま)。
- `name` が文字列でなければ `''`。
- `anchorX` が `'left' | 'center' | 'right'` でなければ `DEFAULT_ANCHOR_X`、`anchorY` が `'top' | 'middle' | 'bottom'` でなければ `DEFAULT_ANCHOR_Y`(`normalizePreset` :130〜:137 と同じ判定)。
- `left` / `bottom` が `Number.isFinite` を満たす数でなければ `0`。
- `candidates` が配列でなければ `[]`。配列なら `isPairing` を満たし、`userIds` と `presetIds` に両方ある要素だけ残す。
  **同じ `userId` が 2 回以上出たら最初の 1 件だけ残す**(プリセットが違っても)。各要素は `{ userId, presetId }` に組み直す。
- `normalizeState` 側: `obj.seats` が配列でなければ `[]`。`normalizeSeat` が `null` の要素は捨てる。同じ `id` の席は最初の 1 件だけ残す。

## 新規インターフェース

### `src/lib/types.ts`
```ts
/**
 * 席 = 1 ブラウザソース。候補(ユーザー × プリセット)を並べておき、通話にいる候補のうち
 * **リストの上の人を 1 人だけ**出す。誰もいないときは何も出さない。
 */
export interface Seat {
  /** アプリ内キー({@link newId} 生成)。 */
  id: string
  /** 席の名前(メモ用)。出力CSSの先頭コメントとファイル名に使う。 */
  name: string
  /** 席の横アンカー。誰が出てもこの位置(候補のプリセットの位置は使わない)。 */
  anchorX: AnchorX
  /** 席の縦アンカー。 */
  anchorY: AnchorY
  /** 横アンカーからの距離(px)。意味は {@link GenerateOptions.left} と同じ。 */
  left: number
  /** 縦アンカーからの距離(px)。意味は {@link GenerateOptions.bottom} と同じ。 */
  bottom: number
  /** 候補。並び = 優先順(先頭ほど優先)。同じ userId は 1 回まで。 */
  candidates: Pairing[]
}

/** 新しい席(名前空・左下・距離 0・候補なし)。 */
export function makeDefaultSeat(id: string): Seat
// = { id, name: '', anchorX: DEFAULT_ANCHOR_X, anchorY: DEFAULT_ANCHOR_Y, left: DEFAULT_OPTIONS.left, bottom: DEFAULT_OPTIONS.bottom, candidates: [] }

/**
 * プリセットの位置(anchorX / anchorY / left / bottom)だけを席の値で上書きした写しを返す。
 * 他のフィールド(幅・名前の帯・演出・口パク・画像)はプリセットのまま。元の p は変えない。
 * 席の出力(presetToOptions に通す前)とプレビューの両方で使う。
 */
export function seatPreset(
  p: Preset,
  seat: Pick<Seat, 'anchorX' | 'anchorY' | 'left' | 'bottom'>,
): Preset

export interface AppState {
  users: AppUser[]
  presets: Preset[]
  pairings: Pairing[]
  selection: Selection
  /** 席(入れ替わり)。007 より前の保存データには無い → `[]`。 */
  seats: Seat[]
}
```

### `src/lib/generateCss.ts`
```ts
/** 席の候補 1 人ぶんの描画入力。user は renderUser、options は presetToOptions の結果。 */
export interface SeatCandidate {
  user: TachieUser
  options: GenerateOptions
}

/**
 * 候補 index(0 始まり)が「出ている」ときの body セレクタ。
 * ids は候補の Discord ID を優先順に並べたもの(safeId で数字だけにしてから使う)。
 * 例: seatActiveSelector(['111', '222'], 1)
 *   === 'body:has(img[src*="avatars/222"]):not(:has(img[src*="avatars/111"]))'
 * index 0 は `body:has(img[src*="avatars/<ids[0]>"])`(:not なし)。
 */
export function seatActiveSelector(ids: string[], index: number): string

/** 席 1 つぶんの CSS(1 席 = 1 ブラウザソース)。candidates は優先順。 */
export function generateSeatCss(seatName: string, candidates: SeatCandidate[]): string

// 切り出す private 関数(generateStandaloneCss と generateSeatCss で共用)
/** 立ち絵 ::after の宣言(インデント 2 つ付き)。box が null なら content 方式。:577〜:602 をそのまま移す。 */
function tachieAfterDecls(
  id: string,
  options: GenerateOptions,
  pos: PositionParts,
  staticTransform: string,
  box: { width: number; height: number } | null,
): string[]
/** 発話中ルールの宣言(インデント 2 つ付き)。:623〜:634 をそのまま移し、animation の名前に suffix を付ける。 */
function speakingDecls(
  options: GenerateOptions,
  effects: Effect[],
  mouthOn: boolean,
  suffix?: string,
): string[]
```

### `src/ui/useImageNaturalSize.ts`
```ts
/**
 * 複数の画像の実サイズを測る。戻り値は URL → 実サイズ(読めない・測定中は null)。
 * 空文字の URL は測らない(キーにも入れない)。同じ URL は 1 回だけ測る。
 * imageUrls の中身(順序込み)が変わったら測り直す。useEffect の依存は `const key = imageUrls.join('\n')` の key だけにし、
 * effect の中では key.split('\n') を使う(imageUrls を直接読むと react-hooks/exhaustive-deps の警告が出るため)。
 */
export function useImageNaturalSizes(imageUrls: string[]): Record<string, Dimensions | null>
```

### `src/ui/SeatPanel.tsx`
```ts
interface Props {
  users: AppUser[]
  presets: Preset[]
  seats: Seat[]
  /** 選択中の席(App 側でフォールバック済み。席 0 件なら null)。 */
  seat: Seat | null
  onSelectSeat: (seatId: string) => void
  onAddSeat: () => void
  onRemoveSeat: (seatId: string) => void
  onRenameSeat: (seatId: string, name: string) => void
  /** 席の位置を変える(渡したキーだけ上書き)。 */
  onChangeSeatPosition: (
    seatId: string,
    patch: Partial<Pick<Seat, 'anchorX' | 'anchorY' | 'left' | 'bottom'>>,
  ) => void
  /** プレビューに映している候補の userId(App 側でフォールバック済み。候補 0 人なら null)。 */
  previewUserId: string | null
  onPreviewCandidate: (userId: string) => void
  onAddCandidate: (seatId: string, candidate: Pairing) => void
  /** index の候補を delta だけ動かす(-1 = 上へ / 1 = 下へ)。範囲外なら何もしない。 */
  onMoveCandidate: (seatId: string, index: number, delta: -1 | 1) => void
  onRemoveCandidate: (seatId: string, index: number) => void
}
export default function SeatPanel(props: Props): JSX.Element
```
- 追加欄のユーザー・プリセットの選択は SeatPanel 内の `useState<string | null>`。未選択・消えた id は先頭にフォールバック(`App.tsx` の `effUserId` :44 と同じ形)。

### `src/ui/SeatOutputPanel.tsx`
```ts
interface Props {
  seat: Seat | null
  users: AppUser[]
  presets: Preset[]
}
export default function SeatOutputPanel(props: Props): JSX.Element
```
- 候補ごとに `users` / `presets` から引き、どちらかが見つからない候補は飛ばす。
- 実サイズは `useImageNaturalSizes(候補のプリセットの imageUrl の配列)` で測る。
- CSS は `generateSeatCss(seat.name, cands)`。`cands[k] = { user: renderUser(u, p), options: presetToOptions(seatPreset(p, seat), size?.width, size?.height) }`。

### `src/App.tsx` の席の操作
| 関数 | 中身 |
|---|---|
| `addSeat()` | `const s = makeDefaultSeat(newId())` を末尾に足し、`setFocusSeatId(s.id)` |
| `removeSeat(id)` | その席を外す。`focusSeatId === id` なら `null` に戻す |
| `selectSeat(id)` | `setFocusSeatId(id)` と `setSeatPreviewUserId(null)`(プレビューは新しい席の先頭の候補に戻る) |
| `renameSeat(id, name)` | その席の `name` を置き換える(trim しない。入力途中の空白を消さないため) |
| `changeSeatPosition(id, patch)` | その席に `{ ...s, ...patch }` |
| `previewCandidate(userId)` | `setSeatPreviewUserId(userId)` |
| `addCandidate(seatId, c)` | その席に同じ `userId` がいれば何もしない。いなければ末尾に `{ userId, presetId }` |
| `moveCandidate(seatId, index, delta)` | `index + delta` が 0 未満・候補数以上なら何もしない。それ以外は 2 つを入れ替える |
| `removeCandidate(seatId, index)` | その位置の候補を外す |

## 出力の形(`generateSeatCss`)
候補 0 人: `'/* 席に候補がいません。④ で候補を追加してください。 */\n'` だけを返す。
候補 1 人以上: 次のブロックを `'\n\n'` でつなぎ、末尾に `'\n'`(`generateStandaloneCss` の :670 と同じつなぎ方)。

1. 先頭コメント: `/* 席「<名前>」: 候補 <N> 人。通話にいる候補のうち、リストの上の人を 1 人だけ出す（誰もいないときは何も出さない） */`
   `<名前>` は `cssComment(seatName)`。空(trim して空)なら `無名の席`。
2. `:root`: `rootBlock(cands.map((c, k) => mouthOn[k] ? c.user : { ...c.user, mouthImageUrl: undefined }), true)`。
   `mouthOn[k]` = `tachieBoxSize(width, imageNaturalWidth, imageNaturalHeight) != null` かつ `mouthImageUrl` が空白以外(`generateStandaloneCss` :575 と同じ判定)。
3. 説明コメント: `/* 立ち絵は body::after ただ1つで描画。出すのは「在室で、かつ上の候補が誰も在室していない」候補だけ。\n   Streamkit の実要素は全部隠し、在室と発話だけ検知する。 */`
4. `body, #root {\n  overflow: hidden !important;\n}`
5. `ids = candidates.map((c) => c.user.id)`(`safeId` は `seatActiveSelector` の中で掛ける)。候補ごと(k = 0, 1, …)に、`S = seatActiveSelector(ids, k)`、`suffix = '-c' + (k + 1)`、`o = { ...options, hideWhenAway: false }` として:
   - `/* 候補<k+1>: <cssComment(user.name)> (<id>) */\n${S}::after {\n<tachieAfterDecls(id, o, pos, staticTransform, box)>\n}`(name が空なら `/* 候補<k+1>: (<id>) */`)
   - `nameBlock(user, o, `${S}::before`)` が `null` でなければそれ。
   - 演出・暗くする・口パクのどれかがあれば(:622 と同じ条件)
     `${S}:has(img[src*="avatars/<id>"][class*="Voice_avatarSpeaking__"])::after {\n<speakingDecls(o, effects, mouthOn[k], suffix)>\n}`。
     口パクの animation は `<周期>ms infinite steps(1, end) speak-mouth${suffix}`。
6. `img {\n  display: none !important;\n}`
7. `/* Streamkit のアカウント名は隠す（名前は上のブロックで出す） */\n[class*="Voice_name__"], [class*="Voice_user__"] {\n  display: none !important;\n}`(名前の有無に関係なく注記を付ける)
8. 候補ごとに `keyframeBlocks(effects, speak, 'transform', pos.transforms, suffix)`、口パクがあれば `KEYFRAMES_MOUTH(id, suffix)`。

- `pos` / `staticTransform` / `box` / `effects` の求め方は `generateStandaloneCss` :566〜:574 と同じ(候補の options で)。
- 同じ id の候補が 2 人いても特別扱いしない(2 人目の条件は `:not(:has(自分))` を含むので決して当たらない。重複は state と UI が防ぐ)。

## 採らない案
- **後に書いたルールが勝つ性質(カスケード)で優先順を出す**(候補を下から順に書き、上の候補を最後に書く): 立ち絵の `::after` だけなら成立するが、発話中ルールは `:has(…Voice_avatarSpeaking__)` の分だけ詳細度が高く、**出ていない下の候補が話すと、出ている上の候補の立ち絵に演出が掛かる**。条件を排他にするほうが壊れない。
- **ベースの `body::after { display: none }` を書いて在室で `display: block` に戻す**(今の `hideWhenAway` の書き方): 席では宣言そのものを候補ごとに切り替えるので、ベースは要らない。どの条件にも当たらなければ `content` が無く擬似要素は出ない。
- **keyframe 名を共通のまま(`speak-jump` 等)にする**: 候補ごとに跳ねる高さ・中央寄せの translate・枠の色・口開き絵が違うので、後勝ちで混ざる。
- **候補のプリセットの位置をそのまま使う**: 誰が出るかで出る場所が変わる。本人回答(2026-10-31)で「席に位置を 1 つ持たせる」を採った。
- **幅も席で持つ**: 立ち絵の画像は人ごとに縦横比も余白も違うので、幅を揃えると見た目が崩れる。位置(アンカー + 距離)だけを席で持つ。
- **`generateSeatCss` に席の位置を渡して中で上書きする**: プレビューも同じ上書きが要るので、上書きは `seatPreset` 1 か所にまとめて UI 側で通す。
- **候補を「保存したペア」から選ぶ**: 保存ペアを先に作る手間が増える。④ でユーザーとプリセットを直接選ぶ(保存ペアとは独立)。
- **③ に「1 組 / 席」の切り替えを入れる**: ③ の画面とテストを触ることになる。④ を足すほうが ③ を 1 文字も変えずに済む。
- **候補のドラッグでの並べ替え**: ボタン 2 つで足りる。ドラッグはテストも重い。
- **保存キーを `v2` に上げる**: `seats` が無いデータを `[]` と読めば済む(`pairings` が無いデータの読み方と同じ)。

## 確定値
モック: ダッシュボード Pages `obs-tachie-generator/007-seat-mock.html`。席の位置欄とプレビューはモックの確認の後に足したのでモックには無い。実装は下の表を正とする。

### 画面(④)
| 項目 | 値 |
|---|---|
| ステッパー 4 つ目 | `key: '席（入れ替わり）'` / `desc: '候補を並べて1ソースに'` |
| 見出し | `.step-num` に `4`、h2 `席（入れ替わり）` |
| リード文 | `1 つのブラウザソースに候補を並べておくと、通話にいる人の立ち絵がその席に出ます。何人か同時にいるときはリストの上の人を出し、誰もいないときは何も出しません。` |
| 並び | 1 段目は SeatPanel が返す `<div className="seat-grid">`(`PresetPanel` が `.preset-top` :159 を返すのと同じ形)で、中に 2 枚の `.panel`(左「席の一覧」・右「席の中身」)。2 段目は App が書く `<div className="combine-grid">` で、中に SeatOutputPanel の `.panel`(左)と `TachiePreview`(右) |
| プレビュー | `<TachiePreview preset={{ ...seatPreset(プレビューの候補のプリセット, 席), hideWhenAway: true }} nameText={resolveDisplayName(プレビューの候補のユーザー)} title={`プレビュー（${userLabel}）`} />`。`hideWhenAway` を true に倒すのは、席は在室中だけ出るので、プレビューの「通話にいない」で隠れるようにするため。`sampleWhenEmpty` は渡さない(③ と同じ)。候補 0 人・席 0 件なら `preset={null}` と `title="プレビュー"` |
| 左 h2 | `席の一覧` |
| 新しい席 | `<button className="primary">新しい席</button>` |
| 席の行 | `<div className="pair-item" aria-current={選択中 ? 'true' : undefined}>` に `<button className="pair-recall" aria-label={`席「${label}」を選ぶ`}>{label}（候補 {n} 人）</button>` と `<button className="danger" aria-label={`席「${label}」を削除`}>削除</button>`。`label` = `seat.name.trim() \|\| '無名の席'` |
| 席が 0 件 | `<p className="empty">席はまだありません。「新しい席」で作ります。</p>` |
| 右 h2 | `席の中身` |
| 席が未選択(0 件) | `<p className="empty">席を作ると、ここで候補を並べられます。</p>` |
| 名前欄 | `<label htmlFor="seat-name">席の名前</label>` + `<input id="seat-name" placeholder="例: ゲスト席">` |
| 位置の見出し | `<div className="subhead">席の位置</div>` |
| アンカー | `PresetPanel.tsx` :304〜:342 の `.anchor-block` をそのまま写し、`id` を `seat-anchor-label` に、`onClick` を `onChangeSeatPosition(seat.id, { anchorX: ax, anchorY: ay })` に。ヒントの文は `誰が出てもこの位置に出ます（{ANCHOR_LABEL[y][x]}）。立ち絵の幅・名前・演出は、その人のプリセットのままです。` |
| 距離 | `<label htmlFor="seat-left">{OFFSET_X_LABEL[x]}{OFFSET_X_HINT[x] && <small>…</small>}</label>` + `<input id="seat-left" type="number">`、縦は `seat-bottom` と `OFFSET_Y_LABEL` / `OFFSET_Y_HINT`。変更は `onChangeSeatPosition(seat.id, { left: Number(e.target.value) })`(縦は `bottom`)。`PresetPanel.tsx` :343〜:368 の形から `noteX` / `noteY`(発話演出の余白の注意)を除いたもの |
| 候補の見出し | `<div className="subhead">候補（上ほど優先）</div>` |
| 候補の行 | `<div className={`pair-item${プレビュー中 ? ' active' : ''}`}>` に `<button type="button" className="pair-recall" aria-label={`候補${i + 1}をプレビューで見る`} onClick={() => onPreviewCandidate(c.userId)}>{i + 1}. {userLabel} × {presetLabel}</button>`、`<button aria-label={`候補${i + 1}を上へ`}>上へ</button>`(先頭は disabled)、`<button aria-label={`候補${i + 1}を下へ`}>下へ</button>`(末尾は disabled)、`<button className="danger" aria-label={`候補${i + 1}を外す`}>外す</button>`。`userLabel` = `user.name \|\| user.id`、`presetLabel` = `preset.name \|\| '(無名プリセット)'` |
| 候補 0 人 | `<p className="empty">候補がいません。下から追加してください。</p>` |
| 追加欄 | `<label htmlFor="seat-add-user">追加するユーザー</label>` の select(選択肢は `${u.name}（${u.id}）`、CombinePanel の `userLabel` と同じ)、`<label htmlFor="seat-add-preset">プリセット</label>` の select(選択肢は `p.name \|\| '(無名プリセット)'`)、`<button className="primary">候補に追加</button>` |
| 同じユーザーが席にいる | 「候補に追加」を disabled にし、`<p className="hint">このユーザーはもう候補にいます（1 人 1 回まで）</p>` |
| ユーザーかプリセットが 0 件 | 追加欄の代わりに `<p className="empty">①でユーザーを、②でプリセットを1つ以上用意すると、候補を追加できます。</p>` |
| 出力 h2 | `出力 CSS（選択中の席）` |
| 出力の説明 | `<p className="hint"><b>1 席 = 1 ブラウザソース</b>の CSS です。候補のうち通話にいる人を、上の人を優先して 1 人だけ出します。</p>` |
| 口パクが入らない候補の注意 | 候補ごとに `role="status"` の `.hint`(色は `var(--warn)`): `「{userLabel} × {presetLabel}」の立ち絵の大きさが測れていないため、この候補の口パクは出力に入りません。`(条件は `OutputPanel` の `mouthUnavailable` :47 と同じ) |
| 画像が無い候補の注意 | 候補のプリセットの `imageUrl` が空白だけのとき、候補ごとに `role="status"` の `.hint`(色は `var(--warn)`): `「{userLabel} × {presetLabel}」に立ち絵の画像がありません。この人が通話にいる間は席に何も出ず、下の候補も出ません。`(出力からは飛ばさない = 優先順は登録どおり) |
| 出力が無い(席 0 件・候補 0 人) | `<p className="empty">候補を追加すると、ここに CSS が出ます。</p>` |
| 出力ブロック | `.output-block` の `.title` に `label`、ボタン `コピー` / `ダウンロード`(コピー後 1.5 秒 `コピーしました`)、`<textarea className="css-out" readOnly>`。`OutputPanel` :77〜:87 と同じ組み方 |
| ファイル名 | `cssFilename(`席-${label}`)`(例: `streamkit-席-ゲスト席.css`) |
| 貼り方 | `<ol className="paste-steps">`: ① `Discord の <b>Streamkit Overlay</b> で Voice Widget の URL を作る。` ② `OBS に <b>ブラウザソース</b>を 1 つ追加し、その URL を設定する（席 1 つにつき 1 つ）。` ③ `そのブラウザソースの <b>カスタムCSS</b> 欄に、この席の CSS を貼り付ける（既存は消す）。` |
| ヘッダーの説明(`App.tsx` :120〜:122) | `「誰（Discord ID）」と「見た目（立ち絵プリセット）」を別々に用意して、選んだ1組、または入れ替わりの席を出力します。` |

### 文書
| 対象 | 値 |
|---|---|
| `README.md` :48〜:50 の「まとめ版（1ソースに複数人）は提供しません。…」の段落の後 | 新しい小見出し `### 席（入れ替わり）= 1 席 = 1 ブラウザソース` と 3 行: `- ④ で「席」に候補（ユーザー × プリセット）を並べると、通話にいる候補の立ち絵がその席に出ます。` / `- 何人か同時にいるときはリストの上の人だけ、誰もいないときは何も出しません（擬似要素が 1 組しかないため、1 席に出せるのは 1 人）。` / `- 位置は席ごとに 1 つ決めます（誰が出ても同じ位置）。幅・名前・口パク・発話演出は候補ごとのプリセットに従います。` |
| `README.md` :28 付近の「ペアごとの個別出力」 | `ペアごとの個別出力と、候補が入れ替わる「席」の出力` |
| `README.md` :30 の見出し | `## 使い方（生成ツール・4ステップ）` |
| `README.md` :34(③ の行)の後 | `4. **④ 席（入れ替わり・任意）**：席を作り、候補（ユーザー × プリセット）を上から優先順に並べ、席の位置を決める。通話にいる候補のうち一番上の人だけが出る CSS（1 席 = 1 ブラウザソース）をコピー / ダウンロードできます。` |
| `public/guide.html` :9 の meta description | `3 ステップの手順` を `4 ステップの手順` に |
| `public/guide.html` `#obs` の 5 番目の `<li>`(:493)の「③ でコピーした CSS」 | `③（席は ④）でコピーした CSS` |
| `public/guide.html` `#steps` の ③ の `<li>` の後 | 新しい `<li>`: `<h3>席を作る（入れ替わり・任意）</h3>` `<p>ゲスト枠のように日によって人が変わる場所は、④ の <span class="ui">新しい席</span> で席を作り、<span class="ui">候補に追加</span> で人とプリセットを並べます。通話にいる人の立ち絵がその席に出ます。</p>` `<p>何人か同時にいるときはリストの上の人を出し、誰もいないときは何も出ません。順番は <span class="ui">上へ</span>・<span class="ui">下へ</span> で変えます。</p>` `<p>位置は <span class="ui">席の位置</span> で席ごとに 1 つ決めます（誰が出ても同じ位置）。幅・名前・演出は、その人のプリセットのままです。</p>` |
| `public/guide.html` `#steps` の `.sub`(①〜③ のタブ) | `①〜③` を `①〜④` に |
| `public/guide.html` `#obs` の `.note`(:496) | 末尾に `入れ替わりの席は、席 1 つにつきブラウザソース 1 つです。` を足す |

## テスト
- 席の CSS: 候補 0 人は案内のコメントだけ。1 人目の条件に `:not` が無く、k 人目には上の全員の `:not(:has(…))` が上から順に付く。
- 候補ごとの keyframe 名に `-c<k>` が付き、接尾辞なしの `@keyframes speak-jump {` が出ない。animation の値も同じ名前を指す。
- 発話中のルールは「出ている条件」と「その候補の img に発話クラス」の両方を含む。
- 名前は候補ごとの `::before` に、その人の名前で出る。名前 OFF の候補は `::before` を出さない。
- プリセットの `hideWhenAway: true` でも席の `::after` は `display: block;`。
- 口開き絵は実サイズが測れた候補だけ `:root` に入る。
- 席の名前に `*/` があってもコメントが閉じない。
- 既存の `generateStandaloneCss` / `generateCss` の出力は変わらない(既存の `generateCss.test.ts` を書き換えずに緑)。
- 保存: `seats` の無い古いデータは `[]`。壊れた席・消えたユーザー/プリセットを指す候補・同じユーザーの 2 回目・同じ id の席は落ちる。
- 位置: `seatPreset` は位置の 4 つだけを席の値にし、他はプリセットのまま・元を変えない。席の位置は保存・読み込みで壊れない(不正なら左下・0)。
- 画面: ④ で席を作る → 名前 → 候補 2 人 → 出力 CSS に両方の条件。上へ / 下へで優先が入れ替わる。同じユーザーは追加できない。① のユーザー削除で候補が消える。再描画しても残る。席の位置を変えると出力が追従する。候補を押すとプレビューの人が変わる。
- 実ブラウザ: 在室の組み合わせ 4 通りで描かれる色と位置(プリセットの位置が違っても、どちらも席の位置に出る)。出ていない候補が話しても、出ている候補は動かない。

## テストケース
共通の前提(単体): `const A: TachieUser = { id: '111111111111111111', name: 'ゲストA', imageUrl: 'data:image/png;base64,AAAA' }`、`B` は `222222222222222222` / `ゲストB` / `BBBB`、`C` は `333333333333333333` / `ゲストC` / `CCCC`。`opts = presetToOptions(makeDefaultPreset('p'), 600, 900)`(実サイズあり = 背景画像方式)。`SA = 'body:has(img[src*="avatars/111111111111111111"])'`、`SB = SA の avatars/222… 版`。
`state.test.ts` の ST2〜ST6 は `toEqual` で比べ、**表で位置を書いていない席の期待値には既定の位置 `anchorX: 'left', anchorY: 'bottom', left: 0, bottom: 0` を足して書く**(`normalizeSeat` は常に 4 つを付けて返す)。
App の画面テスト(AS*)で「出力」と書いたものは、`App.test.tsx` :89〜:90 と同じく `within(screen.getByRole('heading', { name: /出力 CSS/ }).closest('.panel')!).getByRole('textbox')` の値(④ には `席の名前` の textbox もあるため、必ずこの範囲に絞る)。

| テスト名 | 置き場(ファイル) | 入力・前提 | 期待値 |
|---|---|---|---|
| `describe('seatActiveSelector')` › `S1 1 人目は :not なし、k 人目は上の全員を :not で除く` | `src/lib/generateCss.test.ts`(末尾に `describe` を追記) | `seatActiveSelector(['111', '2a22', '333'], 0)` / `(…, 1)` / `(…, 2)` | `'body:has(img[src*="avatars/111"])'` / `'body:has(img[src*="avatars/222"]):not(:has(img[src*="avatars/111"]))'` / `'body:has(img[src*="avatars/333"]):not(:has(img[src*="avatars/111"])):not(:has(img[src*="avatars/222"]))'` |
| `describe('generateSeatCss')` › `S2 候補 0 人は案内のコメントだけ` | `src/lib/generateCss.test.ts` | `generateSeatCss('ゲスト席', [])` | `'/* 席に候補がいません。④ で候補を追加してください。 */\n'` と一致 |
| `S3 候補 2 人の立ち絵は排他の条件で出る` | `src/lib/generateCss.test.ts` | `generateSeatCss('ゲスト席', [{ user: A, options: opts }, { user: B, options: opts }])` | `${SA}::after {` を含む / `${SB}:not(:has(img[src*="avatars/111111111111111111"]))::after {` を含む / 行頭が `body::after {` の行を含まない / 先頭が `/* 席「ゲスト席」: 候補 2 人。` |
| `S4 keyframe 名は候補ごとに別` | `src/lib/generateCss.test.ts` | S3 と同じ入力(`DEFAULT_SPEAK` = bounce と outline が ON) | `@keyframes speak-jump-c1 {` / `@keyframes speak-jump-c2 {` / `@keyframes speak-light-c1 {` / `750ms infinite alternate ease-in-out speak-jump-c2` を含む / `@keyframes speak-jump {` を含まない |
| `S5 発話中ルールは出ている条件と本人の発話の両方` | `src/lib/generateCss.test.ts` | S3 と同じ入力 | `${SB}:not(:has(img[src*="avatars/111111111111111111"])):has(img[src*="avatars/222222222222222222"][class*="Voice_avatarSpeaking__"])::after {` を含む |
| `S6 名前は候補ごとの ::before に出る` | `src/lib/generateCss.test.ts` | A に `displayName: 'エー'`、B に `displayName: 'ビー'`、両方 `options: { ...opts, nameLabel: { ...DEFAULT_NAME_LABEL, show: true } }` | `${SA}::before {` の後に `content: "エー";`、`${SB}:not(:has(img[src*="avatars/111111111111111111"]))::before {` の後に `content: "ビー";` を含む |
| `S7 名前 OFF の候補は ::before を出さない` | `src/lib/generateCss.test.ts` | S3 と同じ入力(`DEFAULT_NAME_LABEL.show` は false) | `::before {` を含まない / 末尾近くに `[class*="Voice_name__"], [class*="Voice_user__"] {` を含む |
| `S8 プリセットの「通話にいないときは隠す」は席では効かない` | `src/lib/generateCss.test.ts` | `[{ user: A, options: { ...opts, hideWhenAway: true } }]` | `${SA}::after {` のブロック内に `display: block;` を含み、`display: none;` を含まない |
| `S9 口開き絵は実サイズが測れた候補だけ` | `src/lib/generateCss.test.ts` | A に `mouthImageUrl: 'data:image/png;base64,MMMM'` と `opts`、B に `mouthImageUrl: 'data:image/png;base64,NNNN'` と `presetToOptions(makeDefaultPreset('p'))`(実サイズなし) | `--img-mouth-url-111111111111111111` と `@keyframes speak-mouth-c1 {` と `steps(1, end) speak-mouth-c1` を含む / `--img-mouth-url-222222222222222222` と `speak-mouth-c2` を含まない |
| `S10 席の名前でコメントを閉じられない` | `src/lib/generateCss.test.ts` | `generateSeatCss('a*/b{}', [{ user: A, options: opts }])` | 先頭行が `/* 席「a* /b{}」: 候補 1 人。` で始まる / 1 行目に `*/` が 1 回だけ(行末) |
| `S11 席の名前が空なら「無名の席」` | `src/lib/generateCss.test.ts` | `generateSeatCss('  ', [{ user: A, options: opts }])` | `/* 席「無名の席」: 候補 1 人。` で始まる |
| `S12 常時表示の出力は変わらない` | `src/lib/generateCss.test.ts` | 既存の `describe` 群(書き換えない) | 既存のテストが全部緑 |
| `describe('normalizeState')` › `ST1 seats の無い古いデータは []` | `src/lib/state.test.ts` | `normalizeState({ users: [], presets: [] })` | `.seats` が `[]`(`EMPTY` 定数にも `seats: []` を足す) |
| `ST2 席の候補は実在するユーザー × プリセットだけ` | `src/lib/state.test.ts` | users `[{ id: '1', name: 'a' }]`、presets `[{ id: 'p1', name: 'A' }]`、seats `[{ id: 's1', name: '席', candidates: [{ userId: '1', presetId: 'p1' }, { userId: '9', presetId: 'p1' }, { userId: '1', presetId: 'x' }, 5] }]` | `.seats` が `[{ id: 's1', name: '席', candidates: [{ userId: '1', presetId: 'p1' }] }]` |
| `ST3 同じユーザーの 2 回目は落とす` | `src/lib/state.test.ts` | users `1`,`2`、presets `p1`,`p2`、candidates `[{1,p1},{2,p1},{1,p2}]` | candidates が `[{1,p1},{2,p1}]` |
| `ST4 壊れた席は落とし、名前は文字列に` | `src/lib/state.test.ts` | seats `[null, { name: 'x' }, { id: '', name: 'y' }, { id: 's2', name: 3 }, { id: 's3', name: 'z', candidates: 'x' }]` | `.seats` が `[{ id: 's2', name: '', candidates: [] }, { id: 's3', name: 'z', candidates: [] }]` |
| `ST5 同じ id の席は最初の 1 件` | `src/lib/state.test.ts` | seats `[{ id: 's1', name: 'a' }, { id: 's1', name: 'b' }]` | `.seats` が `[{ id: 's1', name: 'a', candidates: [] }]` |
| `ST6 seats が配列でなければ []` | `src/lib/state.test.ts` | `normalizeState({ users: [], presets: [], seats: {} })` | `.seats` が `[]` |
| `ST7 席の位置は不正なら既定に` | `src/lib/state.test.ts` | seats `[{ id: 's1', name: 'a', anchorX: 'x', anchorY: 3, left: 'a', bottom: NaN }, { id: 's2', name: 'b', anchorX: 'right', anchorY: 'top', left: 12, bottom: -5 }]` | s1 が `anchorX: 'left', anchorY: 'bottom', left: 0, bottom: 0`、s2 が `anchorX: 'right', anchorY: 'top', left: 12, bottom: -5` |
| `describe('makeDefaultSeat')` › `SE1 左下・距離 0・候補なし` | `src/lib/types.test.ts` | `makeDefaultSeat('s1')` | `{ id: 's1', name: '', anchorX: 'left', anchorY: 'bottom', left: 0, bottom: 0, candidates: [] }` と一致 |
| `describe('seatPreset')` › `SE2 位置だけ席の値に` | `src/lib/types.test.ts` | `p = { ...makeDefaultPreset('p1'), imageUrl: 'data:a', width: 300, left: 100, bottom: 50, anchorX: 'center', anchorY: 'middle' }`、`seatPreset(p, { anchorX: 'right', anchorY: 'top', left: 20, bottom: 10 })` | 戻り値が `anchorX: 'right', anchorY: 'top', left: 20, bottom: 10`、`width` `300`・`imageUrl` `'data:a'` は p のまま / `p.left` は `100` のまま(元を変えない) |
| `describe('App ④ 席')` › `AS1 ④ に席の画面がある` | `src/App.seat.test.tsx`(新規。`App.mouth.test.tsx` と同じく `vi.mock('./lib/image', …)` で `measureNaturalSize` を `{ width: 600, height: 900 }` に固定) | 「次へ」を 3 回 | `heading` `席（入れ替わり）` / `席はまだありません。「新しい席」で作ります。` / `候補を追加すると、ここに CSS が出ます。` |
| `AS2 席を作って候補 2 人を並べると両方の条件が出る` | `src/App.seat.test.tsx` | ① で `111111111111111111`(ゲストA)・`222222222222222222`(ゲストB)を追加 → ② で画像付きプリセットを 1 つ(`App.mouth.test.tsx` の `addPresetWithImage` と同じ手順)→ ④ で「新しい席」→ `席の名前` に `ゲスト席` → 追加するユーザー A で「候補に追加」→ B で「候補に追加」 | 出力の textbox の値が `/* 席「ゲスト席」: 候補 2 人。` で始まり、`body:has(img[src*="avatars/222222222222222222"]):not(:has(img[src*="avatars/111111111111111111"]))::after` を含む / 席の行 `席「ゲスト席」を選ぶ` の文字が `ゲスト席（候補 2 人）` |
| `AS3 下へで優先が入れ替わる` | `src/App.seat.test.tsx` | AS2 の後に `候補1を下へ` | 出力に `body:has(img[src*="avatars/111111111111111111"]):not(:has(img[src*="avatars/222222222222222222"]))::after` を含む / `候補1を上へ` が disabled |
| `AS4 同じユーザーは 2 回目を追加できない` | `src/App.seat.test.tsx` | AS2 の途中、A を追加した直後に追加するユーザーが A のまま | 「候補に追加」が disabled / `このユーザーはもう候補にいます（1 人 1 回まで）` が出る |
| `AS5 ① でユーザーを消すと候補から消える` | `src/App.seat.test.tsx` | AS2 の後に ① へ戻って ゲストA を削除 → ④ | `候補1を外す` はあるが `候補2を外す` が無い / 出力に `avatars/111111111111111111` を含まない |
| `AS6 再描画しても席が残る` | `src/App.seat.test.tsx` | AS2 の後に `cleanup()` → `render(<App />)` → ④ | `席「ゲスト席」を選ぶ` がある / 出力に両方の ID を含む |
| `AS7 席を消すと出力が空に戻る` | `src/App.seat.test.tsx` | AS2 の後に `席「ゲスト席」を削除` | `席はまだありません。「新しい席」で作ります。` と `候補を追加すると、ここに CSS が出ます。` が出る |
| `AS9 席の位置が出力とプレビューに効く` | `src/App.seat.test.tsx` | AS2 の後に、基準の位置の `右下` を押し、`右端からの距離(px)` に `20` | 出力に `right: 20px;` を含み、`left: 0px;` を含まない(② のプリセットは左下のまま)/ ④ のプレビューの `img.tp-img` の `style.right` が空でなく、`style.left` が空(`TachiePreview.tsx` :140〜:143 の `figStyle` がアンカーに応じた辺だけを出す) |
| `AS10 候補を押すとプレビューの人が変わる` | `src/App.seat.test.tsx` | AS2 の後 | 最初は `heading` `プレビュー（ゲストA）`。`候補2をプレビューで見る` を押すと `プレビュー（ゲストB）` |
| `AS11 外すと出力から消える` | `src/App.seat.test.tsx` | AS2 の後に `候補2を外す` | 出力に `avatars/222222222222222222` を含まない / 席の行が `ゲスト席（候補 1 人）` |
| `AS12 上へで優先が戻る` | `src/App.seat.test.tsx` | AS3 の後に `候補2を上へ` | 出力に `body:has(img[src*="avatars/222222222222222222"]):not(:has(img[src*="avatars/111111111111111111"]))::after` を含む |
| `AS13 ② でプリセットを消すと候補から消える` | `src/App.seat.test.tsx` | AS2 の後に ② へ戻ってそのプリセットを削除 → ④ | `候補がいません。下から追加してください。` と `候補を追加すると、ここに CSS が出ます。` が出る |
| `AS14 画像の無い候補には注意が出る` | `src/App.seat.test.tsx` | ① で ゲストA → ② で画像を設定しないプリセットを 1 つ(`新規プリセット` だけ)→ ④ で席を作り A を追加 | `「ゲストA × (無名プリセット)」に立ち絵の画像がありません。` を含む `role="status"` が出る |
| `AS8 ③ の出力は変わらない` | `src/App.test.tsx`(既存。書き換えない) | 既存のテスト | 全部緑 |
| `describe('useImageNaturalSizes')` › `U1 URL ごとに測り、空は測らない` | `src/ui/useImageNaturalSize.test.tsx`(新規。`vi.mock('../lib/image', …)` で `measureNaturalSize` を url → `{ width: url.length, height: 1 }` に) | `renderHook(() => useImageNaturalSizes(['data:a', '', 'data:bb', 'data:a']))` | 最終的に `{ 'data:a': { width: 6, height: 1 }, 'data:bb': { width: 7, height: 1 } }`、`measureNaturalSize` の呼び出しは 2 回 |
| `R8 席: 1 番目だけ在室なら 1 番目だけ、席の位置に描かれる` | `e2e/render.spec.ts`(末尾に追記) | 下の「e2e の前提」で `imgs = [{ id: '42' }]` | 赤の外接矩形が `{ left: 1620, right: 1920, bottom: 1080 }`(±1px。プリセットは左下だが席は右下)/ 青の `right` が 0 |
| `R9 席: 2 番目だけ在室なら 2 番目が同じ席の位置に描かれる` | `e2e/render.spec.ts` | `imgs = [{ id: '43' }]` | 青の外接矩形が `{ left: 1620, right: 1920, bottom: 1080 }`(±1px。プリセットは下中央だが席は右下)/ 赤の `right` が 0 |
| `R10 席: 2 人とも在室なら上の候補だけ` | `e2e/render.spec.ts` | `imgs = [{ id: '43' }, { id: '42' }]`(DOM の順は逆にしておく) | 赤が R8 と同じ位置 / 青の `right` が 0 |
| `R11 席: 誰もいなければ何も描かれない` | `e2e/render.spec.ts` | `imgs = []` | `page.evaluate` で `getComputedStyle(document.body, '::after').content` と `getComputedStyle(document.body, '::before').content` が両方 `'none'`(描画を待たずに決まる判定) |
| `R12 席: 出ていない候補が話しても、出ている候補は動かない` | `e2e/render.spec.ts` | `imgs = [{ id: '42' }, { id: '43', speaking: true }]` | `document.getAnimations()` の `CSSAnimation` の `animationName` に `-c1` で終わるものも `-c2` で終わるものも無い |
| `R13 席: 出ている候補が話すとその候補の演出だけ動く` | `e2e/render.spec.ts` | `imgs = [{ id: '42', speaking: true }, { id: '43' }]` | `animationName` に `speak-jump-c1` がある / `-c2` で終わるものが無い |

### e2e の前提(`e2e/render.spec.ts` に足すヘルパー)
```ts
/** 席の CSS と、通話にいる人ぶんの img を置く。speaking なら発話クラスを付ける。 */
async function renderSeatPage(page: Page, imgs: Array<{ id: string; speaking?: boolean }>): Promise<void>
```
- import に `generateSeatCss`(`../src/lib/generateCss`)と `DEFAULT_SPEAK` / `makeDefaultPreset` / `presetToOptions` / `seatPreset`(`../src/lib/types`)を足す。
- 赤 `makeColorImageDataUrl(page, '#ff0000')` を候補 1(id `42`)、青 `#0000ff` を候補 2(id `43`)。
- 両方のプリセットは `{ ...makeDefaultPreset('p<k>'), imageUrl: <色の data URI>, width: 300, speak: { ...DEFAULT_SPEAK, outline: false } }`(枠の色が外接矩形に混ざらないよう outline だけ OFF。bounce は ON のまま = R12・R13 の animation の有無に使う。名前は既定で OFF)。
  候補 1 のプリセットは `anchorX: 'left'`、候補 2 は `anchorX: 'center'`(どちらも `anchorY: 'bottom'`、距離 0)。
  席は `{ anchorX: 'right', anchorY: 'bottom', left: 0, bottom: 0 }`。options は `presetToOptions(seatPreset(preset, 席), 600, 900)`。
- CSS は `generateSeatCss('render-seat', [{ user: 赤, options: o1 }, { user: 青, options: o2 }])`。
- img は `<img src="http://127.0.0.1:9/avatars/<id>.png">`(発話は `class="Voice_avatarSpeaking__x"` を足す)。`renderMouthPage`(:110)と同じ `page.setContent` の組み方。
- 位置の判定は R8〜R10 で bounce の途中が撮られないよう、`imgs` に発話が無い(静止)状態で測る。外接矩形は `measureColorBoundingBox` を `expect.poll` で(`expectMouthColor` :144 と同じ待ち方)。

## 実装ブロック
| ブロック | 対象タスク | 触るファイル | 確認コマンド |
|---|---|---|---|
| B1 | T1 | `src/lib/types.ts`, `src/lib/types.test.ts`, `src/lib/state.ts`, `src/lib/state.test.ts`, `src/App.tsx`(`seats` を読み込んで `saveState` に渡す 3 行だけ) | `npm run typecheck && npm run lint && npx vitest run src/lib` |
| B2 | T2 | `src/lib/generateCss.ts`, `src/lib/generateCss.test.ts`(末尾に追記のみ) | `npm run typecheck && npm run lint && npx vitest run src/lib` |
| B3 | T3, T5 | `src/ui/anchorLabels.ts`(新規), `src/ui/PresetPanel.tsx`(定数の移動だけ), `src/ui/useImageNaturalSize.ts`, `src/ui/useImageNaturalSize.test.tsx`(新規), `src/ui/SeatPanel.tsx`(新規), `src/ui/SeatOutputPanel.tsx`(新規), `src/App.tsx`, `src/App.seat.test.tsx`(新規), `src/index.css`, `README.md`, `public/guide.html` | `npm run typecheck && npm run lint && npx vitest run` |
| B4 | T4 | `e2e/render.spec.ts` | `npx playwright install chromium && npx playwright test` |

人手の T6 はブロックに入れない(OBS 実機)。

## 依存 / 前提
- B2 は B1 の後(`Seat` は使わないが、`AppState` の変更で typecheck が通る状態から始める)。B3 は B1 と B2 の後(`Seat` と `generateSeatCss` を使う)。B4 は B2 の後。
- 006(口パク)と 004(実ブラウザの基盤 `e2e/`・`playwright.config.ts`)は main に入っている。

## リスク / 降りる箇所
- **在室の判定**: Streamkit が「通話にいる人の img だけを DOM に出す」前提(001 から)。T6 で、候補 2 人(本人のアカウントと、もう 1 つのアカウント)の席を OBS 32 系のブラウザソースに貼り、片方ずつ通話に出入りして、出る人が数秒以内に入れ替わるかを見る。抜けた人の img が残って入れ替わらない場合は、**実装側で判定方法(`li` の `data-userid` など)に切り替えず止めて**人に返す。
- **`:not(:has())` の対応**: OBS 内蔵ブラウザ(CEF)で `:has()` は 001 から使えているが、`:not(:has())` の組み合わせは未確認。T6 で 2 人とも在室にしたとき、上の候補だけが出るかを見る。両方出る・どちらも出ない場合は止めて人に返す。
- **CSS の長さ**: 候補ごとに画像の data URI が入る。T6 で候補 3 人の席の CSS を OBS のカスタム CSS 欄に貼り、末尾(`@keyframes`)まで保存されるかを見る(貼った後に欄を開き直して末尾を確認)。切れる場合の対処は人が決める。
- **保存容量**: 席は id の参照だけなので画像は増えない(`saveState` の容量超過を黙って捨てる挙動は変えない)。
