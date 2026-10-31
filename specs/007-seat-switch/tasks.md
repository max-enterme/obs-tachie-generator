---
feature: seat-switch
---

# タスク — 席の主が入れ替わる(1 つのブラウザソースに候補を並べ、通話にいる人の立ち絵を出す)

> tasks.md — 実作業の分解。各タスクは GitHub sub-issue(type: Task)と対応。
> `- [ ]` 未完 / `- [x]` 完了。採番後に `<!-- #12 -->` の形で sub-issue 番号を書く。
> **未採番のうちはコメントごと書かない**(空のプレースホルダは採番済みと誤読される。SPEC-OPS §04)。

- [x] T1: 席の保存データ(Seat 型と席の位置・AppState.seats・makeDefaultSeat・seatPreset・normalizeSeat と古いデータの読み込み)と単体テスト  <!-- #77 -->
- [x] T2: 席の出力CSS(seatActiveSelector・generateSeatCss・常時表示の宣言の切り出しと keyframe 名の接尾辞)と単体テスト(T1 の後)  <!-- #78 -->
- [x] T3: ④ 席の画面(SeatPanel の一覧・名前・位置・候補・追加欄、SeatOutputPanel、席の位置で映すプレビュー、useImageNaturalSizes、App の席の操作とユーザー/プリセット削除の連動)と画面テスト(T1・T2 の後)  <!-- #79 -->
- [ ] T4: 実ブラウザ(Playwright)で在室の組み合わせごとに出る人・位置・発話演出を検証する(T2 の後)  <!-- #80 -->
- [x] T5: README と使い方ガイド(public/guide.html)に席の説明を足す(T3 と同じ PR)  <!-- #81 -->
- [ ] T6: **人手**: OBS 実機のブラウザソースに候補 2〜3 人の席の CSS を貼り(本人のアカウントともう 1 つのアカウントで通話に出入りする)、出る人が入れ替わるか・2 人在室で上の候補だけ出るか・CSS が末尾まで保存されるかを見る(T2 と T3 の後)  <!-- #82 -->
