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
