import { type ChildProcess, spawn as defaultSpawn, type SpawnOptions } from 'node:child_process';
import { tmpdir } from 'node:os';
import type { Intent, SubAgentOpinion } from '@arbiter/shared-types';
import type { JudgeRequest, LLMAdapter } from './llm-adapter.js';

export interface ClaudeCliOptions {
  claudePath?: string;
  model?: string;
  timeoutMs?: number;
  spawn?: (command: string, args: readonly string[], options: SpawnOptions) => ChildProcess;
  env?: NodeJS.ProcessEnv;
}

interface ClaudeCliResult {
  type: 'result';
  subtype: 'success' | string;
  is_error: boolean;
  result: string;
  structured_output?: unknown;
  [key: string]: unknown;
}

const JUDGE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    verdict: { enum: ['allow', 'deny', 'abstain'] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    rationale: { type: 'string' },
  },
  required: ['verdict', 'confidence', 'rationale'],
} as const;

const JUDGE_INSTRUCTION = [
  '以下の Intent を審理し、JSON で回答してください。',
  '出力スキーマに厳密に従い、他の文字は含めないこと。',
  '',
  'verdict: "allow" / "deny" / "abstain" のいずれか',
  'confidence: 0.0 〜 1.0 の自信度',
  'rationale: 日本語 1〜2 文で簡潔に根拠を述べる',
].join('\n');

const COMPOSE_SYSTEM_PROMPT = [
  'あなたは MCP Arbiter の法廷書記官です。',
  'ユーザー入力の先頭行は "ARBITER_COMPOSE_JSON_V1" のタグで、2 行目以降に JSON が入っています。',
  'JSON のフィールド: decision (allow|deny), agentId, tool, recipients, ruleMatches[], opinions[], charge。',
  '',
  'この JSON を元に、日本語の法廷判決文を次の構造で出力してください（ラベル含めて厳守）:',
  '',
  '主文: <ALLOW なら「本法廷は、エージェント <agentId> による tool=<tool> の執行を許可する。」／ DENY なら「...を棄却する。」>',
  '罪状: <DENY のとき charge を記述、ALLOW のときはこの行自体を省略>',
  '事案: <recipients や ruleMatches を踏まえ、1〜2 文で簡潔に>',
  '審理官意見:',
  '・<role>: <rationale>  （DENY の場合は verdict==deny の意見のみ、ALLOW の場合は全意見）',
  '以上の理由により、本件ツール実行は<許可される|許可されない>。',
  '',
  '装飾・挨拶・前置きは禁止。必ず「主文:」から始めること。',
  'JSON 内の文字列はそのまま使い、創作・脚色しないこと。',
].join('\n');

export class ClaudeCliLLMAdapter implements LLMAdapter {
  private readonly claudePath: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly spawnImpl: NonNullable<ClaudeCliOptions['spawn']>;
  private readonly env: NodeJS.ProcessEnv;

  constructor(options: ClaudeCliOptions = {}) {
    this.claudePath = options.claudePath ?? 'claude';
    this.model = options.model ?? 'claude-sonnet-4-6';
    this.timeoutMs = options.timeoutMs ?? 60_000;
    this.spawnImpl = options.spawn ?? defaultSpawn;
    this.env = options.env ?? process.env;
  }

  async judge(request: JudgeRequest): Promise<SubAgentOpinion> {
    const userPrompt = this.buildJudgeUserPrompt(request.intent);
    const parsed = await this.runClaudeStructured(request.systemPrompt, userPrompt, JUDGE_SCHEMA);
    const verdict = parsed.verdict;
    if (verdict !== 'allow' && verdict !== 'deny' && verdict !== 'abstain') {
      throw new Error(`claude -p returned invalid verdict: ${String(verdict)}`);
    }
    const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0;
    const rationale = typeof parsed.rationale === 'string' ? parsed.rationale : '';
    return {
      subAgentId: `claude-${request.role}`,
      role: request.role,
      verdict,
      confidence,
      rationale,
    };
  }

  async compose(prompt: string): Promise<string> {
    const result = await this.runClaudeText(COMPOSE_SYSTEM_PROMPT, prompt);
    return result.trim();
  }

  private buildJudgeUserPrompt(intent: Intent): string {
    const payload = {
      tool: intent.tool,
      parameters: intent.parameters,
      context: intent.extractedContext,
    };
    return `${JUDGE_INSTRUCTION}\n\nIntent:\n${JSON.stringify(payload, null, 2)}`;
  }

  private async runClaudeStructured(
    systemPrompt: string,
    userPrompt: string,
    schema: unknown,
  ): Promise<Record<string, unknown>> {
    const args = [
      ...this.baseArgs(),
      '--json-schema',
      JSON.stringify(schema),
      '-p',
      userPrompt,
      '--system-prompt',
      systemPrompt,
    ];
    const payload = await this.runClaude(args);
    if (payload.is_error) {
      throw new Error(`claude -p returned error: ${payload.result ?? 'unknown'}`);
    }
    const structured = payload.structured_output;
    if (!structured || typeof structured !== 'object') {
      throw new Error('claude -p did not return structured_output');
    }
    return structured as Record<string, unknown>;
  }

  private async runClaudeText(systemPrompt: string, userPrompt: string): Promise<string> {
    const args = [...this.baseArgs(), '-p', userPrompt, '--system-prompt', systemPrompt];
    const payload = await this.runClaude(args);
    if (payload.is_error) {
      throw new Error(`claude -p returned error: ${payload.result ?? 'unknown'}`);
    }
    if (typeof payload.result !== 'string') {
      throw new Error('claude -p did not return text result');
    }
    return payload.result;
  }

  private baseArgs(): string[] {
    return [
      '--output-format',
      'json',
      '--model',
      this.model,
      '--tools',
      '',
      '--no-session-persistence',
      '--setting-sources',
      'user',
      '--strict-mcp-config',
      '--mcp-config',
      '{"mcpServers":{}}',
    ];
  }

  private runClaude(args: readonly string[]): Promise<ClaudeCliResult> {
    return new Promise((resolve, reject) => {
      const child = this.spawnImpl(this.claudePath, args, {
        cwd: tmpdir(),
        env: this.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      let settled = false;

      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill('SIGKILL');
        reject(new Error(`claude -p timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      child.stdout?.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
      child.stderr?.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

      child.on('error', (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(new Error(`failed to spawn ${this.claudePath}: ${err.message}`));
      });

      child.on('close', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        const stdout = Buffer.concat(stdoutChunks).toString('utf8');
        const stderr = Buffer.concat(stderrChunks).toString('utf8');
        if (code !== 0) {
          reject(
            new Error(
              `claude -p exited with code ${code}: ${stderr.trim() || stdout.trim() || '(no output)'}`,
            ),
          );
          return;
        }
        try {
          const parsed = JSON.parse(stdout) as ClaudeCliResult;
          resolve(parsed);
        } catch (err) {
          reject(
            new Error(
              `failed to parse claude -p JSON output: ${err instanceof Error ? err.message : err}\nstdout: ${stdout.slice(0, 500)}`,
            ),
          );
        }
      });
    });
  }
}
