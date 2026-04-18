import type { AgentIdentity, Intent, Verdict } from '@arbiter/shared-types';

export interface ArbitrateInput {
  identity: AgentIdentity;
  tool: string;
  parameters: Readonly<Record<string, unknown>>;
  traceId?: string;
}

export interface ArbitrateResult {
  intent: Intent;
  verdict: Verdict;
}

export type ArbiterPipeline = (input: ArbitrateInput) => Promise<ArbitrateResult>;

/**
 * Skeleton pipeline that always ALLOWs. Full pipeline is wired in #5-#8.
 */
export const createSkeletonPipeline = (): ArbiterPipeline => {
  return async ({ identity, tool, parameters, traceId }) => {
    const now = new Date().toISOString();
    const intentId = `intent-${now}-${Math.random().toString(36).slice(2, 10)}`;
    const verdictId = `verdict-${now}-${Math.random().toString(36).slice(2, 10)}`;

    const intent: Intent = {
      intentId,
      agentId: identity.agentId,
      tool,
      parameters,
      extractedContext: {},
      createdAt: now,
      ...(traceId ? { traceId } : {}),
    };

    const verdict: Verdict = {
      verdictId,
      intentId,
      agentId: identity.agentId,
      decision: 'allow',
      evidence: [],
      judgment: '透過プロキシ (判定ロジック未実装)。',
      confidence: 1,
      subAgentOpinions: [],
      ...(traceId ? { traceId } : {}),
      createdAt: now,
    };

    return { intent, verdict };
  };
};
