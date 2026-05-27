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

Supabase の DB 反映は hosted project に対して行います。DB パスワードは repo 外の secret file から環境変数として読み込んでください。

```bash
set -a
source path/to/supabase.env
set +a
supabase db push --yes
```
