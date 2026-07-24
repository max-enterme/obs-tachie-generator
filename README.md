# obs-tachie-generator

OBS で Discord の通話相手を「立ち絵」で表示するための **Discord Streamkit 用カスタムCSS** を、
ブラウザ上で生成する静的Webツール。

## 特徴（既存ツールとの差分）

- **画像を data URI で埋め込み** — 外部ホスト不要・Streamkit の CSP 回避・URL 失効なし。
- **画像URLの賢い扱い** — Streamkit の CSP が許可するホスト（Discord系 / imgur 等）は **URL のまま**、
  それ以外は **data URI 化**を自動選択。「URL のまま／data URI に変換」の**手動上書き**も可能。
- **通話に居ない時も常時表示** — `body::after` + CSS `:has()` で発話も検知して演出。
- **プレビュー画面** — 透過（市松）背景の OBS ビューポート風プレビューで、位置・サイズ・発話演出を貼る前に確認。
- per-person 個別出力 + まとめ版、コピー & ダウンロード。

## 使い方（生成ツール）

1. **Discord ユーザーID** を入れる（数字のみ。Discord で開発者モード → ユーザー右クリック → 「IDをコピー」）。
2. **立ち絵画像**をアップロード（data URI として埋め込まれます）するか、画像URLを貼る。
3. **表示オプション**で常時表示・位置(left/bottom)・幅(width)・発話演出（跳ね/白フチ）を調整。
4. 出力された CSS を **コピー** or **ダウンロード**。

## OBS / Streamkit への貼り方

1. Discord の [Streamkit Overlay](https://streamkit.discord.com/overlay) で **Voice Widget** の URL を作る。
2. OBS に **ブラウザソース**を追加し、その URL を設定。
3. ブラウザソースの **カスタムCSS** 欄に、生成した CSS を貼り付ける（既存を消してから）。

### 個別 と まとめ版

- **個別（推奨）**: 1人 = 1 ブラウザソース。`body::after` 1要素だけで描画するので、
  通話に居ても居なくても同じ位置に出て、位置ズレが原理的に起きません（**常時表示**が使えます）。
- **まとめ版**: 1つのブラウザソースに複数人。Streamkit の実アイコン(`<img>`)を人ごとに差し替える方式で、
  **通話中のユーザーだけ**表示されます（`body::after` は1要素しか無いため、複数人の常時表示はできません）。

## 仕組み（出力CSSの前提）

Streamkit の実DOMに合わせています:

- アバターは `<img>` 自身。発話中はその img に `Voice_avatarSpeaking__`（ハッシュ付き）クラスが付く。
  → セレクタは `[class*="Voice_..."]` の**前方一致**を使い、Streamkit のクラス名更新に耐えるようにしています。
- 画像URLは `avatars/<ユーザーID>` を含むので、`img[src*="avatars/<id>"]` で人を特定します。
- 立ち絵は `:root` のカスタムプロパティに **data URI** で埋め込みます。

## ⚠️ `:has()` / OBS の注意

常時表示（`body::after`）と発話検知は CSS の **`:has()`** に依存します。

- `:has()` に対応した比較的新しい OBS（内蔵ブラウザ CEF が `:has()` 対応）が必要です。
- 古い OBS では **常時表示・発話演出が効きません**。その場合は OBS を更新してください
  （本ツールは意図的に JS フォールバックを持たず、実証済みの `:has()` 実装に一本化しています）。

## 開発

```bash
npm install
npm run dev        # 開発サーバー
npm run typecheck  # 型チェック（tsc --noEmit）
npm run lint       # ESLint
npm test           # vitest（1回実行）
npm run build      # 型チェック + 本番ビルド（dist/）
```

コアは純粋関数 `generateCss(users, options)`（[`src/lib/generateCss.ts`](src/lib/generateCss.ts)）に集約し、
Streamkit 互換フォーマットの正しさを vitest で固定しています。ホスティングは Cloudflare Pages を想定。

## クレジット

alfe氏（@alfe_below）の「OBSのDiscord通話相手立ち絵表示ジェネレーター」に **着想を得た独自実装**です。
alfe氏のコード・アセットは使用していません（inspired-by）。

## 状態

仕様・計画・タスクは [`specs/`](specs/) 参照（SPEC-OPS 運用規約に準拠）。
