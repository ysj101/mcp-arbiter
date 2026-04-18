# MCP Arbiter

### *A Constitution Layer for Agentic Systems*

> **"AIに自由を与えるために、制約を設計する"**
>
> エージェント時代の Zero Trust 基盤

---

## 概要

**MCP Arbiter** は、AI エージェントが外部ツール（API・DB・業務システム）を実行する前に、その行為の**妥当性・安全性・コンプライアンス**をリアルタイムで審査・制御する**ガバナンスレイヤー（Constitution Layer）**です。

従来のエージェントは「できること」を拡張してきましたが、MCP Arbiter は**「やってよいこと」を定義・制御**します。

---

## 解決する課題

- AI エージェントが誤ったツールを実行するリスク
- 機密データの意図しない外部送信
- 不正・過剰な操作（誤送信・誤更新）
- ツール連携（MCP）の増加による**統制の不在**

> 「AI が何をできるか」ではなく「AI に何をさせてよいか」を定義できていない

---

## アプローチ — 3 段階パイプライン

```
[User / System]
      ↓
[Agent (Planner)]
      ↓
[MCP Arbiter]
  ├─ ① Intent Analyzer   意図の構造化
  ├─ ② Policy Engine     ルール + LLM ハイブリッド審理
  └─ ③ Decision Engine   判決文生成
      ↓
[Tool / API / DB]
```

| 段階 | 役割 |
|---|---|
| ① Intent 解析 | ツール呼び出しから対象・影響範囲・機密性ヒントを抽出 |
| ② Policy 評価 | ルールフィルタ + Agent Service サブエージェント合議 |
| ③ 判決 | `ALLOW` / `DENY` と説明可能な判決文を返却 |

---

## 特徴

- 🔐 **リアルタイム制御** — ツール実行前に必ず介入し事故を未然防止
- 🧠 **意図ベース判断** — 単純なルールではなく文脈・目的を考慮
- 🧾 **説明可能性** — すべての判断に理由を付与（監査対応）
- 🔌 **MCP ネイティブ設計** — あらゆるツール連携に横断的に適用可能
- 🏢 **エンタープライズ対応** — 権限管理・監査ログ・ポリシー運用を前提設計

---

## 技術スタック

| レイヤ | 採用技術 |
|---|---|
| プロキシ本体 | Node.js (TypeScript) |
| 実行基盤 | Azure Functions |
| AI / エージェント | Azure AI Foundry **Agent Service** |
| ストレージ | Azure Cosmos DB Serverless |
| 認証 | Microsoft Entra ID |
| リアルタイム通信 | Azure SignalR Service |
| フロントエンド | Next.js + Tailwind CSS |
| ホスティング (UI) | Azure Static Web Apps |
| クライアント Agent | Microsoft Agent Framework |

---

## デモシナリオ（法廷ドラマ構成）

1. **事件** — 社員が「この人事評価ドラフトを誰か第三者にレビュー依頼として送って」とエージェントに指示。エージェントは評価対象**本人**に送ろうとする。
2. **審理** — MCP Arbiter がツール呼び出しを捕捉し、Intent 解析 → サブエージェント合議 → 判決文生成を UI にストリーミング表示。
3. **判決** — `DENY`。罪状・証拠・判決文が法廷カード風にダッシュボードへ流れる。

---

## ユースケース

- 📧 **メール送信制御** — 社外ドメイン送信・機密情報含有の検知
- 🗄️ **データ操作** — 本番 DB 更新・大量削除のブロック
- 💼 **業務システム連携** — ERP 操作・財務データ取得の権限チェック

---

## プロジェクト情報

- **対象ハッカソン:** Microsoft Agent Hackathon 2026 (powered by Tokyo Electron Device)
- **開発体制:** ソロ
- **開発期間:** 〜2026 年 5 月中旬目標
- **審査期間:** 2026 年 5 月 25 日 〜 6 月 18 日

---

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
make proxy       # mcp-tool を build → proxy を :7071 で dev 起動（downstream 接続済み）
```

別ターミナルで疎通確認:

```bash
curl http://localhost:7071/healthz
# => {"ok":true,"mode":"local","downstream":true}
```

> `PORT` 環境変数で待ち受けポートを変更可能。`make invoke` は 17300 を使用する。

### 3. 検証手段

**(a) curl で /invoke を直接叩く**

```bash
# 人事評価ドラフトを本人に送る → DENY されるはず
curl -X POST http://localhost:7071/invoke \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer dev-shared-secret-change-me' \
  -d '{"tool":"send_email","parameters":{"to":"taro@example.com","subject":"人事評価ドラフト","body":"..."}}'
```

**(b) デモ 3 シナリオを一括検証**

```bash
make invoke      # proxy + mcp-tool を spawn し hr-eval=DENY / daily-standup=ALLOW / credentials-leak=DENY を自動検証
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

起動ログに `[arbiter-proxy] seeded N policies from ...` が出れば差し替え成功。

---

## ドキュメント

- [コンセプト概要](./docs/overview.md)
- [詳細仕様書](./docs/spec.md)

---

## コンセプトメッセージ

> エージェント時代において、「何ができるか」は既に十分だ。
> 問われているのは「何をさせてよいか」である。
>
> **MCP Arbiter** は、あらゆるエージェントとツールの間に立つ裁定者として、
> ツール実行の前に意図を読み、ポリシーに照らし、判決を下す。
>
> これは能力の制限ではない。**安全に拡張可能にするための基盤**である。
