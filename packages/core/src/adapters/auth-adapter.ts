import type { AgentIdentity } from '@arbiter/shared-types';

export interface AuthVerifyResult {
  ok: boolean;
  identity?: AgentIdentity;
  error?: string;
}

export interface AuthAdapter {
  verifyBearer(token: string | undefined): Promise<AuthVerifyResult>;
}

export interface LocalBearerAuthOptions {
  sharedSecret: string;
  fixedIdentity?: Partial<AgentIdentity>;
}

export class LocalBearerAuthAdapter implements AuthAdapter {
  constructor(private readonly options: LocalBearerAuthOptions) {}

  async verifyBearer(token: string | undefined): Promise<AuthVerifyResult> {
    if (!token) return { ok: false, error: 'missing-token' };
    const stripped = token.replace(/^Bearer\s+/i, '').trim();
    if (stripped !== this.options.sharedSecret) return { ok: false, error: 'invalid-token' };

    const identity: AgentIdentity = {
      agentId: this.options.fixedIdentity?.agentId ?? 'local-demo-agent',
      displayName: this.options.fixedIdentity?.displayName ?? 'Local Demo Agent',
      authMethod: 'bearer',
      issuedAt: new Date().toISOString(),
      scopes: this.options.fixedIdentity?.scopes ?? ['arbiter.invoke'],
    };
    return { ok: true, identity };
  }
}
