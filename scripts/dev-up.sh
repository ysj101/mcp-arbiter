#!/usr/bin/env bash
# Boot local dev stack on macOS + Colima.
# Docker Desktop is NOT supported — use Colima.

set -euo pipefail

if ! command -v colima >/dev/null 2>&1; then
  echo "[dev-up] colima が見つかりません。'brew install colima' を実行してください。" >&2
  exit 1
fi

if ! colima status >/dev/null 2>&1; then
  echo "[dev-up] Colima を起動します (cpu=4 memory=8)..."
  colima start --cpu 4 --memory 8
else
  echo "[dev-up] Colima は既に起動中です。"
fi

if ! docker info >/dev/null 2>&1; then
  echo "[dev-up] docker コマンドが Colima に接続できません。" >&2
  exit 1
fi

echo "[dev-up] docker compose up -d"
docker compose up -d

echo "[dev-up] 起動完了。 'pnpm dev:status' で状態確認できます。"
