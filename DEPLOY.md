# デプロイ（Cloudflare Workers / Static Assets）

本ツールは**純粋な静的SPA**（Vite + React + TypeScript、サーバー機能なし・ランタイムの秘密情報なし・
画像は data URI としてクライアントで埋め込み）。そのため **Cloudflare Workers の Static Assets + Git 連携（Workers Builds）**
でデプロイするのが最もシンプルで、**リポジトリに秘密情報（トークン等）を一切置かずに済む**。

Worker スクリプト（`main`）は持たず、[`wrangler.jsonc`](wrangler.jsonc) で `dist/` をアセットとして配信するだけの構成。

## ビルド設定（Workers Builds）

| 項目 | 値 |
|---|---|
| Project name | `obs-tachie-generator` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Production branch | `main` |
| Node version | `22`（[`.node-version`](.node-version) で固定。CI と揃える。wrangler 4.x が Node >= 22 必須） |

出力ディレクトリの指定欄は無い（`wrangler.jsonc` の `assets.directory = ./dist` が正）。
環境変数・シークレットは**不要**（このアプリはビルド時にもランタイムにも秘密を使わない）。

## 手順（Git 連携・推奨）

1. Cloudflare ダッシュボード → **Workers & Pages** → **Create** → **Import a repository**
2. リポジトリ `max-enterme/obs-tachie-generator` を選択
3. 上の「ビルド設定」を入力して **Deploy**
4. 発行された `https://<project>.<subdomain>.workers.dev` で動作確認
5. （任意）**Custom domains** で独自ドメインを割り当て

以降は `main` に push するたびに自動でビルド・デプロイされる。**トークン等はリポジトリに入らない**
（Cloudflare 側がサーバーで GitHub を参照してビルドするため）。

## ローカルからの手動デプロイ

Git 連携とは別に、手元から直接デプロイもできる（初回のみ `npx wrangler login`）。

```
npm run deploy    # npm run build && wrangler deploy
```

## フォークして自分でデプロイする場合

- 自分の Cloudflare アカウントで上記手順を実施する（メンテナのデプロイ先には影響しない）。
- `wrangler.jsonc` の `name` を自分のプロジェクト名に変えるとよい。追加のシークレットは不要。

## （代替）GitHub Actions からデプロイする場合

Workers Builds ではなく CI からデプロイしたいときは [`cloudflare/wrangler-action`](https://github.com/cloudflare/wrangler-action)
等を使い、次を **GitHub の Actions Secrets**（Settings → Secrets and variables → Actions）に設定する。
**値はリポジトリに置かず、名前参照だけを YAML に書く。**

| Secret 名 | 用途 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Workers 編集権限のみに絞った最小トークン |
| `CLOUDFLARE_ACCOUNT_ID` | 対象アカウント ID |

ワークフロー内では `${{ secrets.CLOUDFLARE_API_TOKEN }}` のように参照する。トークンは最小権限で発行し、
使い回さないこと。
