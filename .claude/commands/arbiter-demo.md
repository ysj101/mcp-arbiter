---
description: ローカル E2E デモ（Proxy + Dashboard + Client Agent）を一括起動
argument-hint: "[--no-docker]"
---

# /arbiter-demo

MCP Arbiter のローカル E2E デモを起動する。法廷ドラマ構成（事件 → 審理 → 判決）が実際に走る状態まで持っていく。

## 前提

- `ARBITER_MODE=local` が設定されていること（`.claude/settings.json` で既定）
- `colima start` が完了していること
- `pnpm install` 済みであること
- `$ARGUMENTS` に `--no-docker` が含まれていれば docker compose 起動をスキップ

## 手順

1. **ランタイム確認**
   - `colima status` で Colima が running か確認。止まっていれば起動手順を提示して停止。
   - `docker info` が通ることを確認。
2. **Emulator 起動**（`--no-docker` 未指定時）
   - `docker compose up -d` で Cosmos DB Emulator / Azure SignalR Emulator を起動。
   - `docker compose ps` で各サービスが healthy になるまで待機（最大 60 秒）。
3. **Workspace ビルド**
   - `pnpm -w build` を実行。失敗ならログを提示して停止。
4. **プロセス起動**（以下を並列バックグラウンドで）
   - `pnpm --filter @arbiter/proxy dev` — Azure Functions ローカル (`func start`)
   - `pnpm --filter @arbiter/dashboard dev` — Next.js (3000 番ポート)
   - `pnpm --filter @arbiter/client dev` — デモ用 Client Agent
5. **疎通確認**
   - Proxy のヘルスエンドポイント（例: `http://localhost:7071/api/health`）が 200 を返すことを確認。
   - Dashboard が `http://localhost:3000` で開けることを確認。
6. **デモシナリオのトリガ**
   - `pnpm --filter @arbiter/harness run demo:send-email-misdirect` を実行し、判決ログが Dashboard にストリームされることを促す。

## 出力

- 起動済みプロセスの PID / URL 一覧
- Dashboard のアクセス URL（`http://localhost:3000`）
- 停止方法（`docker compose down` / 各プロセス `kill`）

## 注意

- packages が整備されるまでは上記 script は未実装。本コマンドは [issue #12](https://github.com/ysj101/mcp-arbiter/issues/12) 以降で動く想定。
- 未実装フェーズでは「何が足りないか」を一覧にして返す（スクリプト不在の場合は skip）。
