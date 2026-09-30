# デプロイ（GitHub Pages）

`main` への push で [`.github/workflows/pages.yml`](.github/workflows/pages.yml) が走り、`dist/` を GitHub Pages に公開する。
公開先: `https://max-enterme.github.io/obs-tachie-generator/`

本ツールは**純粋な静的SPA**（Vite + React + TypeScript、サーバー機能なし・ランタイムの秘密情報なし・
画像は data URI としてクライアントで埋め込み）。トークン等は一切要らない。

- 配信が `/obs-tachie-generator/` 配下になるため、ワークフローは `VITE_BASE=/<リポジトリ名>/` を付けてビルドする
  （[`vite.config.ts`](vite.config.ts) の `base`）。付けないビルド（ローカル開発）は `/` のまま。
- リポジトリ設定: **Settings → Pages → Source = GitHub Actions**（初回のみ）。
- Node は [`.node-version`](.node-version)（22）で固定。
- lint / test の CI は Jenkins が正本。ワークフローは配信専用。

## 手元での確認

```
VITE_BASE=/obs-tachie-generator/ npm run build && npm run preview
```

## フォークして自分で公開する場合

自分のリポジトリで **Settings → Pages → Source = GitHub Actions** を選び、`main` に push する。
`VITE_BASE` はワークフローがリポジトリ名から自動で決めるので、リポジトリ名を変えても設定変更は要らない。

## 履歴

2026-09-30 まで Cloudflare Workers（`obs-tachie-generator.max-enterme.workers.dev`）でも公開していた。
GitHub Pages へ一本化して廃止した。
