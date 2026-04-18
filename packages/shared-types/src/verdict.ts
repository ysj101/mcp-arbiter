import type { SubAgentOpinion } from './sub-agent-opinion.js';

export type Decision = 'allow' | 'deny';

export interface Evidence {
  location: string;
  excerpt: string;
  detectedCategory?: string;
}

export interface Verdict {
  verdictId: string;
  intentId: string;
  agentId: string;
  decision: Decision;
  charge?: string;
  evidence: readonly Evidence[];
  judgment: string;
  confidence: number;
  policyRef?: string;
  subAgentOpinions: readonly SubAgentOpinion[];
  traceId?: string;
  createdAt: string;
}
