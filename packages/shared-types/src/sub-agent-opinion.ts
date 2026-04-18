export type OpinionVerdict = 'allow' | 'deny' | 'abstain';

export interface SubAgentOpinion {
  subAgentId: string;
  role: string;
  verdict: OpinionVerdict;
  confidence: number;
  rationale: string;
  citedPolicies?: readonly string[];
}
