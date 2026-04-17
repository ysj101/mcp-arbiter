#!/usr/bin/env bash
# PreToolUse hook (matcher: Bash)
# `git commit` を Claude 経由で打とうとしたタイミングで lint + typecheck を走らせ、
# 失敗ならコミットを block する。
# 依存: pnpm workspace (biome + tsc)

set -u

payload="$(cat -)"
command=$(printf '%s' "$payload" | jq -r '.tool_input.command // empty')

if [[ -z "$command" ]]; then
  exit 0
fi

# git commit 呼び出しのみ対象（amend/rebase 等は除外しない）
if ! printf '%s' "$command" | grep -qE '(^|[[:space:]])git[[:space:]]+commit([[:space:]]|$)'; then
  exit 0
fi

# pnpm が見つからない（= 未 install）なら skip
if ! command -v pnpm >/dev/null 2>&1; then
  exit 0
fi

# Repository root で biome.json + package.json が揃っていれば実行
if [[ ! -f biome.json || ! -f package.json ]]; then
  exit 0
fi

lint_output=""
type_output=""
lint_rc=0
type_rc=0

lint_output=$(pnpm -w check 2>&1) || lint_rc=$?
type_output=$(pnpm -w typecheck 2>&1) || type_rc=$?

if [[ $lint_rc -ne 0 || $type_rc -ne 0 ]]; then
  reason="Arbiter pre-commit check 失敗: "
  if [[ $lint_rc -ne 0 ]]; then
    reason+="biome check 失敗。"
  fi
  if [[ $type_rc -ne 0 ]]; then
    reason+="tsc typecheck 失敗。"
  fi
  reason+=" 修正してから再度コミットしてください。"

  # JSON 出力 (PreToolUse の decision: block)
  jq -n --arg reason "$reason" '{decision: "block", reason: $reason}'
  exit 0
fi

exit 0
