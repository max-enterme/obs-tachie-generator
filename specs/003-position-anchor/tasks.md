---
feature: position-anchor
---

# タスク — 立ち絵の基準位置(アンカー)を9通りから選ぶ

> tasks.md — 実作業の分解。各タスクは GitHub sub-issue(type: Task)と対応。
> `- [ ]` 未完 / `- [x]` 完了。sub-issue 採番後に `<!-- #NN -->` を付す。

- [ ] T1: 型と既定値 — `GenerateOptions` / `Preset` に `anchorX`/`anchorY`(任意)を追加、`presetToOptions` で受け渡し、保存済みデータの欠損補完
- [ ] T2: `generateCss` の位置生成をアンカー対応に — 位置宣言の切り出し + `left`/`right`/`top`/`bottom`/`50%` の出し分け + vitest(9通り・左下は従来出力と一致)
- [ ] T3: `transform` 衝突の解消 — 中央寄せ translate を keyframes に前置する形へ。中央寄せ × ぴょこぴょこの vitest
- [ ] T4: UI — 3×3 のアンカー選択 + オフセットのラベル追従(PresetPanel)
- [ ] T5: プレビューのアンカー追従(TachiePreview)
