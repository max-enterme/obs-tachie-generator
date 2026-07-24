---
feature: css-generator-core
---

# タスク — Streamkit 互換 立ち絵CSSジェネレーター(コア)

> tasks.md — 実作業の分解。各タスクは GitHub sub-issue(type: Task)と対応。
> `- [ ]` 未完 / `- [x]` 完了。sub-issue 採番後に `<!-- #NN -->` を付す。

- [x] T1: Vite + React + TS プロジェクト初期化(`typecheck` / `lint` / `vitest` スクリプト整備・CI 雛形)  <!-- #2 -->
- [x] T2: `generateCss` コア実装 — users+options → Streamkit互換CSS(data URI埋め込み・常時表示 `body::after`・発話 `:has()`・位置/サイズ)+ vitest  <!-- #3 -->
- [x] T3: 画像取り込み `image.ts`(File → data URI・任意リサイズ)  <!-- #4 -->
- [x] T4: UI 実装(ユーザー登録 / オプション / 出力パネル: コピー・per-person DL・まとめDL)  <!-- #5 -->
- [ ] T5: UI 挙動・レイアウトのモック確定(`/idea-board`)→ 実装反映 ※人手・確認(§08/§10)  <!-- #6 -->
- [ ] T6: Cloudflare Pages デプロイ設定 + 公開 ※実機確認(§08)  <!-- #7 -->
- [x] T7: README(使い方・alfe氏 inspired-by クレジット・`:has()`/OBS注意)  <!-- #8 -->
