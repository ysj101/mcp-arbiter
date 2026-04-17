# CLAUDE.md — MCP Arbiter

このファイルは Claude Code / 新規参入開発者が本プロジェクトで迷わず作業するための知識集約ドキュメントです。
より詳細な仕様や背景は `docs/` 配下を参照してください。

- コンセプト: [docs/overview.md](docs/overview.md)
- 詳細仕様: [docs/spec.md](docs/spec.md)

---

## 1. プロジェクト目的

**MCP Arbiter** は、AI エージェントが外部ツール（API / DB / 業務システム）を実行する前にその妥当性・安全性・コンプライアンスをリアルタイムで審査・制御する **ガバナンスレイヤー（Constitution Layer）** です。

> "AIに自由を与えるために、制約を設計する"

3 段階パイプラインでツール実行を審査します。

1. **Intent 解析** — ツール呼び出しから構造化情報を抽出
2. **Policy 評価** — ルール + LLM ハイブリッド（Agent Service の複数審理官による合議）
3. **判決エンジン** — `ALLOW` / `DENY` と判決文を生成

---

## 2. アーキテクチャ要約

```
[Client Agent (Microsoft Agent Framework)]
        │ MCP (stdio/HTTP)
        ▼
[MCP Arbiter Proxy (Azure Functions)]
  ├─ Intent Analyzer
  ├─ Policy Engine (Rule + LLM Hybrid, Agent Service)
  └─ Decision Engine → 判決文生成
        │ Allow 時のみ中継
        ▼
[Dummy Email MCP]

並行: [Next.js Dashboard] ← SignalR ← Proxy
永続化: Azure Cosmos DB Serverless (policies / verdicts)
```

詳細は [docs/spec.md](docs/spec.md) §3 を参照。

---

## 3. ディレクトリ構成（pnpm workspace）

```
mcp-arbiter/
├─ docs/                     # 仕様書・コンセプト
├─ packages/
│  ├─ shared-types/          # 共通型定義（Intent / Verdict / Policy / AgentIdentity 等）
│  ├─ proxy/                 # MCP Arbiter Proxy 本体（Azure Functions）
│  ├─ mcp-tool/              # Dummy Email MCP（自作最小実装）
│  ├─ dashboard/             # Next.js ダッシュボード
│  ├─ client/                # デモ用 Client Agent
│  └─ harness/               # E2E 検証 / シナリオハーネス
├─ .claude/                  # Claude Code 設定・commands・agents
├─ CLAUDE.md                 # 本ファイル
└─ README.md
```

> 初期状態では `packages/` 以下は未整備です。[issue #1](https://github.com/ysj101/mcp-arbiter/issues/1) で整備されます。各パッケージには必要に応じて個別の `CLAUDE.md` を置き、パッケージ固有の文脈を補足します。

---

## 4. 用語辞書（法廷メタファ）

ユーザー向け UI・ログ・コード識別子では以下の法廷メタファ語彙を一貫して使います。

| 一般用語 | Arbiter 用語 | 説明 |
|---|---|---|
| リクエスト | **申立（Intent）** | エージェントが発したツール実行要求 |
| ポリシー | **憲法 / 法令（Policy）** | 事前定義された審査基準 |
| 違反内容 | **罪状（Charge）** | 違反したポリシー名 |
| 検知要素 | **証拠（Evidence）** | 具体的に検知した入力要素 |
| 判定結果 | **判決（Verdict）** | `ALLOW` / `DENY` |
| 説明理由 | **判決文（Judgment）** | LLM 生成の自然文 |
| ログ履歴 | **判例集** | 過去判決の集合 |
| サブエージェント | **審理官** | Agent Service の合議サブエージェント |

コード内の型名・識別子はこの語彙を踏襲してください（`Intent`, `Verdict`, `Policy`, `SubAgentOpinion` など）。

---

## 5. よく使うコマンド

現在 packages/ は未整備ですが、整備後は以下のコマンドがルートから実行できる想定です。

### Workspace 全体

```bash
pnpm install                 # 依存解決
pnpm -r build                # 全 package ビルド
pnpm -w lint                 # lint
pnpm -w format               # format
pnpm -w format:check         # format 検証のみ
pnpm -w typecheck            # 型チェック
pnpm -r test                 # 全 package テスト
```

### ローカル E2E（ARBITER_MODE=local）

```bash
colima start --cpu 4 --memory 8    # Docker ランタイム起動（Docker Desktop は使わない）
docker compose up -d               # Cosmos Emulator / SignalR Emulator
pnpm e2e:local                     # Proxy + Dashboard + Client Agent をローカルで起動
pnpm harness:run                   # シナリオハーネス実行
```

### Azure Functions

```bash
func start                         # Proxy をローカル起動
func azure functionapp publish <name>
```

### GitHub

```bash
gh pr create
gh pr view
gh run list
```

---

## 6. 開発ルール

### 6.1 Adapter 経由の依存

Azure 固有サービスは必ず Adapter インターフェース越しに利用します（`StorageAdapter` / `PubSubAdapter` / `LLMAdapter` / `AuthAdapter`）。これにより `ARBITER_MODE=local` で Cosmos / SignalR / LLM のモック実装に差し替えられるようにします。

アプリケーションコードから直接 `@azure/cosmos` や `@azure/signalr` を import してはいけません。

### 6.2 ARBITER_MODE 切替

- `ARBITER_MODE=local` — Azure 依存ゼロで起動（Cosmos Emulator / SignalR Emulator / LLM ローカルモック）
- `ARBITER_MODE=cloud` — Azure 実リソースに接続

開発は **local 優先**。cloud は動作確認・デモ時のみ。

### 6.3 ローカル優先の開発フロー

1. まず `ARBITER_MODE=local` で E2E が回る状態を保つ
2. Cloud リソース依存の機能は Adapter の裏で実装し、Local 実装を先に揃える
3. Cosmos Serverless の課金を避けるため開発中は Emulator を使う

### 6.4 型契約は `@arbiter/shared-types`

パッケージ間で共有する型（`Intent`, `Verdict`, `Policy`, `SubAgentOpinion`, `AgentIdentity`）は `@arbiter/shared-types` に集約します。重複定義禁止。

### 6.5 UI の法廷メタファ

ダッシュボードの UI 文言は §4 の語彙を貫徹してください。凝ったアニメーション演出は行わず、語彙と情報設計で世界観を表現します。

---

## 7. 環境変数・シークレット取扱い

### 7.1 基本方針

- 秘密情報は `.env.local`（gitignore 済み）にのみ保存
- `.env.example` を常に最新化し、新しい変数を追加したら PR に含める
- `ARBITER_MODE` は必ずデフォルト値を持たせる（未設定時は `local`）
- Azure のシークレットはローカルでは **持たない**（Entra ID / Managed Identity / Key Vault 前提）

### 7.2 主な環境変数

| 変数 | 用途 | local 既定 | cloud 必須 |
|---|---|---|---|
| `ARBITER_MODE` | 動作モード | `local` | `cloud` |
| `COSMOS_ENDPOINT` | Cosmos 接続先 | Emulator URL | Azure Cosmos URL |
| `COSMOS_KEY` | Cosmos アクセスキー | Emulator 既定キー | Key Vault 参照推奨 |
| `SIGNALR_CONNECTION_STRING` | SignalR 接続 | Emulator | Azure SignalR |
| `OPENAI_API_KEY` / `AZURE_OPENAI_*` | LLM 呼出 | ローカルモック時は不要 | 必須 |
| `ENTRA_TENANT_ID` / `ENTRA_CLIENT_ID` | Dashboard 認証 | バイパス | 必須 |

### 7.3 コミット前チェック

- `.env*` ファイル（`.env.example` を除く）をコミットしていないか確認
- キー・トークン文字列をコード内にハードコードしていないか
- テストコードに実 API キーが紛れていないか

---

## 8. Claude Code セットアップ

初回クローン時に Claude Code 設定を展開してください。

```bash
cp .claude/settings.example.json .claude/settings.json
cp .claude/settings.local.example.json .claude/settings.local.json  # 任意
```

詳細は [.claude/README.md](.claude/README.md) 参照。チーム共通の permissions / hooks / env が設定済みで、`ARBITER_MODE=local` が既定で入ります。

---

## 9. 参考リンク

- ハッカソン: Microsoft Agent Hackathon 2026 (powered by Tokyo Electron Device)
- 審査期間: 2026-05-25 〜 2026-06-18
- Issue トラッカ: [GitHub Issues](https://github.com/ysj101/mcp-arbiter/issues)
- トラック ラベル: `track-e`（DevEx / 開発基盤）、`area:infra`, `area:devex` など

---

*本ドキュメントは開発の進展に応じて継続的に更新します。新しい運用・慣習を導入したら必ずここを書き換えてください。*
