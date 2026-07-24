# obs-tachie-generator

OBS で Discord の通話相手を「立ち絵」で表示するための **Discord Streamkit 用カスタムCSS** を、
ブラウザ上で生成する静的Webツール。

## 特徴(既存ツールとの差分)
- **画像を data URI で埋め込み** — 外部ホスト不要・Streamkit の CSP 回避・URL 失効なし。
- **通話に居ない時も常時表示** — `body::after` + CSS `:has()` で発話も検知して演出。
- per-person 個別出力 + まとめ版、コピー & ダウンロード。

## 技術
Vite + React + TypeScript の静的SPA(サーバー無し・クライアント完結)。ホスティング: Cloudflare Pages。

## 状態
立ち上げ直後。仕様・計画・タスクは [`specs/`](specs/) 参照(SPEC-OPS 準拠)。

## クレジット
alfe氏(@alfe_below)の「OBSのDiscord通話相手立ち絵表示ジェネレーター」に**着想を得た独自実装**です。
alfe氏のコード・アセットは使用していません。
