export type AgentAuthMethod = 'bearer' | 'entra-id' | 'anonymous';

export interface AgentIdentity {
  agentId: string;
  displayName?: string;
  tenantId?: string;
  authMethod: AgentAuthMethod;
  issuedAt?: string;
  expiresAt?: string;
  scopes?: readonly string[];
}
