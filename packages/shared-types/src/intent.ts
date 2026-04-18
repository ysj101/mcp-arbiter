export type IntentScope = 'internal' | 'external' | 'unknown';

export interface IntentExtractedContext {
  targetResource?: string;
  recipients?: readonly string[];
  sensitivityHint?: 'low' | 'medium' | 'high' | 'unknown';
  scope?: IntentScope;
}

export interface Intent {
  intentId: string;
  agentId: string;
  tool: string;
  parameters: Readonly<Record<string, unknown>>;
  extractedContext: IntentExtractedContext;
  createdAt: string;
  traceId?: string;
}
