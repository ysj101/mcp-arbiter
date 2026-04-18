import type {
  Decision,
  Evidence,
  Intent,
  Policy,
  SubAgentOpinion,
  Verdict,
} from '@arbiter/shared-types';
import type { RuleMatch } from './rule-filter.js';

export interface DecisionInput {
  intent: Intent;
  ruleMatches: RuleMatch[];
  opinions: SubAgentOpinion[];
  llmDecision: Decision;
  llmConfidence: number;
}

export interface DecisionEngine {
  decide(input: DecisionInput): Verdict;
}

const formatRecipients = (intent: Intent): string => {
  const recipients = intent.extractedContext.recipients;
  if (!recipients || recipients.length === 0) return '不明';
  return recipients.join(', ');
};

const describeCharge = (match: RuleMatch | undefined, opinions: SubAgentOpinion[]): string => {
  if (match) return match.policy.name;
  const denying = opinions.filter((o) => o.verdict === 'deny');
  if (denying.length === 0) return '該当罪状なし';
  return denying.map((o) => `${o.role}の所見`).join(' / ');
};

const composeJudgment = (
  decision: Decision,
  intent: Intent,
  ruleMatches: RuleMatch[],
  opinions: SubAgentOpinion[],
  charge: string,
): string => {
  const recipients = formatRecipients(intent);
  const tool = intent.tool;

  if (decision === 'deny') {
    const evidencePart =
      ruleMatches.length > 0
        ? `証拠として「${ruleMatches[0]?.evidence.excerpt ?? ''}」が検出された。`
        : '審理官の合議によりこの所作に疑義が示された。';
    const opinionsPart = opinions
      .filter((o) => o.verdict === 'deny')
      .map((o) => `・${o.role}: ${o.rationale}`)
      .join('\n');
    return [
      `主文: 本法廷は、エージェント ${intent.agentId} による tool=${tool} の執行を棄却する。`,
      `罪状: ${charge}`,
      `事案: 宛先 ${recipients} に対する要求は本憲法第 1 条の禁を冒すものである。${evidencePart}`,
      `審理官意見:\n${opinionsPart || '・（意見なし）'}`,
      '以上の理由により、本件ツール実行は許可されない。',
    ].join('\n');
  }

  const opinionsPart = opinions.map((o) => `・${o.role}: ${o.rationale}`).join('\n');
  return [
    `主文: 本法廷は、エージェント ${intent.agentId} による tool=${tool} の執行を許可する。`,
    `事案: 宛先 ${recipients} への要求は本憲法の禁止事項に抵触しない。`,
    `審理官意見:\n${opinionsPart || '・（意見なし）'}`,
    '以上の理由により、本件ツール実行は妨げられない。',
  ].join('\n');
};

export class DefaultDecisionEngine implements DecisionEngine {
  decide(input: DecisionInput): Verdict {
    const { intent, ruleMatches, opinions, llmDecision, llmConfidence } = input;

    const decision: Decision = ruleMatches.length > 0 ? 'deny' : llmDecision;
    const evidence: Evidence[] = ruleMatches.map((m) => m.evidence);
    const primaryMatch = ruleMatches[0];
    const policyRef: string | undefined = primaryMatch?.policy.policyId;
    const charge = decision === 'deny' ? describeCharge(primaryMatch, opinions) : '該当罪状なし';
    const judgment = composeJudgment(decision, intent, ruleMatches, opinions, charge);

    const confidence = ruleMatches.length > 0 ? Math.max(llmConfidence, 0.9) : llmConfidence;

    const now = new Date().toISOString();
    const verdictId = `verdict-${now}-${Math.random().toString(36).slice(2, 10)}`;

    return {
      verdictId,
      intentId: intent.intentId,
      agentId: intent.agentId,
      decision,
      ...(decision === 'deny' ? { charge } : {}),
      evidence,
      judgment,
      confidence,
      ...(policyRef ? { policyRef } : {}),
      subAgentOpinions: opinions,
      ...(intent.traceId ? { traceId: intent.traceId } : {}),
      createdAt: now,
    } satisfies Verdict;
  }
}

export const resolvePolicyRef = (matches: readonly RuleMatch[]): Policy | undefined =>
  matches[0]?.policy;
