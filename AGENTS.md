# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

## 確認運用

- このリポジトリでは、ユーザーから明示的に依頼されない限り、実装後のブラウザ・Web確認は行わない。
- ユーザーから明示的に依頼されない限り、`bun run ios`、`npx expo run:ios`、`xcodebuild` などのネイティブ/Expoビルドやアプリ起動は行わない。必要そうな場合も、まずユーザーに確認する。
- 通常は `npx expo lint` や `npx tsc --noEmit` などの静的チェックを優先する。

## DB開発運用

- このアプリは開発中のため、Supabaseの既存データ保持は優先しない。
- このrepoでは、ユーザーから明示的に依頼されない限り、`supabase start` やDocker起動は行わない。
- スキーマを変えるときは、古いテーブルや匿名ユーザー、テスト用の日記・カードをリフレッシュしてよい。
- 現時点では、過去データを残すための安全な差分マイグレーションよりも、必要なテーブルだけを作り直す破壊的マイグレーションを優先する。
- リモートSupabaseへ反映するときは、DBパスワードを `/Users/sury/Documents/context-base/sources/keys/supabase/just-speak-it/.env` から読み込んで実行する。
- Supabase CLIは `~/.supabase/telemetry.json` などrepo外へ書き込むため、Codexのworkspace sandbox内では失敗しやすい。`supabase db push`、`supabase functions deploy`、`supabase migration list` などのリモート操作は、最初から承認付きの外側実行で行う。
- DBパスワード本体はrepoやAGENTS.mdには書かない。secretファイルはrepo外に置き、権限はディレクトリ `700`、ファイル `600` を保つ。
- 実行例: `set -a; source /Users/sury/Documents/context-base/sources/keys/supabase/just-speak-it/.env; set +a; supabase db push --yes`
- 本番運用に入る段階では、この方針を見直し、データ保持を前提にした通常のマイグレーション運用へ切り替える。
