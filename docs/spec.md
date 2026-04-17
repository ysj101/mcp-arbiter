# MCP Arbiter — 仕様書

> *"AIに自由を与えるために、制約を設計する"*
>
> エージェント時代のZero Trust基盤

---

## 0. メタ情報

| 項目 | 内容 |
|---|---|
| プロジェクト名 | **MCP Arbiter** |
| サブタイトル | A Constitution Layer for Agentic Systems |
| 対象ハッカソン | Microsoft Agent Hackathon 2026 (powered by Tokyo Electron Device) |
| 開発体制 | ソロ |
| 開発期間 | 約1ヶ月（〜2026年5月中旬目標） |
| 審査期間 | 2026年5月25日〜6月18日 |
| 訴求軸 | **「エージェント時代のZero Trust基盤」**（技術者訴求） |

---

## 1. プロダクト定義

**MCP Arbiter** は、AIエージェントが外部ツール（API・DB・業務システム）を実行する前に、その行為の**妥当性・安全性・コンプライアンス**をリアルタイムで審査・制御する**ガバナンスレイヤー（Constitution Layer）**である。

従来のエージェントは「できること」を拡張してきたが、MCP Arbiter は**「やってよいこと」を定義・制御する**。

### 解決する課題

- AIエージェントが誤ったツールを実行するリスク
- 機密データの意図しない外部送信
- 不正・過剰な操作（誤送信・誤更新）
- ツール連携（MCP）の増加による**統制の不在**

> 「AIが何をできるか」ではなく「AIに何をさせてよいか」を定義できていない

---

## 2. ハッカソン要件の充足マトリクス

| 要件 | 対応 |
|---|---|
| 【必須】Azure実行基盤 | Azure Functions（軽量構成） |
| 【必須】Microsoft AI技術 | **Azure AI Foundry Agent Service**（差別化の核） |
| 【推奨】Azure Cosmos DB | Cosmos DB Serverless（ポリシー/ログ永続化） |
| 【推奨】Microsoft Entra ID | ダッシュボード認証 + 審査員アクセス管理 |
| 【推奨】GitHub | リポジトリ公開（GitHub Copilot併用） |
| 提出: 成果物URL | Static Web Apps公開 + Entra ID認証 |
| 提出: Zennブログ | デモ動画+アーキ図埋め込みで提出 |
| 提出: GitHub | 公開予定 |

### 審査基準との整合

- **ビジネスインパクト**: Agent時代のガバナンス不在は全企業共通課題 → Zero Trust基盤として普遍的価値
- **アプローチの有効性**: Agent Serviceで「複数審理官の合議」というAgentic設計 → エージェント論理で課題を解く
- **完成度・実現性**: Functions + Cosmos DB Serverlessで低ランニングコスト、Entra IDで実運用要件

---

## 3. アーキテクチャ

```
┌─────────────────────────────────────────┐
│  Microsoft Agent Framework Agent        │  ← クライアント
│  (デモ用: 人事評価ドラフトを送るエージェント) │
└──────────────────┬──────────────────────┘
                   │ MCP (stdio/HTTP)
                   ▼
┌─────────────────────────────────────────┐
│  MCP Arbiter Proxy (Azure Functions)    │
│  ├─ ① Intent Analyzer                   │
│  ├─ ② Policy Engine (Rule + LLM Hybrid) │
│  │    └─ Azure AI Foundry Agent Service │
│  │       (複数審理官サブエージェント合議)   │
│  └─ ③ Decision Engine → 判決文生成         │
└──────────────────┬──────────────────────┘
                   │ (Allow時のみ中継)
                   ▼
┌─────────────────────────────────────────┐
│  Dummy Email MCP (自作・最小実装)          │
└─────────────────────────────────────────┘

並行して:
┌─────────────────────────────────────────┐
│  Next.js Dashboard (Static Web Apps)    │
│  - Entra ID 認証                        │
│  - ポリシーGUI編集                        │
│  - 判定ログのリアルタイム表示 (SignalR)    │
│  - 法廷メタファUI（罪状/証拠/判決）         │
└─────────────────────────────────────────┘

永続化: Azure Cosmos DB Serverless
  - policies コンテナ (ポリシー定義)
  - verdicts コンテナ (判定ログ)
```

---

## 4. 技術スタック

| レイヤ | 採用技術 | 選定理由 |
|---|---|---|
| プロキシ本体 | Node.js (TypeScript) | MCP SDKの成熟度、開発者の慣れ |
| 実行基盤 | Azure Functions | ハッカソン必須要件、軽量 |
| AI/エージェント | Azure AI Foundry **Agent Service** | 必須要件+差別化軸 |
| ストレージ | Azure Cosmos DB Serverless | 推奨技術+従量課金で安価 |
| 認証 | Microsoft Entra ID | 推奨技術+審査員アクセス管理 |
| リアルタイム通信 | Azure SignalR Service | WebSocket管理不要、Functions親和 |
| フロントエンド | Next.js + Tailwind CSS | 使い慣れた標準構成 |
| ホスティング(UI) | Azure Static Web Apps | 無料枠、Entra ID連携容易 |
| クライアントAgent | Microsoft Agent Framework | ハッカソン親和性 |
| 対象ツール | 自作Dummy Email MCP | 最小実装でシナリオ制御 |

---

## 5. コア機能（MVP）

### 5.1 判定エンジン — 3段階パイプライン

すべての段階をUIで**ストリーミング表示**し、Agentic AIらしさを可視化する。

#### ① Intent解析

ツール呼び出しから構造化情報を抽出:

```typescript
interface Intent {
  tool: string;              // 例: "send_email"
  parameters: Record<string, any>;
  extractedContext: {
    targetResource: string;  // 例: "人事評価ドラフト"
    recipients: string[];    // 例: ["tanaka@example.com"]
    sensitivityHint: string; // 例: "個人情報含有の可能性"
    scope: "internal" | "external" | "mixed";
  };
}
```

#### ② Policy評価（Hybrid: Rule + LLM）

1. **ルールフィルタ**（高速）: ツール名・パラメータの明確な違反をチェック
2. **LLM意味判定**（深度）: Agent ServiceのサブエージェントがLLMで意味的機密性を判定
3. **合議**: 複数サブエージェント（審理官）の判断を統合

#### ③ 判決エンジン

```typescript
interface Verdict {
  decision: "ALLOW" | "DENY";
  confidence: number;
  charge: string;         // 罪状（違反したポリシー名）
  evidence: string[];     // 証拠（具体的に検知した要素）
  judgment: string;       // 判決文（LLM生成の自然文）
  policyRef: string;      // 適用ポリシーID
  traceId: string;        // Agent Service Trace
}
```

### 5.2 ポリシーパターン（MVP = 1種のみ）

**機密キーワード意味検知** のみを実装。

- 単純な文字列マッチではなく、**LLMによる意味的機密性判定**
- 例: "この内容を添付します"に人事評価テキストが続く場合も検知
- ハードコードでなく、Cosmos DBに格納されたポリシー定義から動的読込

### 5.3 判定結果の2段階

- ✅ **ALLOW**: ツール呼び出しを中継
- ❌ **DENY**: ツール呼び出しをブロック、判決文を返却

（要承認/Escalateは**MVP範囲外**）

### 5.4 ポリシー管理UI

- Next.js製管理画面からGUIでポリシーをCRUD
- Entra ID認証で保護
- ポリシー記述は画面上のフォームで（YAML直書きはさせない）

### 5.5 判定ログのリアルタイムストリーム

- SignalR Service経由で判定結果を即座にUI配信
- 「罪状」「証拠」「判決」の法廷風カードで表示
- 時系列で流れるタイムライン型UI

---

## 6. デモシナリオ（法廷ドラマ構成）

### 事件（起）

社員（AIエージェントのユーザー）が以下を指示:

> 「この人事評価ドラフトを、誰か第三者にレビュー依頼として送っておいて」

エージェントは「第三者」を推測し、**評価対象の本人のメールアドレス宛て**に送信しようとする。

### 審理（承・転）

MCP Arbiter Proxyがツール呼び出しを捕捉し、3段階処理をストリーミング可視化:

1. **Intent解析** — 「人事評価」「個人名一致」を検出、UIに流れる
2. **Policy評価** — サブエージェント（複数審理官）が合議、各意見がUIに流れる
3. **判決文生成** — 「罪状: 評価対象本人への機密情報送信」「証拠: 宛先と評価対象名の一致、評価文脈」「判決: DENY」

### 判決（結）

- エージェントには判決文付きでDENY応答
- ダッシュボードに法廷カードが流れる
- ツールは実行されず、事故は未然防止

### 対比演出

動画冒頭で「Arbiterなし」バージョンを見せ、実際に本人に誤送信される瞬間を提示 → 切り替えてArbiter導入版で事故防止を対比。

---

## 7. UI/UX 指針

### 7.1 デザイントーン

- **模擬裁判・憲法風**
- 「Arbiter = 裁定者」のメタファを徹底
- カラー: 濃紺・金・白（法廷・権威の象徴）

### 7.2 UI文言の法廷用語化

| 一般的UI文言 | Arbiter文言 |
|---|---|
| リクエスト | 申立て |
| ポリシー | 憲法・法令 |
| 違反内容 | 罪状 |
| 検知した要素 | 証拠 |
| 判定結果 | 判決 |
| 説明理由 | 判決文 |
| ログ | 判例集 |

### 7.3 画面構成

1. **ダッシュボード**: 判決のリアルタイムタイムライン（法廷カード）
2. **憲法編集**: ポリシーGUIエディタ
3. **判例集**: 過去判決の検索・詳細表示
4. **裁定記録**: Agent Serviceのサブエージェント発言ログ（Trace）

### 7.4 演出の深さ

アニメーション等の凝った演出は**行わない**。
UI文言レベルでメタファを貫徹することで、開発工数を抑えつつ印象を残す。

---

## 8. データモデル（Cosmos DB）

### `policies` コンテナ

```json
{
  "id": "policy-001",
  "name": "機密情報送信禁止",
  "description": "評価情報・個人情報の外部流出を防止",
  "type": "semantic_keyword",
  "criteria": {
    "sensitive_categories": ["人事評価", "給与", "パスワード"],
    "llm_judge_prompt": "..."
  },
  "action": "DENY",
  "createdAt": "2026-04-18T...",
  "enabled": true
}
```

### `verdicts` コンテナ

```json
{
  "id": "verdict-xyz",
  "timestamp": "2026-04-18T...",
  "agentId": "agent-demo",
  "intent": { /* Intent構造 */ },
  "policyRef": "policy-001",
  "decision": "DENY",
  "charge": "評価対象本人への機密情報送信",
  "evidence": ["宛先: tanaka@...", "評価対象: 田中"],
  "judgment": "本提案は...に違反するため棄却する",
  "traceId": "trace-abc",
  "subAgentOpinions": [ /* 各サブエージェントの意見 */ ]
}
```

---

## 9. 提出物

### 9.1 成果物URL
- Azure Static Web Apps で公開
- Entra ID認証（審査員用ゲストアカウント発行）
- ダッシュボード + デモトリガー機能を含む

### 9.2 Zennブログ記事
- アーキテクチャ図
- **デモ動画埋め込み（必須）**
- 実装上の工夫（ハイブリッド判定・Agent Service活用）
- プロンプトエンジニアリングの工夫（判決文生成）

### 9.3 デモ動画
- 構成: 事件発生 → 審理 → 判決 の起承転結
- 「Arbiterなし」vs「Arbiterあり」の対比は検討可
- 尺: 3分前後を想定（後工程で調整）

### 9.4 GitHubリポジトリ
- MITライセンスで公開
- README、アーキ図、セットアップ手順
- 6月18日までタグ保持

---

## 10. スコープ外（MVP除外）

- 要承認(Escalate)フロー
- 社外ドメイン制限・添付ファイル審査
- 複数ツール種別への横展開
- Webhook等の外部通知
- 監査証跡のエクスポート
- 本番運用向けパフォーマンス最適化
- ポリシーのバージョン管理・ロールバック
- マルチテナント対応

これらは発展フェーズで追加検討。

---

## 11. リスクと対応

| リスク | 対応 |
|---|---|
| Agent Serviceの学習コスト | 早期にHello World相当を動かす |
| Cosmos DB Serverless課金超過 | 開発中はローカルエミュレータ活用 |
| Entra ID設定の複雑性 | Static Web Apps組込認証から始める |
| MCPプロキシの規格追従 | 公式SDK優先、独自実装は最小限 |
| デモ動画の尺肥大 | 対比演出はオプション扱い、本編集中 |

---

## 12. 開発方針（ハイレベル）

- 週次でマイルストーンを切り、週末にE2E動作確認
- 「デモが回る」ことを毎週末の最低ラインに設定
- 機能追加より**判定の説得力**と**UI印象**に工数配分
- 必須要件・推奨技術の採用は早期に固定（後戻り回避）

---

## 13. コンセプトメッセージ（プレゼン用）

> エージェント時代において、「何ができるか」は既に十分だ。
>
> 問われているのは「何をさせてよいか」である。
>
> **MCP Arbiter** は、あらゆるエージェントとツールの間に立つ裁定者として、
> ツール実行の前に意図を読み、ポリシーに照らし、判決を下す。
>
> これは能力の制限ではない。**安全に拡張可能にするための基盤**である。

---

*本仕様書は24問のヒアリングで合意された設計判断に基づく。*
