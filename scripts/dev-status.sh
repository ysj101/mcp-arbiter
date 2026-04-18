#!/usr/bin/env bash
# Report local dev stack status.

set -uo pipefail

echo "== Colima =="
colima status 2>/dev/null || echo "colima: not running"

echo
echo "== Docker =="
if docker info >/dev/null 2>&1; then
  docker info --format 'Docker: {{.ServerVersion}} on {{.OperatingSystem}}'
else
  echo "Docker: unreachable"
fi

echo
echo "== compose services =="
docker compose ps 2>/dev/null || true
