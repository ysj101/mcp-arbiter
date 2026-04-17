# `.claude/` — Claude Code 設定

このディレクトリには MCP Arbiter プロジェクトの Claude Code 設定が格納されます。

## セットアップ

初回クローン時に以下を実行してください。

```bash
cp .claude/settings.example.json .claude/settings.json
cp .claude/settings.local.example.json .claude/settings.local.json  # 個人用（任意）
```

- `.claude/settings.json` — **プロジェクト共有**（gitignore）。チーム共通の permissions / hooks / env。テンプレは [settings.example.json](settings.example.json)。
- `.claude/settings.local.json` — **個人オーバーライド**（gitignore）。自分だけの追加 allow や env など。テンプレは [settings.local.example.json](settings.local.example.json)。

> **補足**: `.claude/settings.json` 自体を commit する運用でも構いません。その場合は `.gitignore` から除外してください。ハッカソン開発では個人環境差分が出やすいため、**テンプレートを commit + 実ファイルは gitignore** という運用を推奨します。

## 含まれるもの

### `settings.example.json` （プロジェクト共有テンプレート）

- `env.ARBITER_MODE=local` を既定
- `permissions.allow` — `pnpm`, `npm`, `node`, `docker compose`, `gh`, `func`, `git`（read-only + add/commit/push/rebase 等）, `colima status`, `jq` など日常開発で頻出するコマンド
- `permissions.ask` — `docker compose down`, `colima stop`, force push, `gh pr merge` など破壊的/共有影響のある操作
- `permissions.deny` — `rm -rf /`, `main` への force push
- `hooks.PreToolUse` — `deny-env-commit.sh` が `.env*` の誤 commit を拒否
- `hooks.Stop` — `stop-reminder.sh` が起動中 docker コンテナの後片付けを促す

### `settings.local.example.json` （個人テンプレート）

最低限の雛形のみ。自分用の追加 allow、環境変数、model などを足してください。

### `hooks/`

- [hooks/deny-env-commit.sh](hooks/deny-env-commit.sh) — `.env` ファイル（`.env.example` を除く）を `git add/commit` に含めようとしたら block
- [hooks/pre-commit-check.sh](hooks/pre-commit-check.sh) — `git commit` 前に `pnpm -w check`（biome lint + format）と `pnpm -w typecheck` を走らせ、失敗なら block
- [hooks/stop-reminder.sh](hooks/stop-reminder.sh) — セッション終了時に docker コンテナの起動を通知

両スクリプトは実行ビットを立てた状態で commit されています。

### `commands/` （slash コマンド）

| コマンド | 用途 | 引数 |
|---|---|---|
| [`/arbiter-demo`](commands/arbiter-demo.md) | ローカル E2E デモを一括起動（Proxy / Dashboard / Client Agent） | `[--no-docker]` |
| [`/policy-test`](commands/policy-test.md) | 指定ポリシーを単体検証（Intent fixture で ALLOW/DENY 確認） | `<policy-id>` |
| [`/verdict-inspect`](commands/verdict-inspect.md) | 判決詳細を法廷カード風に整形表示 | `<verdict-id>` |

### `agents/` （サブエージェント）

| エージェント | 用途 |
|---|---|
| [`policy-reviewer`](agents/policy-reviewer.md) | ポリシー定義・LLM judge prompt・Cosmos seed をレビュー。通過 / 条件付き通過 / 差し戻しを判定。 |
| [`verdict-writer`](agents/verdict-writer.md) | 判決文生成プロンプトの改善提案。法廷メタファ整合・説明可能性・Prompt Injection 耐性を点検。 |

サブエージェントは Claude Code から `@policy-reviewer` / `@verdict-writer` のようにメンションするか、Task Tool で `subagent_type: policy-reviewer` を指定して起動する。

## 権限の追加方法

個人用に追加 allow したいコマンドがある場合は `.claude/settings.local.json` に追記してください（こちらは gitignore）。チーム共有で追加したい場合は `settings.example.json` に PR を出します。

`/hooks` メニューで hook の有効/無効やテスト実行ができます。
