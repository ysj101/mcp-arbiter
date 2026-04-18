#!/usr/bin/env bash
# PreToolUse hook (matcher: Bash)
# `git commit` を Claude 経由で打とうとしたタイミングで CI と同じ検証を走らせ、
# 失敗ならコミットを block する。CI と同じ順序:
#   1. biome check (lint + format)
#   2. build (project references のため typecheck の前提)
#   3. tsc typecheck
#   4. test
# 依存: pnpm workspace (biome + tsc + vitest)

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

lint_rc=0
build_rc=0
type_rc=0
test_rc=0

pnpm -w check >/dev/null 2>&1 || lint_rc=$?
pnpm -r build >/dev/null 2>&1 || build_rc=$?
pnpm -w typecheck >/dev/null 2>&1 || type_rc=$?
pnpm -w test >/dev/null 2>&1 || test_rc=$?

if (( lint_rc != 0 || build_rc != 0 || type_rc != 0 || test_rc != 0 )); then
  reason="Arbiter pre-commit check 失敗:"
  (( lint_rc != 0 )) && reason+=" [biome check]"
  (( build_rc != 0 )) && reason+=" [pnpm -r build]"
  (( type_rc != 0 )) && reason+=" [tsc typecheck]"
  (( test_rc != 0 )) && reason+=" [pnpm -w test]"
  reason+=" が失敗しました。ターミナルで該当コマンドを実行して原因を特定し、修正してから再度コミットしてください。"

  jq -n --arg reason "$reason" '{decision: "block", reason: $reason}'
  exit 0
fi

exit 0
