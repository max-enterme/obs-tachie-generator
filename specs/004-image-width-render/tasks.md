---
feature: image-width-render
---

# タスク — 立ち絵の幅指定を出力CSSでも効かせる

> tasks.md — 実作業の分解。各タスクは GitHub sub-issue(type: Task)と対応。

- [x] T1: 出力CSSの立ち絵を背景画像方式にする(tachieBoxSize・generateStandaloneCss・GenerateOptions.imageNaturalHeight・presetToOptions)と単体テスト  <!-- #33 -->
- [x] T2: 画像の実寸を横・縦で測って出力へ渡す(measureNaturalSize・useImageNaturalSize・App・OutputPanel)(T1 の後)  <!-- #34 -->
- [x] T3: 実ブラウザで出力CSSを描いて絵の外形を測るテストを足す(Playwright 導入・e2e/render.spec.ts)(T1 の後)  <!-- #35 -->
- [x] T4: **人手**: OBS 実機で verify キットを回し、a1 が下 16px・a1-width300 が 300×450 か見る(キットの gen-css.ts に実寸を足す下準備はエージェント。T1 の後)  <!-- #36 -->
