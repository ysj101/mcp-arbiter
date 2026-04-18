import type { Intent, SubAgentOpinion } from '@arbiter/shared-types';

export interface JudgeRequest {
  intent: Intent;
  role: string;
  systemPrompt: string;
}

export interface LLMAdapter {
  judge(request: JudgeRequest): Promise<SubAgentOpinion>;
  compose(prompt: string): Promise<string>;
}

const MOCK_COMPOSE_TAG = 'ARBITER_COMPOSE_JSON_V1';

interface MockComposePayload {
  decision: 'allow' | 'deny';
  agentId: string;
  tool: string;
  recipients: string;
  ruleMatches: { policyName: string; excerpt: string }[];
  opinions: SubAgentOpinion[];
  charge: string;
}

const renderMockTemplate = (payload: MockComposePayload): string => {
  const { decision, agentId, tool, recipients, ruleMatches, opinions, charge } = payload;
  if (decision === 'deny') {
    const evidencePart =
      ruleMatches.length > 0
        ? `証拠として「${ruleMatches[0]?.excerpt ?? ''}」が検出された。`
        : '審理官の合議によりこの所作に疑義が示された。';
    const opinionsPart = opinions
      .filter((o) => o.verdict === 'deny')
      .map((o) => `・${o.role}: ${o.rationale}`)
      .join('\n');
    return [
      `主文: 本法廷は、エージェント ${agentId} による tool=${tool} の執行を棄却する。`,
      `罪状: ${charge}`,
      `事案: 宛先 ${recipients} に対する要求は本憲法第 1 条の禁を冒すものである。${evidencePart}`,
      `審理官意見:\n${opinionsPart || '・（意見なし）'}`,
      '以上の理由により、本件ツール実行は許可されない。',
    ].join('\n');
  }
  const opinionsPart = opinions.map((o) => `・${o.role}: ${o.rationale}`).join('\n');
  return [
    `主文: 本法廷は、エージェント ${agentId} による tool=${tool} の執行を許可する。`,
    `事案: 宛先 ${recipients} への要求は本憲法の禁止事項に抵触しない。`,
    `審理官意見:\n${opinionsPart || '・（意見なし）'}`,
    '以上の理由により、本件ツール実行は妨げられない。',
  ].join('\n');
};

export class MockLLMAdapter implements LLMAdapter {
  async judge(request: JudgeRequest): Promise<SubAgentOpinion> {
    const { intent, role } = request;
    const recipients = intent.extractedContext.recipients ?? [];
    const external = recipients.some((r) => !r.endsWith('@example.com'));
    const isSensitive = JSON.stringify(intent.parameters).match(
      /評価|人事|個人情報|給与|confidential/i,
    );

    const deny = external && Boolean(isSensitive);

    return {
      subAgentId: `mock-${role}`,
      role,
      verdict: deny ? 'deny' : 'allow',
      confidence: deny ? 0.92 : 0.78,
      rationale: deny
        ? `${role} の立場では、社外宛先への機密情報送信を許容できない。`
        : `${role} の立場では、明確な違反は見当たらない。`,
    };
  }

  async compose(prompt: string): Promise<string> {
    const tagPrefix = `${MOCK_COMPOSE_TAG}\n`;
    if (prompt.startsWith(tagPrefix)) {
      try {
        const payload = JSON.parse(prompt.slice(tagPrefix.length)) as MockComposePayload;
        return renderMockTemplate(payload);
      } catch {
        // fall through to default response
      }
    }
    return `Mock response for: ${prompt.slice(0, 60)}`;
  }
}

export interface AzureFoundryAgentOptions {
  endpoint: string;
  apiKey: string;
  deployment: string;
  callAgent: (request: {
    systemPrompt: string;
    userPrompt: string;
  }) => Promise<{ verdict: 'allow' | 'deny' | 'abstain'; confidence: number; rationale: string }>;
}

export class AzureFoundryAgentLLMAdapter implements LLMAdapter {
  constructor(private readonly options: AzureFoundryAgentOptions) {}

  async judge(request: JudgeRequest): Promise<SubAgentOpinion> {
    const userPrompt = JSON.stringify({
      tool: request.intent.tool,
      parameters: request.intent.parameters,
      context: request.intent.extractedContext,
    });
    const result = await this.options.callAgent({
      systemPrompt: request.systemPrompt,
      userPrompt,
    });
    return {
      subAgentId: `foundry-${request.role}`,
      role: request.role,
      verdict: result.verdict,
      confidence: result.confidence,
      rationale: result.rationale,
    };
  }

  async compose(prompt: string): Promise<string> {
    const result = await this.options.callAgent({
      systemPrompt: 'あなたは判決文を生成する法廷書記官です。',
      userPrompt: prompt,
    });
    return result.rationale;
  }
}
