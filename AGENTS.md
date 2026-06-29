# リポジトリ運用

## Expo

- コードを書く前に、必ず Expo SDK 56 の公式ドキュメントを確認する: https://docs.expo.dev/versions/v56.0.0/

## 確認運用

- このリポジトリでは、ユーザーから明示的に依頼されない限り、実装後のブラウザ・Web確認は行わない。
- ユーザーから明示的に依頼されない限り、`bun run ios`、`npx expo run:ios`、`xcodebuild` などのネイティブ/Expoビルドやアプリ起動は行わない。必要そうな場合も、まずユーザーに確認する。
- 通常は `npx expo lint` や `npx tsc --noEmit` などの静的チェックを優先する。

## DB開発運用

- `package.json` の `version` が `1.0.0` の間は、Supabaseの既存データ保持を優先しない。過去データとの互換性より、スキーマ設計の綺麗さと単純さを優先する。
- スキーマ変更では、差分・互換マイグレーションを積み上げない。履歴都合の複雑さを残さず、必要なテーブル、関数、ポリシーを作り直して完全リフレッシュする。
- Supabase CLIの形式上 `supabase/migrations/*.sql` は使うが、目的は既存データの移行ではない。現在必要なスキーマへ破壊的に再構築するために使う。
- ローカル Docker Supabase（`supabase start`、`supabase db reset --local`）は、Supabase変更後の確認に使わない。ユーザーから明示的に依頼された場合だけ起動する。
- リモートSupabaseへ反映するときは、DBパスワードを `/Users/sury/Documents/context-base/sources/keys/supabase/just-speak-it/.env` から読み込んで実行する。
- Supabase CLIは `~/.supabase/telemetry.json` などrepo外へ書き込むため、Codexのworkspace sandbox内では失敗しやすい。`supabase db push`、`supabase functions deploy`、`supabase migration list` などの操作は、最初から承認付きの外側実行で行う。
- DBパスワード本体はrepoやAGENTS.mdには書かない。secretファイルはrepo外に置き、権限はディレクトリ `700`、ファイル `600` を保つ。
- 実行例: `set -a; source /Users/sury/Documents/context-base/sources/keys/supabase/just-speak-it/.env; set +a; supabase db push --yes`
- `version` が `1.0.0` を超える段階、または本番運用に入る段階では、この方針を見直し、データ保持を前提にした通常のマイグレーション運用へ切り替える。
