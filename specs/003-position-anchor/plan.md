---
feature: position-anchor
test: npm run typecheck && npm run lint && npx vitest run
---

# 実装計画 — 立ち絵の基準位置(アンカー)を9通りから選ぶ

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
  | `center` | `left: 50%;` + translate に `-50%` |
  | `right` | `right: <X>px;` |

  縦も同様(`top` / `top: 50%` + `-50%` / `bottom`)。
- **`transform` の一元管理**を入れる。中央寄せの `translate` と発話演出の `translateY` を別々に書くと後勝ちで壊れるため、
  「中央寄せ分の translate」を返す小さな純粋関数を作り、`body::after` の静止時 `transform` と
  `@keyframes speak-jump` の**両方が同じ関数の結果を前置**する形にする(spec の案1)。

## 主要コンポーネント / 変更点
| 層 | 変更 |
|---|---|
| `src/lib/types.ts` | `GenerateOptions` / `Preset` に `anchorX` / `anchorY`(任意)。`DEFAULT_OPTIONS` は `left`/`bottom`。`presetToOptions` で受け渡し |
| `src/lib/generateCss.ts` | 位置宣言の生成を関数に切り出し(`positionDecls(options)`)。`KEYFRAMES_JUMP_TRANSFORM` を「中央寄せ translate を前置する」形に変更。`generateCombinedCss` は型の整合のみ(挙動は据え置き) |
| `src/lib/state.ts` | 保存済み `Preset` 読み込み時に `anchorX`/`anchorY` 欠損を既定値で補完(マイグレーション) |
| `src/ui/PresetPanel.tsx` | 「位置とサイズ」に 3×3 のアンカー選択を追加。オフセットのラベルをアンカーに追従(「左端からの距離」⇄「右端からの距離」) |
| `src/ui/TachiePreview.tsx` | プレビューの配置をアンカーに追従 |
| `src/lib/generateCss.test.ts` | 9通り × 発話演出のスナップショット的アサーション。既存(左下)の出力が**変わらない**ことを固定 |

## 依存 / 前提
- **002(custom-name-display)のマージ待ち。** 同じ4ファイルを触るため、先に 002 を入れる。
  002 の名前ラベルは「立ち絵からの相対位置」なので、立ち絵アンカーの変更に自動で追従する想定
  (追従しない実装だったら 003 側で吸収する)。
- 保存形式は localStorage。破壊的変更は不可。

## リスク / 降りる箇所
- **`transform` 衝突**(spec 参照)。案1(keyframes に織り込む)で進めるが、`light`(枠・後光)や `blink` が
  `transform` を使い始めたら同じ問題が再発する。**「transform を触る演出は必ず中央寄せ分を前置する」**を
  コード側の不変条件として明示する(コメント + テスト)。
- **既存出力のバイト一致**。左下アンカー時に空白や宣言順が変わると回帰テストが落ちる。
  位置宣言の生成を切り出すときに順序を保つこと。
- 縦中央(`middle`)は Streamkit の実運用でほぼ使われない見込み。**UI に出すが動作確認は薄くなる**可能性がある。
