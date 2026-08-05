---
feature: position-anchor
test: npm run typecheck && npm run lint && npx vitest run
---

# 実装計画 — 立ち絵の基準位置(アンカー)を9通りから選ぶ ＋ 画像クロップ

> plan.md — 「どう作るか」。spec.md の受け入れ条件を満たす設計。

## アプローチ
- `Preset` / `GenerateOptions` に `anchorX: 'left'|'center'|'right'` と `anchorY: 'top'|'middle'|'bottom'` を
  **任意フィールド**で足し、未指定は `left`/`bottom`(= 現状互換)に落とす。
- 既存の `left` / `bottom` は**意味だけ変える**(「選んだアンカーからの距離」)。フィールド名は据え置き
  (`offsetX`/`offsetY` への改名は localStorage 互換とコンフリクト面積を考えて**やらない**)。
- CSS は**位置プロパティの出し分け**で作る:

  | anchorX | 出力 |
  |---|---|
  | `left` | `left: <X>px;` |
  | `center` | `left: calc(50% + <X>px);` + translate に `-50%`（X=0 なら `left: 50%;`） |
  | `right` | `right: <X>px;` |

  縦も同様。ただし **縦の中央は `top` ではなく `bottom` 基準**にする(T2 実装時に確定):
  `bottom: calc(50% + <Y>px)` + `translateY(50%)`。`bottom` アンカーと同じく **「正の Y = 上」を保つ**ため
  (`top` 基準にすると中央アンカーだけオフセットの符号が反転して事故る)。
- **中央寄せのズレ量は位置側(`calc`)に載せ、`transform` は「中央寄せ分」だけに保つ**(T2 実装時に確定)。
  当初は translate 側に `calc(-50% + <X>px)` を書く形で考えていたが、それだと「中央寄せ分」と
  「オフセット分」が transform の中で混ざり、発話演出・名前帯の translate と合成したときに
  どの断片が何なのか追えなくなる。位置側に寄せると transform は常に定数(`translateX(-50%)` /
  `translateY(50%)`)になり、合成が単なる連結で済む。
- **`transform` の一元管理**を入れる。中央寄せの `translate` と発話演出の `translateY` を別々に書くと後勝ちで壊れるため、
  「中央寄せ分の translate」を返す小さな純粋関数を作り、`body::after` の静止時 `transform` と
  `@keyframes speak-jump` の**両方が同じ関数の結果を前置**する形にする(spec の案1)。
  **`transform` を出す箇所は3つある**(002 マージ後の実測): ①立ち絵の静止時 ②`@keyframes speak-jump`
  ③名前ラベル `body::before` の帯アンカー(`translateX(-50%)` / `translateX(-100%)`,
  [`generateCss.ts:181`](../../src/lib/generateCss.ts))。**この3つを1つの合成関数に通す**のが不変条件。
  → T3 で `composeTransform(...parts)` に一本化済み(空なら宣言を出さない)。
  `positionDecls` が返す `centering` を**静止時と `speak-jump` の両方が前置する**形にした。

### 名前ラベル(002)のアンカー追従
- 現状の `nameBlock` は `left: <立ち絵のleft + offsetX + 帯補正>px` / `bottom: <立ち絵のbottom + offsetY>px` を
  数値で焼く([`generateCss.ts:180`](../../src/lib/generateCss.ts))。**左下基準の座標系に固定**されている。
- 立ち絵の位置生成を `positionDecls(anchors, x, y)` に切り出したので(T2 完了)、**名前ラベルも同じ関数を通す**。
  シグネチャは「アンカー + **アンカーからの距離** → 位置宣言 + `centering` 断片」。
  名前側は「立ち絵の距離 + オフセット」を渡すが、**距離はアンカー基準なので方向の変換が要る**。

  | anchorX | 立ち絵 | 名前(画面座標のズレ `dx`。正で右) |
  |---|---|---|
  | `left` | `left: X px` | `left: (X + dx) px` |
  | `right` | `right: X px` | `right: (X − dx) px` ※ dx の符号が反転する |
  | `center` | `left: calc(50% + X px)` + `translateX(-50%)` | `left: calc(50% + (X + dx) px)` + `translateX(-50%)` |

  **右アンカーでオフセットの符号が反転する**のが事故りやすい箇所。「名前を立ち絵より右にずらす」は
  右アンカーでは `right` を減らす方向になる。縦も同じで、**`top` アンカーでは `dy` が反転する**
  (`bottom` / `middle` は「正の dy = 上」で反転しない)。ここは vitest で固定する。
- **帯アンカー(`fit: 'text'` の行揃え)の translate も、右/上アンカーでは向きが変わる。**
  `right: D` に対する `translateX(-100%)` は左へ動く＝右端からの距離が増える方向なので、
  左下基準のときと同じ符号では成立しない。T9 で `positionDecls` 側に寄せて詰める。

### クロップ
- **CSS には一切出さない。** 取り込み済み画像を canvas で切り抜き、結果の data URI で `Preset.imageUrl` を
  上書きする(破壊的)。`generateCss` / 出力フォーマットは**無改修**。
- **判断のいる部分を純粋関数に寄せて vitest 対象にする**(canvas は DOM 依存で単体テストしにくいため、
  既存の `image.ts` が `computeResizeDimensions` を切り出しているのと同じ方針):

  | 関数 | 責務 | 純粋か |
  |---|---|---|
  | `normalizeCropRect(rect, dims)` | 画像内へクランプ・整数化・最小 1px 保証・空矩形の拒否 | 純粋 |
  | `computeTrimBounds(pixels, dims, alphaThreshold)` | アルファがしきい値以下の外周を落とす矩形を返す | 純粋(`Uint8ClampedArray` を受ける) |
  | `cropDataUri(dataUrl, rect)` | 実際の切り抜き(canvas)。内部で `normalizeCropRect` を通す | DOM 依存 |
  | `detectTrimRect(dataUrl, threshold)` | 画像を読んで `getImageData` → `computeTrimBounds` | DOM 依存 |

- `computeTrimBounds` は「全面不透明 → 原寸のまま」「全面透明 → **トリムしない**(全消しを避けて安全側に倒す)」を
  明示的に返す。しきい値は既定 `alpha <= 0`(完全透明のみ)。
- 出力は **PNG 固定**(透過保持)。切り抜き後の再リサイズはしない。
- UI は PresetPanel の画像ブロックに置く。「余白を詰める」ボタン(自動)と「範囲を指定して切り抜き」
  (プレビュー上のドラッグ + `x`/`y`/`幅`/`高さ` の数値入力)の2経路。適用は確認を挟み、
  **元に戻せない**旨をその場に出す。

## 主要コンポーネント / 変更点
| 層 | 変更 |
|---|---|
| `src/lib/types.ts` | `GenerateOptions` / `Preset` に `anchorX` / `anchorY`(任意)。`DEFAULT_OPTIONS` は `left`/`bottom`。`presetToOptions` で受け渡し |
| `src/lib/generateCss.ts` | 位置宣言の生成を関数に切り出し(`positionDecls`)。`KEYFRAMES_JUMP_TRANSFORM` を「中央寄せ translate を前置する」形に変更。**`nameBlock` の `left`/`bottom` 直書きを `positionDecls` 経由に置換し、帯の `transform` と中央寄せ分を合成**。`generateCombinedCss` は型の整合のみ(挙動は据え置き) |
| `src/lib/state.ts` | 保存済み `Preset` 読み込み時に `anchorX`/`anchorY` 欠損を既定値で補完(マイグレーション) |
| `src/ui/PresetPanel.tsx` | 「位置とサイズ」に 3×3 のアンカー選択を追加。オフセットのラベルをアンカーに追従(「左端からの距離」⇄「右端からの距離」)。画像ブロックにクロップUI(余白を詰める / 範囲指定)とクロップ後寸法の表示 |
| `src/ui/TachiePreview.tsx` | プレビューの配置をアンカーに追従。クロップは `imageUrl` が差し替わるだけなので**追加対応なし** |
| `src/lib/crop.ts`(新規) | `normalizeCropRect` / `computeTrimBounds`(純粋)+ `cropDataUri` / `detectTrimRect`(canvas) |
| `src/lib/crop.test.ts`(新規) | 矩形の正規化と余白検出の境界ケース(はみ出し・負値・幅0・小数・全面不透明・全面透明・片側のみ余白) |
| `src/lib/generateCss.test.ts` | 9通り × 発話演出のスナップショット的アサーション。既存(左下)の出力が**変わらない**ことを固定 |

## 依存 / 前提
- **002(custom-name-display)は 2026-08-05 にマージ済み**(PR #21 / main `344cb06`)。着手可。
  当初「名前は立ち絵アンカーに自動追従する想定(追従しなければ 003 側で吸収する)」と書いたが、
  **実装を確認したところ追従しない**ため、**吸収する側に確定**した(上記「名前ラベルのアンカー追従」)。
- 002 で `generateCss.ts` +213行 / `PresetPanel.tsx` +325行 / `TachiePreview.tsx` +134行 と
  大きく変わっている。**この plan の変更点は着手時に実物と突き合わせる**。
- 002 は名前OFF出力のゴールデンテストを持つ。**それを壊さないことが 003 の回帰ラインになる**。
- 保存形式は localStorage。破壊的変更は不可。

## リスク / 降りる箇所
- **`transform` 衝突**(spec 参照)。案1(keyframes に織り込む)で進める。
  **「`light`(枠・後光)や `blink` が transform を使い始めたら再発する」と書いていたが、002 の名前ラベルが
  すでに `transform` を使い始めたので、再発条件は満たされている。** 対象は立ち絵の静止時 /
  `speak-jump` / 名前ラベルの3箇所。**「transform を出す箇所は必ず合成関数を通す」**を
  コード側の不変条件として明示する(コメント + テスト)。
- **既存出力のバイト一致**。左下アンカー時に空白や宣言順が変わると回帰テストが落ちる。
  位置宣言の生成を切り出すときに順序を保つこと。
- 縦中央(`middle`)は Streamkit の実運用でほぼ使われない見込み。**UI に出すが動作確認は薄くなる**可能性がある。
- **クロップは元に戻せない**(破壊的・spec の「降りる箇所」)。UI で警告を出しても事故は起きうる。
  最低限、**適用前に確認ダイアログ**を挟むこと。非破壊にする設計変更は別 feature。
- **切り抜きで CSS が肥大しないか。** クロップは基本的に画素を減らすので data URI は小さくなるが、
  **元が JPEG/WebP でも出力は PNG 固定**のため、写真的な画像では逆に膨らむことがある。
  クロップ後のサイズを UI に出して気づけるようにする(既存の埋め込みサイズ表示に乗せる)。
- **`getImageData` の CORS 汚染。** 外部URL取り込み(`imageSource`)を data URI 化せずに読むと canvas が汚染され
  `getImageData` が例外になる。クロップは**data URI 化済みの画像にだけ**掛ける(現行の取り込み経路はそうなっている)。
  例外は握り潰さず「この画像はクロップできません」と出す。
- `crop.ts` は 002 / アンカー本体と**ファイルが重ならない**(新規 + `PresetPanel.tsx` のみ)。
  アンカー側のタスクと**並行して進められる**。
