# 英訳スタイルを設定で切り替える

## やること

英訳カード生成の設定ボタンで、日本語カードの分け方と英訳スタイルを別々に選べるようにする。

- カードの分け方:
  - 自然なまとまり: 英語にしたときの意味の流れを保つ。
  - 細かく分ける: 短いカードとして覚えやすい単位にする。
- 英訳スタイル:
  - 自然さ優先: ネイティブが日常会話で自然に言う表現を最優先する。
  - 簡単さ優先: 覚えやすく、短く、やさしい単語と構文を優先する。

## 背景

以前は `natural` / `compact` の生成モードが、日本語カードの分割方針と英訳時の文体方針を混ぜて扱っていた。これを `cardSplitPolicy` と `translationStyle` に分け、ユーザーにとってわかりやすい2つの設定として整理したい。

## 受け入れ条件

- 設定画面で現在のカードの分け方と英訳スタイルが見える。
- 設定画面で「自然なまとまり」と「細かく分ける」を切り替えられる。
- 設定画面で「自然さ優先」と「簡単さ優先」を切り替えられる。
- 選択した2つの設定はアプリ再起動後も保持される。
- 新しく作る日本語カード下書きには、選択したカードの分け方が反映される。
- 新しく作る英訳カードには、選択した英訳スタイルが反映される。
- 「自然さ優先」は、多少長くなっても自然な口語英語を優先する。
- 「簡単さ優先」は、自然さを壊さない範囲で短く、覚えやすく、簡単な表現を優先する。
- 既存カードの英訳は、設定変更だけでは勝手に書き換えない。

## 実装メモ

- 既存候補:
  - `src/components/card-split-policy-selector.tsx`
  - `src/components/translation-style-selector.tsx`
  - `src/hooks/use-card-split-policy.tsx`
  - `src/hooks/use-translation-style.tsx`
  - `src/lib/card-split-policy.ts`
  - `src/lib/translation-style.ts`
  - `supabase/functions/prepare-practice-draft/index.ts`
  - `supabase/functions/complete-practice/index.ts`
  - `supabase/migrations/20260531000000_init_word_timestamp_schema.sql`
- DB には `practice_generations.card_split_policy` と `practice_generations.translation_style` を保存する。
- `prepare-practice-draft` は `cardSplitPolicy` だけを使う。
- `complete-practice` は `translationStyle` だけを使う。

## 未決

- 設定画面の表示順を今後も「カードの分け方」「英訳スタイル」の順にするか。
- 復習画面で作成時の英訳スタイルを表示するか。
