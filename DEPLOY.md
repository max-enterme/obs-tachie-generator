# デプロイ（Cloudflare Pages）

本ツールは**純粋な静的SPA**（Vite + React + TypeScript、サーバー機能なし・ランタイムの秘密情報なし・
画像は data URI としてクライアントで埋め込み）。そのため **Cloudflare Pages の Git 連携**でデプロイするのが
最もシンプルで、**リポジトリに秘密情報（トークン等）を一切置かずに済む**。

## ビルド設定

| 項目 | 値 |
|---|---|
| Framework preset | Vite |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Production branch | `main` |
| Node version | `20`（[`.node-version`](.node-version) で固定。CI と揃える） |

環境変数・シークレットは**不要**（このアプリはビルド時にもランタイムにも秘密を使わない）。

## 手順（方式A: Git 連携・推奨）

1. Cloudflare ダッシュボード → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. リポジトリ `max-enterme/obs-tachie-generator` を選択
3. 上の「ビルド設定」を入力して **Save and Deploy**
4. 発行された `https://<project>.pages.dev` で動作確認
5. （任意）**Custom domains** で独自ドメインを割り当て

以降は `main` に push するたびに自動でビルド・デプロイされる。**トークン等はリポジトリに入らない**
（Cloudflare 側がサーバーで GitHub を参照してビルドするため）。

## フォークして自分でデプロイする場合

- 自分の Cloudflare アカウントで上記手順を実施する（メンテナのデプロイ先には影響しない）。
- 追加の設定・シークレットは不要。そのまま `npm run build` で動く。

## （代替）GitHub Actions から CLI デプロイする場合（方式B）

Git 連携ではなく CI からデプロイしたいときは [`cloudflare/wrangler-action`](https://github.com/cloudflare/wrangler-action)
等を使い、次を **GitHub の Actions Secrets**（Settings → Secrets and variables → Actions）に設定する。
**値はリポジトリに置かず、名前参照だけを YAML に書く。**

| Secret 名 | 用途 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Pages 編集権限のみに絞った最小トークン |
| `CLOUDFLARE_ACCOUNT_ID` | 対象アカウント ID |

ワークフロー内では `${{ secrets.CLOUDFLARE_API_TOKEN }}` のように参照する。トークンは最小権限で発行し、
使い回さないこと。
