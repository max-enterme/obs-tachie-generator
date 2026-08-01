---
feature: css-generator-core
status: 未着手
test: npm run typecheck && npm run lint && npx vitest run
---

# 実装計画 — Streamkit 互換 立ち絵CSSジェネレーター(コア)

> plan.md — 「どう作るか」。spec.md の受け入れ条件を満たす設計。

## アプローチ
- 中核を **純粋関数 `generateCss(users, options): string`** に置き、UI は薄いラッパにする。
  → CSS 生成ロジックを vitest で単体テストでき、Streamkit フォーマットの正しさを固定できる。
- 画像は `FileReader` で **base64 data URI** 化(任意で最大幅リサイズして CSS 肥大を抑制)。
- 生成テンプレは NAS `season_6/悪手率_蛇王/asset/streamkit_css/` の実証済みCSS(描画1本化・
  `:has()` 発話検知)を正とする。参考知見: max/knowledge [[ytama-streamkit-overlay-csp]]。
- 状態は URL / localStorage に保存(リロードで復元)。サーバーは持たない。

## 主要コンポーネント / 変更点
| 層 | 変更 |
|---|---|
| `src/lib/generateCss.ts` | users+options → Streamkit互換CSS(data URI埋め込み / 常時表示 body::after / 発話 `:has()` / 位置・サイズ)。**テスト対象** |
| `src/lib/image.ts` | `File → dataURI`(任意リサイズ・PNG/JPEG) |
| `src/lib/imageSource.ts` | 画像URLの解決(Streamkit CSP 許可ホスト判定 / URL→dataURI / 自動・URL・dataURI モード)。**判定は純粋関数でテスト** |
| `src/ui/TachiePreview.tsx` | 透過市松の OBS ビューポート風プレビュー(位置・サイズ・発話演出の確認) |
| `src/lib/types.ts` | `AppUser{id,name}` / `Preset{画像+位置/サイズ+演出}` / `Pairing{userId,presetId}` を分離。`renderUser`/`presetToOptions` で generateCss へ合成 |
| `src/lib/state.ts` | `{users,presets,pairings}` の localStorage 永続化(純粋 `normalizeState`：旧形破棄・壊れpairing除去) |
| `src/ui/*` | AppUserForm / AppUserList / PresetPanel(画像+演出) / PairingPanel(ペア作成・ID差し替え) / OutputPanel(ペアごと個別 DL/コピー) |
| ルート | Vite + React + TS 雛形、`typecheck`/`lint`/`vitest` スクリプト、CI |
| デプロイ | Cloudflare Pages(ビルド `npm run build` → `dist/`) |

## 依存 / 前提
- 外部依存なし(クライアント完結)。バックエンド・API 不要。
- 参考実装(挙動の正): NAS の streamkit_css 一式、[[ytama-streamkit-overlay-csp]]。

## リスク / 降りる箇所
- **Streamkit の DOM / CSP / クラス名変更** — セレクタは前方一致で緩和するが、変わったら再検証が要る。
- **`:has()` 依存** — 古い OBS(CEF)で常時表示・発話検知が効かない。フォールバックや注意書きの
  要否は実装時に判断(**降りる箇所**: 黙って進めず方針を確認)。
- **UI 挙動・レイアウト** — SPEC-OPS §10。実装前に `/idea-board` でモック確定してから T4 に入る(降りる箇所)。
- **著作権** — alfe氏のコード/アセットを参照実装しない(降りる箇所: 迷ったら止める)。
