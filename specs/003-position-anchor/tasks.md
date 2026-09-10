---
feature: position-anchor
---

# タスク — 立ち絵の基準位置(アンカー)を9通りから選ぶ ＋ 画像クロップ

> tasks.md — 実作業の分解。各タスクは GitHub sub-issue(type: Task)と対応。
> `- [ ]` 未完 / `- [x]` 完了。sub-issue 採番後に `<!-- #NN -->` を付す。

- [x] T1: 型と既定値 — `GenerateOptions` / `Preset` に `anchorX`/`anchorY`(任意)を追加、`presetToOptions` で受け渡し、保存済みデータの欠損補完  <!-- #12 -->
- [x] T2: `generateCss` の位置生成をアンカー対応に — 位置宣言の切り出し + `left`/`right`/`top`/`bottom`/`50%` の出し分け + vitest(9通り・左下は従来出力と一致)  <!-- #13 -->
- [x] T3: `transform` 衝突の解消 — transform を出す3箇所(立ち絵の静止時 / `speak-jump` / 名前ラベルの帯アンカー)を合成関数に一本化。中央寄せ × ぴょこぴょこ × 名前帯の vitest  <!-- #14 -->
- [x] T4: UI — 3×3 のアンカー選択 + オフセットのラベル追従(PresetPanel)  <!-- #15 -->
- [x] T5: プレビューのアンカー追従(TachiePreview)  <!-- #16 -->
- [x] T6: クロップの純粋関数 — `src/lib/crop.ts` に `normalizeCropRect`(クランプ/整数化/空矩形の拒否)と `computeTrimBounds`(透明余白の検出。全面透明はトリムしない)+ 境界ケースの vitest  <!-- #17 -->
- [x] T7: 焼き込み — `cropDataUri` / `detectTrimRect`(canvas, PNG 固定・再リサイズなし)。CORS 汚染で `getImageData` が失敗する経路のエラーハンドリング  <!-- #18 -->
- [x] T8: クロップ UI(PresetPanel) — 「余白を詰める」+ 範囲指定(ドラッグ + x/y/幅/高さ の数値入力)、適用前の確認と「元に戻せません」表示、クロップ後の寸法・埋め込みサイズの表示  <!-- #19 -->
- [x] T9: 名前ラベル(002)のアンカー追従 — `nameBlock` の `left`/`bottom` 直書きを `positionDecls` 経由へ。右アンカーでのオフセット符号反転と中央アンカーの `calc(-50% + dx)` を vitest で固定。名前OFF出力は 002 のゴールデンと一致を維持  <!-- #22 -->
