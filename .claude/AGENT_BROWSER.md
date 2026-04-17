# Agent Browser + Skills セットアップガイド

MCP Arbiter の Dashboard は法廷メタファ UI という強い世界観を持つため、UI レビューを Claude Code から直接行える環境を整えています。本書は agent-browser（Claude Preview / Claude in Chrome）と関連 Skills の導入・活用手順をまとめたものです。

---

## 1. agent-browser

MCP 経由で Claude Code にブラウザ操作能力を与えるサーバーは 2 種類あります。用途で使い分けます。

| サーバー | 用途 | 推奨シーン |
|---|---|---|
| **Claude Preview**（`Claude_Preview`） | 任意ポートの dev サーバーを内部ブラウザでプレビュー・スクリーンショット・DOM inspect | `pnpm --filter @arbiter/dashboard dev` 起動後の UI 確認、スナップショット取得 |
| **Claude in Chrome**（`Claude_in_Chrome`） | 実ブラウザ（Chrome）を操作。複数タブ、form 入力、ネットワーク取得 | Entra ID 認証など実ブラウザが必要なシナリオ、E2E 手動検証 |

### 1.1 インストール

リポジトリ直下の [.mcp.json](../.mcp.json) に両サーバーが宣言済み。クローン直後に Claude Code が起動を提案するので承認すれば有効になります。

手動で再プロビジョニングしたい場合:

```bash
claude mcp add --scope project Claude_Preview -- npx -y @anthropic-ai/claude-preview-mcp
claude mcp add --scope project Claude_in_Chrome -- npx -y @anthropic-ai/claude-chrome-mcp
```

Claude Preview は Node.js のみ、Claude in Chrome は Chrome 本体 + 拡張の連携が必要です。初回のみ Chrome 側で拡張を承認してください。

### 1.2 接続確認

`.mcp.json` が有効化されると、Claude Code から以下のツールが使えるようになります。

- `mcp__Claude_Preview__preview_start` — dev サーバーの URL を渡してプレビュー起動
- `mcp__Claude_Preview__preview_screenshot` — 現在のプレビューを PNG で取得
- `mcp__Claude_Preview__preview_click` / `preview_fill` — DOM 操作
- `mcp__Claude_in_Chrome__navigate` / `read_page` / `form_input` — 実 Chrome 操作

最小動作確認:

```text
/arbiter-demo   # ダッシュボード dev サーバー起動
```

したあと Claude Code に「dashboard をプレビューしてスクリーンショットを取って」と依頼するだけで、`preview_start` → `preview_screenshot` が連鎖実行されます。

### 1.3 ハッカソン審査での用途

- **デモ動画の素材収集** — 判決カードが流れる画面のスナップショットを複数シナリオで自動取得
- **UI 回帰の自動監視** — PR ごとにスクリーンショットを撮り、差分を目視レビュー
- **Entra ID 認証テスト** — Claude in Chrome で実際にログインフローを走らせる

---

## 2. Skills

本プロジェクトで有効化する Skills と用途を以下に整理します。

### 2.1 必須

#### `frontend-design`（Anthropic 公式）

法廷メタファ UI の品質向上・デザイン改善に活用。`docs/spec.md` §7 の UI/UX 指針（濃紺・金・白、判決カード）を反映した実装提案を生成します。

- 新しい画面コンポーネント（判例集、裁定記録など）を作るときに呼び出す
- 既存画面のレビューで「法廷メタファ語彙と見た目の整合」を点検
- 起動: `/frontend-design` または Claude Code へ「frontend-design スキルで …」と依頼

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
3. 出力画像を確認。違和感があれば /frontend-design でコンポーネント改善案を出す
4. /policy-test で関連ポリシーの ALLOW/DENY が想定通りかを再確認
```

### 3.2 デモ素材の量産

```
1. pnpm --filter @arbiter/harness run demo:scenarios  # 複数シナリオをバッチ起動
2. Claude in Chrome で各シナリオ終了後の Dashboard をスクリーンショット
3. 画像をデモ動画の絵コンテに貼り込む
```

### 3.3 UI 回帰チェック

```
1. 変更前の main ブランチで preview_screenshot
2. PR ブランチで同じページの preview_screenshot
3. 画像差分を目視。判決カードのレイアウト崩れや法廷メタファ語彙の抜けをチェック
```

---

## 4. トラブルシュート

- **MCP サーバーが認識されない** — `claude mcp list` で project スコープに Claude_Preview / Claude_in_Chrome が出ているか確認。出ていなければ `.mcp.json` 直接読込を許可したか確認（`.claude/settings.json` の `enableAllProjectMcpServers: true` または `enabledMcpjsonServers`）。
- **Claude in Chrome 拡張が反応しない** — Chrome を再起動。拡張の Developer Tools で MCP 接続エラーを確認。
- **preview_screenshot が真っ白** — dev サーバーの起動完了を待つ。Next.js の Hot Reload 中は `sleep 2` 後に再試行。

---

## 5. 参考

- Claude Code MCP 公式ドキュメント（Anthropic docs）
- [.mcp.json](../.mcp.json)
- [.claude/settings.json](settings.json) — MCP サーバー承認設定（`enabledMcpjsonServers`）
