# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

## DB開発運用

- このアプリは開発中のため、Supabaseの既存データ保持は優先しない。
- スキーマを変えるときは、古いテーブルや匿名ユーザー、テスト用の日記・カードをリフレッシュしてよい。
- 現時点では、過去データを残すための安全な差分マイグレーションよりも、必要なテーブルだけを作り直す破壊的マイグレーションを優先する。
- リモートSupabaseへ反映するときは、DBパスワードを `/Users/sury/.keys/supabase/daily-to-english/.env` から読み込んで実行する。
- DBパスワード本体はrepoやAGENTS.mdには書かない。secretファイルはrepo外に置き、権限はディレクトリ `700`、ファイル `600` を保つ。
- 実行例: `set -a; source /Users/sury/.keys/supabase/daily-to-english/.env; set +a; supabase db push --yes`
- 本番運用に入る段階では、この方針を見直し、データ保持を前提にした通常のマイグレーション運用へ切り替える。
