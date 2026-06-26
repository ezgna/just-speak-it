# 英訳スタイルを設定で切り替える

## やること

英訳カード生成の設定ボタンで、英訳のスタイルを次の2つから選べるようにする。

- 一番ネイティブに: ネイティブが日常会話で自然に言う表現を最優先する。
- 一番簡単に: 覚えやすく、短く、やさしい単語と構文を優先する。

## 背景

現在は `natural` / `compact` の生成モードがあり、設定画面の `GenerationModeSelector` から選択して Supabase functions のプロンプトへ渡している。これをユーザーにとってわかりやすい「英訳スタイル」設定として整理したい。

## 受け入れ条件

- 設定画面で現在の英訳スタイルが見える。
- 設定画面で「一番ネイティブに」と「一番簡単に」を切り替えられる。
- 選択した設定はアプリ再起動後も保持される。
- 新しく作る英訳カードには、選択した英訳スタイルが反映される。
- 「一番ネイティブに」は、多少長くなっても自然な口語英語を優先する。
- 「一番簡単に」は、自然さを壊さない範囲で短く、覚えやすく、簡単な表現を優先する。
- 既存カードの英訳は、設定変更だけでは勝手に書き換えない。

## 実装メモ

- 既存候補:
  - `src/components/generation-mode-selector.tsx`
  - `src/hooks/use-generation-mode.tsx`
  - `src/lib/generation-mode.ts`
  - `supabase/functions/prepare-practice-draft/index.ts`
  - `supabase/functions/complete-practice/index.ts`
  - `supabase/migrations/20260531000000_init_word_timestamp_schema.sql`
- DB には `practice_generations.generation_mode` があり、現状は `natural` / `compact` を保存している。
- 既存の値をそのまま使うなら、UI 表示とプロンプト文言を「英訳スタイル」向けに変えるだけで済む可能性が高い。
- 値名まで変えるなら、破壊的マイグレーションで `native` / `simple` などに作り直す方針でもよい。

## 未決

- デフォルトを「一番ネイティブに」にするか、「一番簡単に」にするか。
- 既存の `natural` / `compact` という内部名を残すか、英訳スタイルに合わせてリネームするか。
