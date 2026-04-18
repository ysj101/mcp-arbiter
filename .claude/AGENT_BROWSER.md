# agent-browser + Skills セットアップガイド

MCP Arbiter の Dashboard は法廷メタファ UI という強い世界観を持つため、UI レビューを Claude Code から直接行える環境を整えています。本書は **agent-browser**（Vercel Labs 製のブラウザ自動化 CLI / Skill）と関連 Skills の導入・活用手順をまとめたものです。

- 正本: https://github.com/vercel-labs/agent-browser
- Skill 定義: https://github.com/vercel-labs/agent-browser/blob/main/skills/agent-browser/SKILL.md

---

## 1. agent-browser とは

Vercel Labs が公開している **AI エージェント向けのブラウザ自動化 CLI** です。Node.js ラッパーではなく Rust 製ネイティブバイナリで、Chrome / Chromium を CDP 経由で直接操作します。

| 特徴 | 内容 |
|---|---|
| 実装 | Rust 製ネイティブ CLI（Playwright / Puppeteer 非依存） |
| ブラウザ | Chrome for Testing を `agent-browser install` で取得。既存 Chrome / Brave / Playwright 検出可 |
| 操作モデル | アクセシビリティツリースナップショット + `@eN` 形式の要素参照 |
| 連携先 | Claude Code / Cursor / Codex / Continue / Windsurf 等の任意エージェント |
| 付加機能 | セッション管理、認証 vault、状態永続化、動画記録、Electron アプリ対応 |

> **注意**: agent-browser は **MCP サーバーではなく Skill + CLI** です。`.mcp.json` への登録は不要で、Claude Code からは Skill（`/agent-browser` あるいは自然文トリガー）経由で呼び出します。

### 1.1 インストール

**Skill 本体はリポジトリに commit 済み**: [.claude/skills/agent-browser/SKILL.md](skills/agent-browser/SKILL.md) が vercel-labs/agent-browser からミラーしたものです。クローン直後に Claude Code が自動検出するので、個別セットアップは不要です（更新方針とライセンス表記は [.claude/skills/agent-browser/NOTICE.md](skills/agent-browser/NOTICE.md) 参照）。

Skill を使うには **agent-browser CLI 本体のインストールが別途必要** です。

```bash
# 推奨: グローバル導入（npm）
npm install -g agent-browser
agent-browser install                 # Chrome for Testing を取得（初回のみ）

# macOS Homebrew
brew install agent-browser
agent-browser install

# Linux では依存ライブラリも入れる
agent-browser install --with-deps

# 最新化
agent-browser upgrade
```

Claude Code は起動時にリポジトリ内の Skill（`.claude/skills/agent-browser/`）を自動検出します。CLI 本体を入れた後、初回セッションで `agent-browser skills get core` を叩くと最新の使い方・ワークフロー・テンプレートが CLI から取得できます（SKILL.md は意図的に薄い discovery stub。実運用ガイドは CLI 側が常に最新を返す）。

### 1.2 疎通確認

```bash
agent-browser open https://example.com
agent-browser snapshot                # アクセシビリティツリー + @eN を取得
agent-browser screenshot /tmp/page.png
agent-browser close
```

Claude Code からは以下のように依頼するだけで Skill が起動します。

```text
agent-browser で http://localhost:3000 を開いてスクリーンショットを取って
```

最小動作確認フロー:

```text
/arbiter-demo --no-docker             # dashboard dev サーバーだけ起動
→ Claude Code に「dashboard をプレビューしてスクリーンショットを取って」
```

### 1.3 よく使うコマンド

詳細は `agent-browser --help` および `agent-browser skills get core --full` 参照。代表例のみ抜粋。

```bash
agent-browser open <url>              # ページを開く（navigate / goto alias）
agent-browser snapshot                # AI 向けアクセシビリティツリー（@eN 参照付き）
agent-browser click @e2               # @eN による確実なクリック
agent-browser fill @e3 "test@example.com"
agent-browser find role button click --name "Submit"   # セマンティックロケータ
agent-browser screenshot [path]       # スクリーンショット（--full / --annotate）
agent-browser wait --text "Welcome"   # テキスト / URL / 条件で待機
agent-browser batch "open ..." "snapshot -i" "screenshot"   # 複数コマンド一括
agent-browser chat "<instruction>"    # 自然文で連続操作
```

### 1.4 専用 Skill（必要に応じて取得）

```bash
agent-browser skills list                      # 利用可能 Skill 一覧
agent-browser skills get electron              # Electron デスクトップアプリ
agent-browser skills get slack                 # Slack ワークスペース自動化
agent-browser skills get dogfood               # 探索的テスト / バグハント
agent-browser skills get vercel-sandbox        # Vercel Sandbox microVM 上での実行
agent-browser skills get agentcore             # AWS Bedrock AgentCore クラウドブラウザ
```

### 1.5 ハッカソン審査での用途

- **デモ動画の素材収集** — 判決カードが流れる画面のスナップショットを複数シナリオで自動取得
- **UI 回帰の自動監視** — PR ごとにスクリーンショットを撮り、差分を目視レビュー
- **Entra ID 認証テスト** — 実ブラウザセッション + 認証 vault でログインフローを走らせる

---

## 2. Skills

本プロジェクトで有効化する Skills と用途を以下に整理します。

### 2.1 必須

#### `frontend-design`（Anthropic 公式）

法廷メタファ UI の品質向上・デザイン改善に活用。`docs/spec.md` §7 の UI/UX 指針（濃紺・金・白、判決カード）を反映した実装提案を生成します。

- 新しい画面コンポーネント（判例集、裁定記録など）を作るときに呼び出す
- 既存画面のレビューで「法廷メタファ語彙と見た目の整合」を点検
- 起動: `/frontend-design` または Claude Code へ「frontend-design スキルで …」と依頼

#### `agent-browser`（Vercel Labs）

§1 を参照。UI のプレビュー / スクリーンショット / E2E 操作を Claude Code から直接行うために常用します。

### 2.2 推奨

#### `simplify`

変更コードを読み、重複 / 未使用 / 過度な抽象を指摘して修正を提案。Biome / tsc で検知できない構造的冗長をカバーします。PR を出す前に通す運用を推奨。

#### `skill-creator`

プロジェクト固有の skill を作る際のひな形生成。たとえば以下を検討中:

- `arbiter-policy-writer` — 自然文要件から policy YAML を生成
- `arbiter-demo-narrator` — 判決ログからデモ動画のナレーション台本を生成

### 2.3 参考（採否保留）

| skill | 用途 | 採否 |
|---|---|---|
| `claude-api` | Anthropic SDK コード改善 | ハッカソンでは直接使わないので **保留** |
| `docx` / `pptx` / `xlsx` / `pdf` | 資料作成 | 提出 Zenn 記事には不要。**保留** |
| `security-review` | セキュリティレビュー | 判定ロジック周りで有用。**M2 以降で導入** |
| `consolidate-memory` | 自動メモリの整理 | 個人用途。**プロジェクトに commit しない** |

---

## 3. 活用パターン（日常開発）

### 3.1 Dashboard 変更 PR のセルフレビュー

```
1. /arbiter-demo --no-docker          # dashboard だけ起動
2. Claude Code に「dashboard を開いて判例集ページのスクリーンショットを取って」
   → agent-browser open → snapshot → screenshot が連鎖
3. 画像に違和感があれば /frontend-design でコンポーネント改善案を出す
4. /policy-test で関連ポリシーの ALLOW/DENY が想定通りかを再確認
```

### 3.2 デモ素材の量産

```
1. pnpm --filter @arbiter/harness run demo:scenarios   # 複数シナリオをバッチ起動
2. agent-browser batch で各シナリオの Dashboard を連続スクショ
3. 画像をデモ動画の絵コンテに貼り込む
```

### 3.3 UI 回帰チェック

```
1. 変更前の main ブランチで agent-browser screenshot
2. PR ブランチで同じページを screenshot
3. 画像差分を目視。判決カードのレイアウト崩れや法廷メタファ語彙の抜けをチェック
```

---

## 4. トラブルシュート

- **`agent-browser` コマンドが見つからない** — `npm i -g agent-browser` が通っているか、`which agent-browser` で確認。Homebrew / Cargo 経由の場合は PATH を確認。
- **Chrome が起動しない** — 初回は `agent-browser install` が必要。Linux では `--with-deps`。既存 Chrome を使いたい場合は `agent-browser connect <port>`。
- **スナップショットが真っ白 / 要素が取れない** — dev サーバーの起動完了を待つ。`agent-browser wait --load networkidle` か `wait --text "…"` を挟む。
- **Skill 内容が古い** — `agent-browser upgrade` で本体を更新し、`agent-browser skills get core` を再取得。Skill 本体は CLI バージョンに追従する。

---

## 5. 参考

- Vercel Labs agent-browser: https://github.com/vercel-labs/agent-browser
- SKILL 定義: https://github.com/vercel-labs/agent-browser/blob/main/skills/agent-browser/SKILL.md
- Claude Code Skills ドキュメント（Anthropic docs）
- [.mcp.json](../.mcp.json) — 追加の MCP サーバーが必要になったときだけ宣言
- [.claude/settings.json](settings.json) — MCP サーバー承認設定（`enabledMcpjsonServers`）
