---
feature: lip-sync
---

# タスク — 口パク(話している間だけ口開きの絵と交互に切り替える)

> tasks.md — 実作業の分解。各タスクは GitHub sub-issue(type: Task)と対応。
> `- [ ]` 未完 / `- [x]` 完了。採番後に `<!-- #12 -->` の形で sub-issue 番号を書く。
> **未採番のうちはコメントごと書かない**(空のプレースホルダは採番済みと誤読される。SPEC-OPS §04)。

- [x] T1: 口パクの保存データと周期の解決(Preset / TachieUser / GenerateOptions のフィールド・resolveMouthIntervalMs・normalizePreset・mouthAspectNote)と単体テスト  <!-- #58 -->
- [x] T2: 出力CSSに口パクを出す(rootBlock の口開き絵の変数・speak-mouth の keyframe・発話中ルールの animation)と単体テスト(T1 の後)  <!-- #59 -->
- [x] T3: プリセット編集の口パク欄・プレビューの交互切替・出力パネルの注意と画面テスト(T1 の後)  <!-- #60 -->
- [x] T4: 実ブラウザ(Playwright)で発話中に立ち絵と口開き絵が周期どおり切り替わることを検証する(T2 の後)  <!-- #61 -->
- [x] T5: **人手**: OBS 実機のブラウザソースに出力CSSを貼り(立ち絵と同じ大きさの口閉じ・口開き 2 枚は手元の絵、無ければ単色 2 枚でよい)、話している間だけ口が交互に切り替わり、話し始めの 1 回目から口開きが欠けず出るか見る(T2 と T3 の後)  <!-- #62 -->
- [x] T6: 口パクの周期を「動きの速さ・周期」に合わせて自動で決める(Preset の mouthIntervalMs を mouthPerMove に置き換え・周期の欄を回数の選択に・プレビュー追従)と単体・画面テスト(plan.md「変更 C1」)  <!-- #71 -->
