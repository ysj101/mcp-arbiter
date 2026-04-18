export type PolicyAction = 'allow' | 'deny' | 'review';

export interface PolicyRule {
  toolPattern?: string;
  parameterPath?: string;
  operator?: 'equals' | 'contains' | 'matches' | 'startsWith';
  value?: string;
}

export interface Policy {
  policyId: string;
  name: string;
  description: string;
  sensitiveCategories: readonly string[];
  rules: readonly PolicyRule[];
  llmJudgePrompt?: string;
  action: PolicyAction;
  enabled: boolean;
  updatedAt: string;
  createdAt: string;
  version: number;
}
