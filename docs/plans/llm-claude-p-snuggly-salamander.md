# Plan: ローカル検証の LLM を `claude -p` に差し替える

## Context

現状、`ARBITER_MODE=local` のときの LLM バックエンドは [MockLLMAdapter](packages/core/src/adapters/llm-adapter.ts:14) のみで、ここは `recipients` が `@example.com` 以外かつ「評価/人事/個人情報/給与/confidential」キーワードに一致するかだけで allow/deny を返す単純なルールベース。開発者の手元では「本物の LLM 判定」が試せず、Policy/プロンプトの挙動検証が Azure Foundry へ繋ぐまで先送りされている。

開発者の PC にはすでに Claude Code CLI (`claude`) があり、`claude -p` によるヘッドレス呼び出しが可能。これを `LLMAdapter` 実装として差し込めば、Azure 依存ゼロのまま本物の LLM 判定でローカル E2E を回せる。ハッカソンのデモ調整・プロンプトチューニング・ポリシーテスト（[.claude/skills の policy-test](.claude/skills/policy-test)）の精度が一気に上がる。

**対象（ユーザー合意済み）**
- `LLMAdapter.judge()`（3 審理官の合議）と `LLMAdapter.compose()`（判決文生成）の両方を `claude -p` 化。
- `compose()` は現在 Decision Engine 側のテンプレート生成で実質未使用。今回 LLM 生成に切り替える。
- Harness は今回スコープ外（既存の MockLLMAdapter のまま）。
- `ARBITER_MODE=local` では既定で claude CLI を使い、明示的に `ARBITER_LLM_BACKEND=mock` を指定したときだけ MockLLMAdapter に戻せる。
- 3 審理官は `Promise.all` で並列化。
- CLI エラー・タイムアウト時は例外を投げる（/invoke は 500、E2E/Harness は即座に失敗）。

---

## 変更対象ファイル

### 新規
- [packages/core/src/adapters/claude-cli-llm-adapter.ts](packages/core/src/adapters/claude-cli-llm-adapter.ts) — `ClaudeCliLLMAdapter` 実装
- [packages/core/src/adapters/claude-cli-llm-adapter.test.ts](packages/core/src/adapters/claude-cli-llm-adapter.test.ts) — spawn をスタブしたユニットテスト

### 変更
- [packages/core/src/adapters/llm-adapter.ts](packages/core/src/adapters/llm-adapter.ts) — `MockLLMAdapter.compose()` を法廷風テンプレートに差し替え（後述）
- [packages/core/src/adapters/llm-factory.ts](packages/core/src/adapters/llm-factory.ts) — `ARBITER_LLM_BACKEND` 分岐追加
- [packages/core/src/adapters/index.ts](packages/core/src/adapters/index.ts) — 新 Adapter を export
- [packages/core/src/config.ts](packages/core/src/config.ts) — `llm.backend` / `llm.claudeCli` フィールドを追加
- [packages/proxy/src/server.ts](packages/proxy/src/server.ts) — `new MockLLMAdapter()` 直接生成を `createLLMAdapter(config)` に置き換え
- [packages/proxy/src/decision-engine.ts](packages/proxy/src/decision-engine.ts) — `composeJudgment` を async 化し `llm.compose()` 経由で生成
- [packages/proxy/src/decision-engine.test.ts](packages/proxy/src/decision-engine.test.ts) — 非同期化に伴うテスト調整
- [packages/proxy/src/arbitrate.ts](packages/proxy/src/arbitrate.ts) — Decision Engine が async になるのでパイプラインを調整（既に async ならシグネチャのみ）
- [packages/harness/src/runner.ts](packages/harness/src/runner.ts) — 明示的に MockLLMAdapter のまま（コメントで意図記述）
- [.env.example](.env.example) — `ARBITER_LLM_BACKEND` / `CLAUDE_CLI_PATH` / `CLAUDE_CLI_MODEL` / `CLAUDE_CLI_TIMEOUT_MS` を追記
- [CLAUDE.md](CLAUDE.md) §6.2 / §7.2 — ローカル LLM バックエンドの説明を追加

---

## 設計

### 1. `ClaudeCliLLMAdapter`

```ts
// packages/core/src/adapters/claude-cli-llm-adapter.ts
import { spawn } from 'node:child_process';

export interface ClaudeCliOptions {
  claudePath?: string;        // default: 'claude'
  model?: string;             // default: 'claude-sonnet-4-6'
  timeoutMs?: number;         // default: 30000
}

export class ClaudeCliLLMAdapter implements LLMAdapter {
  async judge(request: JudgeRequest): Promise<SubAgentOpinion> {
    const userPrompt = this.buildJudgeUserPrompt(request);
    const raw = await this.runClaude(request.systemPrompt, userPrompt);
    const parsed = this.parseJudgeResponse(raw); // { verdict, confidence, rationale }
    return {
      subAgentId: `claude-${request.role}`,
      role: request.role,
      verdict: parsed.verdict,
      confidence: parsed.confidence,
      rationale: parsed.rationale,
    };
  }

  async compose(prompt: string): Promise<string> {
    return this.runClaude(COMPOSE_SYSTEM_PROMPT, prompt);
  }

  private async runClaude(systemPrompt: string, userPrompt: string): Promise<string> {
    // spawn('claude', args) → stdout/stderr/exit を Promise 化、AbortController でタイムアウト
  }
}
```

**プロセス起動フラグ**（副作用最小化・ステートレス）
- `-p <userPrompt>` — プロンプトは引数で渡す（シェル経由せず `spawn` の args 配列に入れればインジェクション安全）
- `--system-prompt <systemPrompt>` — 役割を完全上書き（`--append-*` ではない）
- `--output-format json` — `{result, usage, ...}` 形式で受け取り、`result` を取り出す
- `--model ${model}`
- `--max-turns 1`
- `--disallowedTools Bash,Edit,Write,Read,Task,Glob,Grep,WebFetch,WebSearch,NotebookEdit` — 審理官にローカル操作させない
- `--setting-sources ""` — プロジェクト/ユーザー settings.json や CLAUDE.md / skills / hooks / MCP を読み込まない（claude-code-guide 調査結果。実装時に `claude --help` で最終確認する — フラグ名が違う場合は `--strict-mcp-config` + 空 MCP config + `HOME` override などで代替）

> **注**: claude-code-guide の返答には `--bare` / `--json-schema` など未確認のフラグが含まれていた。実装時に **`claude --help` と [公式 CLI リファレンス](https://docs.claude.com/en/docs/claude-code/cli-reference)** で 1 つずつ裏取りし、存在するものだけ使う。存在しないフラグは環境変数や `cwd`・`env` 隔離で代替（例: `cwd: os.tmpdir()`, `env: { HOME: ..., PATH: ... }` のみ継承）。

**プロンプト構造（JSON 構造化はプロンプト工夫で行う）**

`judge()` の userPrompt:
```
以下の Intent を評価し、JSON で回答せよ。JSON 以外の文字を出力するな。

Intent:
{ "tool": "...", "parameters": {...}, "context": {...} }

回答スキーマ:
{
  "verdict": "allow" | "deny" | "abstain",
  "confidence": 0.0〜1.0 の数値,
  "rationale": "日本語1〜2文の根拠"
}
```

parser は `raw.trim()` → 先頭末尾の ```json フェンスを剥がす → `JSON.parse` → `verdict` が enum のいずれか・`confidence` が 0-1 の数値であることを検証。壊れたら `Error` を throw（合議側で Promise.all が reject、/invoke は 500）。

`compose()` の systemPrompt は Decision Engine 側から渡す（法廷書記官ロール + フォーマット指示）。

### 2. `createLLMAdapter` の分岐

```ts
// packages/core/src/adapters/llm-factory.ts
export const createLLMAdapter = (config, options = {}) => {
  if (config.mode === 'cloud') { /* 既存の Azure Foundry */ }

  // local mode
  const backend = config.llm.backend ?? 'claude-cli'; // ← 既定を claude-cli に
  if (backend === 'mock') return new MockLLMAdapter();
  if (backend === 'claude-cli') return new ClaudeCliLLMAdapter(config.llm.claudeCli);
  throw new Error(`unknown ARBITER_LLM_BACKEND: ${backend}`);
};
```

`ArbiterConfig.llm` に `backend: 'mock' | 'claude-cli'` と `claudeCli: { claudePath, model, timeoutMs }` を追加。`loadConfig` で `ARBITER_LLM_BACKEND` / `CLAUDE_CLI_PATH` / `CLAUDE_CLI_MODEL` / `CLAUDE_CLI_TIMEOUT_MS` から読む。

### 3. Proxy `server.ts`

```ts
// 現状: new LLMConsensusEngine(new MockLLMAdapter())
const llm = createLLMAdapter(config);
const pipeline = buildPipeline({
  analyzer: new RuleBasedIntentAnalyzer(),
  policySource: new StoragePolicySource(storage),
  consensus: new LLMConsensusEngine(llm),
  decision: new DefaultDecisionEngine({ llm }), // ← compose 用に注入
});
```

### 4. `LLMConsensusEngine` の並列化

[packages/proxy/src/llm-consensus.ts:45-52](packages/proxy/src/llm-consensus.ts) の for ループを:

```ts
const opinions = await Promise.all(
  profiles.map((profile) =>
    this.llm.judge({ intent, role: profile.role, systemPrompt: profile.systemPrompt }),
  ),
);
```

一人でも reject したら全体 reject。この挙動で OK（ユーザー合意: エラー時は例外）。

### 5. Decision Engine の `compose()` 化

[packages/proxy/src/decision-engine.ts:36-71](packages/proxy/src/decision-engine.ts) の `composeJudgment` を変更:

- Decision Engine 構築時に `llm: LLMAdapter` を受け取る。
- 現在のテンプレート文字列は **compose 用プロンプト**に変換し、`llm.compose(prompt)` の結果を `judgment` として返す。
- `composeJudgment` を `async` に。Engine の呼び出し側（[packages/proxy/src/arbitrate.ts](packages/proxy/src/arbitrate.ts)）は既に async なので影響軽微。

プロンプトは既存テンプレートの構造（主文 / 罪状 / 事案 / 審理官意見 / 結論）を system prompt に規定し、user prompt に Intent・ruleMatches・opinions・decision を渡す。

**MockLLMAdapter.compose() の互換性**: 既存テストが `verdict.judgment` に「棄却」「許可」が含まれることをアサート [packages/proxy/src/decision-engine.test.ts:55-85](packages/proxy/src/decision-engine.test.ts) しているので、Mock の compose を現在のテンプレート実装に差し替える（つまり旧 `composeJudgment` のロジックを Mock 側に移設）。これにより「Mock=テンプレート、Claude CLI=LLM 生成」の二系統が自然に両立する。

### 6. Harness

[packages/harness/src/runner.ts:98](packages/harness/src/runner.ts) は `new MockLLMAdapter()` をそのまま維持。コメントで「harness は再現性のため常に Mock を使う」と明記。将来 `--llm=claude-cli` オプションで切替可能にする余地だけ残す。

### 7. 環境変数 & ドキュメント

`.env.example` 追加:
```
# --- LLM backend (local モードのみ) ---
# 既定: claude-cli（Claude Code CLI が必要）。mock にすると MockLLMAdapter に戻る
ARBITER_LLM_BACKEND=claude-cli
CLAUDE_CLI_PATH=claude
CLAUDE_CLI_MODEL=claude-sonnet-4-6
CLAUDE_CLI_TIMEOUT_MS=30000
```

CLAUDE.md §6.2「ARBITER_MODE 切替」の直後に新セクション（§6.2.1 程度）を追加し、「local モードでは claude CLI が必須。未インストール時は `ARBITER_LLM_BACKEND=mock` でフォールバック」を明記。§7.2 の環境変数表にも上記 4 変数を追加。

---

## 実装順序

1. `ClaudeCliLLMAdapter` 実装 + `spawn` をモックしたユニットテスト（stdout を差し替えて JSON パース経路を検証）
2. `config.ts` / `llm-factory.ts` / `index.ts` 更新
3. Proxy `server.ts` を Factory 経由に変更
4. `LLMConsensusEngine` を並列化
5. `DefaultDecisionEngine` の `compose()` 化 + `MockLLMAdapter.compose()` のテンプレ移設
6. 関連テスト修正
7. `.env.example` / `CLAUDE.md` 更新
8. 実機での検証（下記）

---

## 検証

**方針**: 各実装ステップの直後に agent-browser で Dashboard を開き、判決カード（verdict / charge / judgment / 審理官意見）の表示を目視確認する。判決文を LLM 生成化するため、テンプレートでは崩れない「法廷メタファ語彙（罪状・判決文・主文・事案）」の保持を UI で都度チェックするのが本変更の最大の回帰リスク。

### 事前準備
```bash
# CLI 疎通（フラグ名の裏取り）
claude --help | grep -E "output-format|system-prompt|disallowedTools|setting-sources"
claude -p --system-prompt "返事は ok だけ" --output-format json "hi" | jq .

# agent-browser が入っているか
agent-browser --version || npm i -g agent-browser && agent-browser install
```

### 段階 1: 単体・統合テスト（コード変更の都度）
```bash
pnpm -w typecheck
pnpm -w test          # 既存テストが通る（Mock 経路）
pnpm -w check         # Biome
```

### 段階 2: Mock 経路で Dashboard 回帰確認（Adapter 実装前に一度）
`compose()` 切替により判決文生成経路が変わるため、**まず MockLLMAdapter 経路で** Dashboard が壊れていないことを押さえる。

```bash
ARBITER_LLM_BACKEND=mock /arbiter-demo    # Proxy + Dashboard + Client Agent 一括起動
```

agent-browser で確認:
```text
agent-browser open http://localhost:3000
agent-browser wait --text "判例集"       # ロード完了待ち
agent-browser snapshot                    # UI 構造を取得
agent-browser screenshot tmp/phase2-mock.png --full
```

- 3 シナリオ（hr-eval-misdirect=deny / daily-standup=allow / credentials-leak=deny）の判決カードが表示されているか
- 判決文に「主文 / 罪状 / 事案 / 審理官意見」が含まれているか
- 崩れていたら `MockLLMAdapter.compose()` のテンプレ移設を修正してから次に進む

### 段階 3: claude-cli 経路で Dashboard 確認
```bash
ARBITER_LLM_BACKEND=claude-cli /arbiter-demo
```

agent-browser で確認:
```text
agent-browser open http://localhost:3000
agent-browser wait --text "判例集"
agent-browser screenshot tmp/phase3-claude-cli.png --full
agent-browser find role article --name-contains "hr-eval" snapshot  # 該当カードの本文
```

- 同じ 3 シナリオで決定が一致するか（allow/deny）
- 判決文が **LLM 生成** になっていること（毎回わずかに文面が変わる / Mock のテンプレより自然な日本語）
- 法廷メタファ語彙（罪状・判決文・審理官）が維持されているか
- SignalR 経由の realtime 更新が崩れていないか

崩れていたら Decision Engine の compose 用 system prompt を調整 → 段階 3 を再実行。

### 段階 4: E2E スクリプトでの決定一致
```bash
pnpm dev:up
ARBITER_LLM_BACKEND=claude-cli pnpm e2e:local
# → hr-eval-misdirect=deny / daily-standup=allow / credentials-leak=deny で PASS
```

e2e:local が通らない場合、プロンプトの allow/deny 判断指示が弱い可能性。judge の system prompt を強化して再実行。

### 段階 5: フォールバック確認
```bash
ARBITER_LLM_BACKEND=mock pnpm e2e:local   # Mock 経路でも引き続き 3/3 pass
```

### 段階 6: エラー経路
- `CLAUDE_CLI_PATH=/bin/false` にして /invoke を叩き、500 + 明示的なエラーメッセージが返ること。agent-browser で Dashboard 側にもエラー状態が表示されるか確認。
- `CLAUDE_CLI_TIMEOUT_MS=100` にして、タイムアウト時にプロセスが kill され例外になること。

### 段階 7: デモ素材として screenshot 保存
段階 3 の `tmp/phase3-claude-cli.png` を PR に添付し、Mock との差分が視覚的にわかるようにする。

---

## 不確実性・要調査事項

1. **`claude` CLI のフラグ名**: claude-code-guide の返答には推測が混在。実装開始時に `claude --help` / 公式 docs で `--setting-sources` / `--disallowedTools` の正確なスペル・有無を確認し、存在しないものは `env`/`cwd` 隔離で代替する。
2. **`--output-format json` の出力スキーマ**: `result` フィールドが期待どおり文字列で返るか実機確認。場合によってはストリーム/イベント形式のため stream-json + 最終 event 抽出にする。
3. **レート制限**: 3 プロセス並列で Anthropic 側のレート制限に当たる可能性。当たったら 429 扱いで例外にする（今回は例外方針で OK）。
4. **CLAUDE.md の継承防止**: サブプロセスで親プロジェクトの CLAUDE.md を読まない方法の正解が要検証。`cwd: os.tmpdir()` で切れる可能性が高いが、user 設定は別パス。`--setting-sources ""` が実在しない場合は `HOME=<temp>` で対応。

これらは実装時に `claude --help` 1 回で確定するので、プラン承認後の最初のステップとして実施する。
