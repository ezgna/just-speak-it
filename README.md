# Just Speak It

日本語のひとことや日記を、話せる英語の練習カードに変換するモバイルアプリです。

## 機能

- テキスト入力または音声録音から日本語の練習素材を作成
- Supabase Edge Functions と OpenAI API で自然な英語カードを生成
- 生成前の下書きカードを確認してから保存
- 保存した英語カードを復習

## 技術スタック

- Expo
- React Native
- Supabase
- OpenAI API

## 開発

```bash
npm install
npm run start
```

環境変数は `.env.local` に設定します。

```bash
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Edge Functions 側には `OPENAI_API_KEY` を設定します。テキスト生成モデルを変える場合は
`OPENAI_TEXT_MODEL` も設定できます。

Supabase の DB 反映は hosted project に対して行います。DB パスワードは repo 外の secret file から環境変数として読み込んでください。

```bash
set -a
source path/to/supabase.env
set +a
supabase db push --yes
```

このプロジェクトは開発中のため、DB schema は破壊的 migration で作り直す運用です。DB を反映したら remote project から型を再生成します。

```bash
npm run db:types
```

Functions を反映するときは次を使います。

```bash
npm run functions:deploy
```

## DB/API 契約

- `diary_entries`: 原文、整形済み本文、箇条書き、音声 word timestamp、waveform を保持します。
- `practice_generations`: Split/Translate の生成単位です。`client_request_id` と `status` で復元・冪等性・破棄を管理します。
- `translation_cards`: 日本語/英語カード、音声 timestamp、復習状態を保持します。
- アプリからの insert/update/delete は基本的に Edge Function または RPC 経由です。通常のクライアント権限は select を中心にします。
- schema 世代が変わると、アプリ起動時に古い匿名セッション、旧復習状態、端末内録音 index/files を自動クリアします。
