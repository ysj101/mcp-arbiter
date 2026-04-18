#!/usr/bin/env bash
# PreToolUse hook (matcher: Bash)
# `.env*`（.env.example を除く）を git add / git commit に含めようとしたら拒否する。
# 秘密情報の誤コミットを未然防止する。

set -u

payload="$(cat -)"

command=$(printf '%s' "$payload" | jq -r '.tool_input.command // empty')

if [[ -z "$command" ]]; then
  exit 0
fi

if printf '%s' "$command" | grep -qE '(^|[[:space:]])git[[:space:]]+(add|commit)'; then
  if printf '%s' "$command" | grep -qE '\.env(\.[a-zA-Z0-9_-]+)?([[:space:]]|$)' \
     && ! printf '%s' "$command" | grep -qE '\.env\.example'; then
    cat <<'JSON'
{
  "decision": "block",
  "reason": ".env ファイル（.env.example を除く）は commit しないでください。秘密情報が含まれる可能性があります。"
}
JSON
    exit 0
  fi
fi

exit 0
