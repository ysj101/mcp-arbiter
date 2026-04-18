# ローカル検証クイックスタート整備

## Context

MCP Arbiter のローカル検証（憲法を差し込み、接続ツールを spawn して `/invoke` を叩く）は
`scripts/e2e-local.ts` や `make e2e` で **自動化経路は既に存在する** ものの、開発者が手元で
「curl で試す」「Dashboard で判決を見る」「カスタム憲法を差し込む」ときに以下の摩擦がある:

1. `ARBITER_DOWNSTREAM_COMMAND/ARGS` を手で設定しないと proxy から mcp-tool に繋がらない
   （[packages/proxy/src/server.ts:55-64](packages/proxy/src/server.ts:55)）
2. `ARBITER_POLICIES_FILE` が `.env.example` に載っていないので、カスタム憲法を差し込める
   ことに気付きにくい（[packages/proxy/src/server.ts:28-29](packages/proxy/src/server.ts:28)）
3. `make dev` → `pnpm -r --parallel dev` は mcp-tool を独立プロセスで立ち上げるだけで
   proxy からの子プロセスとは繋がらない（`dev` スクリプトは stdio MCP なので単独起動は無意味）
4. curl での /invoke 叩き方・`pnpm harness:run` の使いどころ・Dashboard 導線が
   README / CLAUDE.md のどこにもまとまっていない

既存デフォルト（`packages/proxy/fixtures/default-policies.json` の 3 憲法 + dummy-email-mcp）を
**ゼロ設定ですぐ試せる状態** と、**手で ALLOW/DENY を確認できる手順** を整える。
新規ポリシーや新規ツールは作らず、既存アセットを使える形にするだけ。

---

## スコープと非スコープ

**やる**:
- `.env.example` に `ARBITER_POLICIES_FILE` と `ARBITER_DOWNSTREAM_*` を追加
- `packages/proxy/package.json` の `dev` スクリプトで DOWNSTREAM 既定値を設定
- `packages/proxy/fixtures/sample-policy.json` をコピー用テンプレとして追加
- `Makefile` に `proxy` / `harness` target を追加（`make proxy` 一発で downstream 接続済み起動）
- `README.md` に「ローカル検証クイックスタート」節を追加（curl / harness / Dashboard）

**やらない**:
- 新規ポリシー・新規 MCP ツールの作成
- `.claude/commands/arbiter-demo` 等のスラッシュコマンド実装化（別タスク）
- Cosmos seed 自動化（別タスク）
- Dashboard の E2E ブラウザ自動検証

---

## 変更内容

### 1. `.env.example` 拡張

追加する項目（既存 `ARBITER_MODE` の直後、各セクション末尾にコメント付きで）:

```env
# --- Policies (local モード) ---
# proxy 起動時にこの JSON をロードして storage に seed する。未設定なら default-policies.json。
# 自前の憲法を試したいときは sample-policy.json をコピーして編集し、ここで指定する。
# ARBITER_POLICIES_FILE=packages/proxy/fixtures/default-policies.json

# --- Downstream MCP ツール ---
# proxy が ALLOW 時に中継する MCP サーバ。子プロセスとして spawn される (stdio)。
# 既定は dummy-email-mcp。別の MCP に差し替えたいときはここを変更する。
# ARBITER_DOWNSTREAM_COMMAND=node
# ARBITER_DOWNSTREAM_ARGS=packages/mcp-tool/dist/server.js
```

コメントアウトのままにしておき、`make proxy` / `scripts/e2e-local.ts` が既定値を流し込む設計。

---

### 2. `packages/proxy/package.json` — `dev` で downstream 既定値を入れる

現状（[packages/proxy/package.json:15](packages/proxy/package.json:15)）:
```json
"dev": "node --import tsx src/server.ts"
```

変更後:
```json
"dev": "ARBITER_DOWNSTREAM_COMMAND=${ARBITER_DOWNSTREAM_COMMAND:-node} ARBITER_DOWNSTREAM_ARGS=${ARBITER_DOWNSTREAM_ARGS:-packages/mcp-tool/src/server.ts} node --import tsx src/server.ts"
```

ポイント:
- `${VAR:-default}` 形式で **ユーザー指定を優先**、未指定時のみ既定値を当てる
- 既定値は `mcp-tool/src/server.ts`（tsx 経由、build 不要で dev 起動できる）
  だが、proxy は `node` で spawn してしまうため、実際にはビルド済みの
  `packages/mcp-tool/dist/server.js` を指す方が安全。build 成果物を使う。
- 最終形:
  ```json
  "dev": "ARBITER_DOWNSTREAM_COMMAND=${ARBITER_DOWNSTREAM_COMMAND:-node} ARBITER_DOWNSTREAM_ARGS=${ARBITER_DOWNSTREAM_ARGS:-packages/mcp-tool/dist/server.js} node --import tsx src/server.ts"
  ```
- `make proxy` が先に `pnpm --filter @arbiter/mcp-tool build` を走らせて dist を用意する

---

### 3. `packages/proxy/fixtures/sample-policy.json`（新規）

`default-policies.json` と同構造で、1 つの最小例 + コメント代わりの description を充実させる。
開発者がコピーして編集するテンプレ用。スキーマは `packages/shared-types/src/policy.ts:1-22` に準拠。

```json
{
  "policies": [
    {
      "policyId": "sample-allow-internal-only",
      "name": "社内ドメイン宛のみ許可（サンプル）",
      "description": "コピーして使うテンプレ。toolPattern / parameterPath / operator / value を書き換え、必要なら action を allow/deny/review に変更する。",
      "sensitiveCategories": ["exfiltration"],
      "rules": [
        {
          "toolPattern": "send_email",
          "parameterPath": "to",
          "operator": "matches",
          "value": "@example\\.com$"
        }
      ],
      "action": "allow",
      "enabled": true,
      "version": 1,
      "createdAt": "2026-04-18T00:00:00.000Z",
      "updatedAt": "2026-04-18T00:00:00.000Z"
    }
  ]
}
```

再利用する既存型: `Policy` ([packages/shared-types/src/policy.ts:1](packages/shared-types/src/policy.ts:1))。新規型は追加しない。

---

### 4. `Makefile` に target 追加

既存の `make dev` （全 package 並列 dev）とは別に、ローカル検証用の薄いラッパを追加:

```makefile
proxy: ## proxy を mcp-tool 接続済みで dev 起動（事前に mcp-tool を build）
	pnpm --filter @arbiter/mcp-tool build
	pnpm --filter @arbiter/proxy dev

harness: ## harness fixture で policy エンジンをバッチ検証 (report.md / report.json 出力)
	pnpm harness:run

invoke: ## 3 デモシナリオを proxy に投げて ALLOW/DENY を確認（proxy が :17300 で起動済みであること）
	pnpm e2e:local
```

`make up` → `make proxy`（別ターミナルで `make invoke` か手で curl）で検証が回る。
Dashboard が必要なら `pnpm --filter @arbiter/dashboard dev` を別途立ち上げる
（既存の `make dev` で十分なのでラップしない）。

---

### 5. `README.md` に「ローカル検証クイックスタート」節を追加

既存の「ドキュメント」節の直前に `## ローカル検証クイックスタート` を挿入。内容:

````markdown
## ローカル検証クイックスタート

憲法（デフォルト 3 件）とダミーツール（dummy-email-mcp）が同梱されており、ゼロ設定で試せる。

### 1. インフラ起動（初回のみ）

```bash
make up          # Colima + Cosmos/SignalR emulator を起動
pnpm install
pnpm -r build
```

### 2. Proxy + 接続ツールを起動

```bash
make proxy       # mcp-tool を build → proxy を :17300 で dev 起動（downstream 接続済み）
```

別ターミナルで疎通確認:

```bash
curl http://localhost:17300/healthz
# => {"ok":true,"mode":"local","downstream":true}
```

### 3. 検証手段

**(a) curl で /invoke を直接叩く**

```bash
# 人事評価ドラフトを本人に送る → DENY されるはず
curl -X POST http://localhost:17300/invoke \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer dev-shared-secret-change-me' \
  -d '{"tool":"send_email","parameters":{"to":"taro@example.com","subject":"人事評価ドラフト","body":"..."}}'
```

**(b) デモ 3 シナリオを一括検証**

```bash
make invoke      # hr-eval=DENY, daily-standup=ALLOW, credentials-leak=DENY を自動検証
```

**(c) harness で fixture ベースの自動テスト**

```bash
make harness     # harness/report.md, harness/report.json が出力される
```

**(d) Dashboard で判決を見る**

```bash
pnpm --filter @arbiter/dashboard dev   # http://localhost:3000
```

### 4. カスタム憲法を試す

```bash
cp packages/proxy/fixtures/sample-policy.json my-policy.json
# my-policy.json を編集
ARBITER_POLICIES_FILE=my-policy.json make proxy
```
````

---

## 変更ファイル

- `.env.example` — 2 セクション追記
- `packages/proxy/package.json` — `dev` スクリプトに DOWNSTREAM 既定値
- `packages/proxy/fixtures/sample-policy.json`（新規）
- `Makefile` — `proxy` / `harness` / `invoke` target 追加
- `README.md` — ローカル検証クイックスタート節

触らないもの:
- `packages/proxy/src/server.ts` — 既存の env ベース設計のまま
- `scripts/e2e-local.ts` — 既存動作を保つ（`make invoke` から間接的に呼ぶだけ）
- `packages/mcp-tool/**`, `packages/harness/**` — 既存のまま

---

## 検証手順

1. `.env.example` をコピーしてコメントアウトされた項目を確認（= 未設定時も default が効くこと）
2. `make up && make proxy` で proxy が `{"ok":true,"downstream":true}` を返すこと
3. `make invoke` が `[hr-eval-misdirect] ... OK` / `[daily-standup] ... OK` / `[credentials-leak] ... OK` / `[auth] unauthorized -> 401 OK` で終了すること
4. `make harness` が `harness/report.json` を生成し exit 0 すること
5. Dashboard (`http://localhost:3000`) で 3 件の判決が表示されること
6. `ARBITER_POLICIES_FILE=packages/proxy/fixtures/sample-policy.json make proxy` で
   proxy ログに `[arbiter-proxy] seeded 1 policies from packages/proxy/fixtures/sample-policy.json`
   と出ること

上記 6 点が全て通れば整備完了。
