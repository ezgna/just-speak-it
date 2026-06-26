# Make cards 前にカード下書きを編集できるようにする

## やること

`Make cards` を押して英訳カードを作る前に、分割済みの日本語カード下書きを編集できるようにする。

AI が分けたカードをそのまま確定するだけでなく、ユーザーが「ここは直したい」「これは分けたい」「これは消したい」と思ったときに、英訳生成前に整えられる状態にする。

## 背景

現在の今日タブでは、`Split it` 後に `GeneratedPracticePreview` で日本語カード下書きを表示し、`Make cards` で `completePracticeDraft` に渡して英訳している。

この段階ではカード下書きが表示専用なので、分割ミスや言い換えたい部分があっても、ユーザーは「やり直す」しか選べない。

## 受け入れ条件

- `Make cards` 前の日本語カード下書きを編集できる。
- 各カードの日本語本文を直接直せる。
- 不要なカードを削除できる。
- 必要ならカードを追加できる。
- できればカードの順番も調整できる。
- 空のカードや空白だけのカードは `Make cards` に送らない、または送信前にわかりやすく止める。
- 編集後の内容が `completePracticeDraft` に渡され、英訳結果へ反映される。
- 音声入力由来の timestamp があるカードを編集した場合、timestamp を残すか消すかの扱いが破綻しない。
- 編集中に誤って録音・再分割・画面遷移で内容が消えない。
- 既存の「やり直す」操作は残す。

## 実装メモ

- 既存候補:
  - `src/app/(tabs)/index.tsx`
  - `src/components/generated-practice-preview.tsx`
  - `src/lib/backend/practice.ts`
  - `supabase/functions/complete-practice/index.ts`
- 現在は `draftCards.map((card) => ({ id: card.id, japanese: card.japanese }))` を `completePracticeDraft` に渡している。
- `complete-practice` 側には、入力日本語が保存済みカードと変わった場合に timestamp を clear する処理がすでにある。
- まずは `GeneratedPracticePreview` を「表示専用」と「編集可能」の両方に対応させるか、編集用コンポーネントを別に作るのがよさそう。
- 追加カードを許可する場合、既存 `practiceGenerationId` に紐づく新規カードをどこで作るかを決める必要がある。
- 削除・追加・並び替えまで backend に保存するなら、`completePracticeDraft` の入力仕様と Supabase function 側の upsert/delete 処理を見直す必要がある。
- 最小実装なら、まずは「既存カード本文の編集」と「空カード除外」から始める。

## 未決

- 最初の実装範囲を本文編集だけにするか、削除・追加・並び替えまで含めるか。
- 編集内容を `Make cards` 押下までローカル state にだけ持つか、その場で下書きとして DB に保存するか。
- 音声 timestamp 付きカードを編集したとき、timestamp 再生ボタンを非表示にするか、元の範囲として残すか。
- 追加カードの id と sortOrder を frontend で仮生成するか、backend で生成するか。
