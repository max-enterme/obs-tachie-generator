---
feature: custom-name-display
---

# タスク — 立ち絵に任意の名前を表示する

> tasks.md — 実作業の分解。`- [ ]` 未完 / `- [x]` 完了。
> **この feature では sub-issue を切らない**（Feature issue #20 のみ）。実装を手で進めて完了済みのため、
> 事後に sub-issue を起こしても実態を写すだけになる。よってタスクの正本はこのファイル。
> ※ `<!-- #NN -->` が無い＝未採番なので、`/spec-implement`（自動実装）の対象外（SPEC-OPS §07-3）。

- [x] T1: データモデル — `NameLabel` / `AppUser.displayName` / `Preset.nameLabel` と既定値・合成関数(`renderUser` / `presetToOptions`)
- [x] T2: `generateStandaloneCss` に `body::before` の名前ブロック(位置・文字・縁取り・`hideWhenAway` 追随)+ `cssString` / `safeFontFamily` の安全化 + vitest
- [x] T3: `state.ts` の正規化(旧データは表示OFFで補完・`displayName` 保持)+ vitest
- [x] T4: UI — ユーザー側「画面に出す名前」(追加フォーム / 一覧のその場編集)
- [x] T5: UI — プリセット側「名前表示」オプション一式
- [x] T6: プレビューに名前を反映(位置・サイズ・縁取りを出力と一致させる)
- [x] T7: README 追記(名前表示・1ソース＝立ち絵1枚+名前1つ の制約)
- [x] T9: 行揃えの基準幅 — 幅が原寸でも画像の実サイズ(`measureNaturalWidth` / `useImageNaturalWidth`)を測って焼き込む + 触れない入力の理由表示 + 行内の整列(`--control-h` / 入力欄基準)
- [x] T10: 名前の背景(テロップ帯) — 色/不透明度/余白/角丸 + 幅モード(文字に合わせる / 立ち絵の幅いっぱい。後者は `transform` アンカー) + vitest
- [x] T11: レビュー指摘の反映 — フォント名の引用(数字始まりが黙って無効化される問題)、メモ名の CSS コメント注入、プレビューの空名前ガード、実測幅が無いときの出力警告＋測定タイムアウト、`--control-h` を自然高以上に、幅0/文字サイズ0/縁取り0/丸めの扱い、名前OFF出力のゴールデンテスト、fixture の名前をサンプル値へ
- [x] T8: OBS 実機で貼って確認(名前の見え方・フォント可用性・`:has()` 挙動) ※実機確認(§08)

## 記録（作業タスクではない）

- **T12: GUI モックの併置（SPEC-OPS §10）は実施しなかった。** spec 段階でモックを置く代わりに、実装しながら
  ブラウザ実測（位置・幅・文字サイズ・帯）で挙動を確定し、確定値を spec.md / plan.md に反映した。
  次回の GUI feature では §10 どおり spec 作成時にモックを併置する。
  ※ 決定の記録であって作業ではないため、チェックリストから外した（`- [ ]` のままだと未完タスクに見えるため）。
