---
feature: custom-name-display
test: npm run typecheck && npm run lint && npx vitest run
---

# 実装計画 — 立ち絵に任意の名前を表示する

> plan.md — 「どう作るか」。spec.md の受け入れ条件を満たす設計。

## アプローチ
- **テキストは「誰」、見た目は「プリセット」** の分離(001 の設計)をそのまま踏襲する。
  - `AppUser.displayName?`(画面に出す名前) — 空なら `AppUser.name`(メモ)にフォールバック。
  - `Preset.nameLabel: NameLabel`(表示ON/OFF・位置・文字・縁取り) — 複数人で使い回せる。
- 出力は `generateStandaloneCss` に **`body::before` ブロック**を1つ足すだけにする。
  `content: "<名前>"` / `position: fixed` / 立ち絵の `left`,`bottom` + オフセットで配置。
- **位置は生成時に加算して数値で出す**(`left + offsetX`)。CSS 側で `calc()` を使わないほうが、
  貼り付け後に人が読んで直せる。
- **安全化は既存の作法に合わせる**: 色は `safeColor`(既存)、`content` は新規 `cssString`、
  フォント名は `safeFontFamily`(ホワイトリスト＋**ジェネリック以外は引用**)、CSS コメントに載る
  メモ名は `cssComment`(`*/` を割る)。CSS 注入は生成側で潰す。
  - フォント名を引用するのは、無引用の識別子が**数字始まりにできない**ため
    (`07やさしさゴシック` などが宣言ごと捨てられて黙って効かなくなる)。

## 主要コンポーネント / 変更点
| 層 | 変更 |
|---|---|
| `src/lib/types.ts` | `NameLabel` / `DEFAULT_NAME_LABEL` 追加。`AppUser.displayName?` / `Preset.nameLabel` / `GenerateOptions.nameLabel` / `TachieUser.displayName?`。`renderUser` / `presetToOptions` / `makeDefaultPreset` / `resetPresetOptions` を追随 |
| `src/lib/generateCss.ts` | `nameBlock`(本体)＋ `cssString` / `flattenText` / `cssComment` / `safeFontFamily` / `textOutline` / `cssColorWithOpacity` を追加。`generateStandaloneCss` に `body::before` ブロックと、`hideWhenAway` 時の在室ルールへの `::before` 追加。**テスト対象** |
| `src/lib/state.ts` | `normalizeNameLabel` で既定補完(旧データは表示OFF)。`displayName` の検証・保持 |
| `src/ui/AppUserForm.tsx` | 「画面に出す名前(任意)」入力を追加 |
| `src/ui/AppUserList.tsx` | 登録済みユーザーの「画面に出す名前」をその場で編集(`onChange`) |
| `src/ui/PresetPanel.tsx` | 「名前表示」セクション(ON/OFF・位置・サイズ・フォント・色・太字・行揃え・縁取り・背景)＋**無効な入力の理由表示** |
| `src/ui/TachiePreview.tsx` | 名前を `nameText` prop で受けて描画。位置%・文字サイズ・帯の余白は `cqw` で 1920 基準に比例。箱幅は `width ?? 実測`、安全化(`safeColor` / `safeFontFamily` / `flattenText`)も出力と共有。`sampleWhenEmpty` で②だけ仮名を出す |
| `src/lib/image.ts` / `src/ui/useImageNaturalWidth.ts` | 画像の実サイズ(幅)を測る(`measureNaturalWidth`＋フック。タイムアウトあり)。幅が原寸のときの行揃え基準に使う |
| `src/App.tsx` / `src/ui/OutputPanel.tsx` | 実測幅の配線(`imageNaturalWidth`)。箱幅が決まらないまま行揃え/帯を使っているときは**出力パネルで警告** |
| `src/index.css` | `.tp-viewport` に `container-type: inline-size`、`.tp-name` 追加。**アプリ全体に効く変更**として `--control-h`(入力コントロールの高さ統一)、`input:disabled` / `.field:has(> :disabled)` の無効表示、`.row .field` の入力欄基準の整列、`.tp-img` / `.tp-placeholder` の絶対配置化(padding 基準だと % がズレるため) |
| `README.md` | 名前表示の説明を追記 |

## 出力CSSの形(確定)
```css
/* 名前（任意テキスト。Streamkit の名前は隠し、これだけを出す） */
body::before {
  content: "画面名A";
  position: fixed;
  left: 16px;      /* 立ち絵の left + offsetX（帯を文字幅にするときはアンカー位置） */
  bottom: 8px;     /* 立ち絵の bottom + offsetY */
  z-index: 1;      /* ::after（立ち絵）より前面 */
  display: block;  /* hideWhenAway なら none（在室時に block へ） */
  width: 480px;         /* 箱幅が決まるとき（width 指定 or 画像の実サイズ）だけ */
  text-align: center;   /* 同上（幅が無いと揃えようがない） */
  transform: translateX(-50%);  /* 帯を文字幅にするときの位置合わせ（center/right のみ） */
  background: rgba(0, 0, 0, 0.6);      /* 背景ONのとき */
  padding: 6px 12px;                   /* 同上（余白が 0 より大きいとき） */
  border-radius: 6px;                  /* 同上（角丸が 0 より大きいとき） */
  box-sizing: border-box;              /* 幅指定＋余白のとき（はみ出し防止） */
  font-family: "Noto Sans JP", sans-serif;  /* ジェネリック以外は引用する */
  font-size: 32px;
  font-weight: 700;
  color: #FFFFFF;
  text-shadow: 3px 0 0 #000000, …（8方向。縁取りONかつ幅>0のとき）;
  line-height: 1.2;
  white-space: pre;
  pointer-events: none;
}
```
- **帯の幅モード**: `text`(既定・文字幅に縮む＝`width`/`text-align` を出さず `transform` でアンカー) /
  `stretch`(立ち絵の幅いっぱい＝`width` + `text-align`)。箱幅が決まらないときは
  どちらも文字幅になる(その状態は UI と出力パネルで警告する)。

## 依存 / 前提
- 追加の外部依存なし。生成ロジックは純粋関数のままで vitest から固定する。
- プレビューの文字サイズ比例に **CSS コンテナクエリ単位 `cqw`** を使う(開発ツール側だけで使用し、
  出力CSS には出さない。OBS 側の互換性には影響しない)。

## リスク / 降りる箇所
- **擬似要素の在庫切れ** — `::before`/`::after` を使い切る。同一ソースに要素を足す方向へは進めない
  (**降りる箇所**: spec.md「メモ / 降りる箇所」と同じ)。
- **フォント可用性** — OBS(CEF)に無いフォント名は無視される。Web フォント読み込みはしない。
- **既存出力の非退行** — 名前 OFF のときの出力は 001 と同一であること。
  `generateCss.test.ts` の「名前OFF の出力（001 からの非退行）」で**期待文字列と完全一致**を固定する。
- **実測幅は焼き込み** — 幅が原寸のときの箱幅は非同期の実測に依存する。測れない/測定中は
  行揃えと `stretch` の帯が出力から落ちるため、出力パネルで警告する(黙って劣化させない)。
