.DEFAULT_GOAL := help

.PHONY: help install up down status dev proxy harness invoke build check typecheck test e2e clean

help: ## このヘルプを表示
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z0-9_-]+:.*?## / {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## 依存をインストール (pnpm install)
	pnpm install

up: ## Colima + docker compose (cosmos + signalr) を起動
	pnpm run dev:up

down: ## docker compose を停止
	pnpm run dev:down

status: ## Colima / docker / compose サービスの状態を表示
	pnpm run dev:status

dev: up ## インフラ起動後、全 dev サーバー (proxy / dashboard / mcp-tool) を並行起動
	pnpm -r --parallel --if-present dev

proxy: ## proxy を mcp-tool 接続済みで dev 起動（事前に mcp-tool を build）
	pnpm --filter @arbiter/mcp-tool build
	pnpm --filter @arbiter/proxy dev

harness: ## harness fixture で policy エンジンをバッチ検証 (report.md / report.json 出力)
	pnpm harness:run

invoke: ## 3 デモシナリオを proxy に投げて ALLOW/DENY を確認（proxy + mcp-tool も自動で起動）
	pnpm e2e:local

build: ## 全 package をビルド
	pnpm -r build

check: ## Biome check (lint + format)
	pnpm -w check

typecheck: ## tsc typecheck
	pnpm -w typecheck

test: ## 全 package のテスト
	pnpm -w test

e2e: up ## インフラ起動 + one-shot E2E 検証
	pnpm e2e:local

clean: ## コンテナ停止 + volume 削除
	docker compose down -v
