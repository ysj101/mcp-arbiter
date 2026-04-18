import type { AgentIdentity, Intent, Verdict } from '@arbiter/shared-types';
import { type DecisionEngine, DefaultDecisionEngine } from './decision-engine.js';
import { type IntentAnalyzer, RuleBasedIntentAnalyzer } from './intent-analyzer.js';
import type { LLMConsensusEngine } from './llm-consensus.js';
import type { PolicySource } from './policy-source.js';
import { evaluateRules } from './rule-filter.js';

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

export interface BuildPipelineDeps {
  analyzer: IntentAnalyzer;
  policySource: PolicySource;
  consensus: LLMConsensusEngine;
  decision: DecisionEngine;
}

export const buildPipeline = (deps: BuildPipelineDeps): ArbiterPipeline => {
  return async ({ identity, tool, parameters, traceId }) => {
    const intent = await deps.analyzer.analyze({
      agentId: identity.agentId,
      tool,
      parameters,
      ...(traceId ? { traceId } : {}),
    });

    const policies = await deps.policySource.list();
    const ruleResult = evaluateRules(intent, policies);

    if (ruleResult.decision === 'deny') {
      const verdict = deps.decision.decide({
        intent,
        ruleMatches: ruleResult.matches,
        opinions: [],
        llmDecision: 'deny',
        llmConfidence: 0.95,
      });
      return { intent, verdict };
    }

    const consensus = await deps.consensus.deliberate(intent);
    const verdict = deps.decision.decide({
      intent,
      ruleMatches: [],
      opinions: consensus.opinions,
      llmDecision: consensus.decision,
      llmConfidence: consensus.confidence,
    });
    return { intent, verdict };
  };
};

/**
 * Skeleton pipeline that always ALLOWs. Used before Intent/Policy/Decision are wired.
 */
export const createSkeletonPipeline = (): ArbiterPipeline => {
  const analyzer = new RuleBasedIntentAnalyzer();
  const decision = new DefaultDecisionEngine();
  return async ({ identity, tool, parameters, traceId }) => {
    const intent = await analyzer.analyze({
      agentId: identity.agentId,
      tool,
      parameters,
      ...(traceId ? { traceId } : {}),
    });
    const verdict = decision.decide({
      intent,
      ruleMatches: [],
      opinions: [],
      llmDecision: 'allow',
      llmConfidence: 1,
    });
    return { intent, verdict };
  };
};
