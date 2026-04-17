#!/usr/bin/env bash
# Stop hook
# Session 終了時に docker compose の後片付けを促すリマインダを表示する。
# 実行中のコンテナがない場合は沈黙する。

set -u

if ! command -v docker >/dev/null 2>&1; then
  exit 0
fi

running=$(docker ps --filter "label=com.docker.compose.project" --format '{{.Names}}' 2>/dev/null | head -n 5)

if [[ -z "$running" ]]; then
  exit 0
fi

cat <<JSON
{
  "systemMessage": "Arbiter: docker compose のコンテナが起動中です (${running//$'\n'/, })。終了するなら \`docker compose down\` を実行してください。"
}
JSON

exit 0
