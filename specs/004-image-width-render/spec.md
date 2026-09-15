---
feature: image-width-render
issue: 32
release: r3
priority: must
status: 進行中
---

# 立ち絵の幅指定を出力CSSでも効かせる

> spec.md — フィーチャーの「何を・なぜ」。正本はこのテキストと GitHub(Feature issue)。
> 出所: rail #621(2026-08-30 に OBS 実機 CEF=Chrome 127 と Chrome 148 の両方で再現)。

## 目的
出力CSSの立ち絵を**指定した幅どおりに縮めて描く**。あわせて、下端アンカーで**指定した距離ちょうどに付く**ようにする
(いまは 7px 浮く)。プレビューと出力の見た目を一致させる。

## 背景 / 課題
- `generateStandaloneCss` は立ち絵を `body::after { content: var(--img-stand-url-<id>) }`(値は `url(...)`)で描き、
  幅指定時は `width: <N>px;` を足すだけ。**`content` の画像は置換要素として原寸のまま描かれ、箱だけが縮む。**
  実測: 600×900 の画像 + `width: 300px` → 箱 300×907、描かれる絵は 600×900。右下アンカーだと右へ 300px はみ出す。
- 同じ構造で、画像がインラインの置換要素として置かれるため**ベースライン下の余白 7px が箱に入る**。
  `bottom: 16px` 指定で絵の下端は実測 23px(1920×1080 のブラウザソース)。
- プレビュー(`src/ui/TachiePreview.tsx`)は実 `<img>` に幅%を当てているので縮む → **プレビューと出力が食い違う**。
- `src/lib/generateCss.test.ts` は出力CSSの文字列しか見ていないので、このバグを素通りした。

## スコープ
- **含む**:
  - 立ち絵の描画を `content: ""` + `background-image` + `background-size: contain` + 明示の `width` / `height`(px)へ変える。
    **幅指定あり・幅未指定(原寸)の両方**をこの方式にそろえる(2026-09-16 MAX 承認)。
  - `height` を出すために、画像の実寸の**縦**もアプリ側で測って出力へ渡す(いまは横だけ)。
  - 実寸が測れていない間(読み込み中・読めない URL)は、**現行の `content` 方式の出力に戻す**(表示だけは保つ)。
  - 出力CSSを実ブラウザで描いて、絵の外形(描かれた画素の外接矩形)を測るテストを足す。
- **含まない**:
  - 画面(UI)の見た目・入力欄の変更。
  - 名前ラベル(`body::before`)の出し方、クロップ、発話演出(keyframes)、アンカー配置の計算の変更。
  - 温存コード `generateCombinedCss` の変更(UI から呼ばれていない)。
  - Jenkins パイプライン(別リポジトリ `jenkins-pipelines`)へのブラウザテストの追加。

## 受け入れ条件
- [ ] 600×900 の画像 + 幅 300 の出力CSSを 1920×1080 のブラウザで描くと、絵の外形が 300×450 になる。
- [ ] 同じ条件で右下アンカー・距離 0 にすると、絵の右端が 1920・下端が 1080 に付く(画面外へはみ出さない)。
- [ ] 下端アンカー・距離 16 で、絵の下端が画面下から 16px ちょうど(7px 浮かない)。幅指定あり・原寸の両方で成り立つ。
- [ ] 出力の描画サイズが、プレビューと同じ規則(幅指定 > 画像の実寸)で決まる。
- [ ] 画像の実寸が渡されないときの出力は、変更前と 1 バイトも変わらない。
- [ ] 実寸から大きさを焼き込んだ出力には「画像を差し替えたらCSSを出し直すこと」の注記コメントが付く(URL のまま縦横比の違う画像に差し替えると崩れるため)。
- [ ] 中央アンカーの `transform` 行が、方式変更の前後で同じ(`composeTransform` の不変条件を壊さない)。
- [ ] 上の外形の条件を見るブラウザテストが追加され、plan.md の `test` が緑。
- [ ] OBS 実機(ブラウザソース)で、確認キットの `a1` が「下 16px」、`a1-width300` が 300×450 に収まる。

## メモ / 降りる箇所
- **OBS 実機での確認は人が行う**(tasks.md の T4)。キットはダッシュボード published 配下の `obs-tachie-generator/verify/`(置き場はナレッジ `projects/obs-tachie-generator.md` の「OBS 実機確認を機械化する」節)
  (`node gen-css.mjs <ブランチ>` → `node run-a-checks.mjs`)。キットの `gen-css.ts` は実寸を渡していないので、回す前に足す(plan.md「リスク / 降りる箇所」)。
  rail #621 の detail にあるパスは `...generatorerify` と崩れているが、実体はこちら。
- 方式の比較(a〜d の 4 通り)は ダッシュボード Pages の `obs-tachie-generator/assets-003/width-fix-compare.html`(rail #621 の detail にリンクあり)。
  `transform: scale()` 案(d)は `composeTransform` と衝突するので採らない(plan.md「採らない案」)。
