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

export interface EntraIdAuthOptions {
  tenantId: string;
  clientId: string;
  verifyJwt: (token: string) => Promise<EntraJwtPayload>;
}

export interface EntraJwtPayload {
  sub: string;
  name?: string;
  tid?: string;
  appid?: string;
  scp?: string;
  exp?: number;
  iat?: number;
}

export class EntraIdAuthAdapter implements AuthAdapter {
  constructor(private readonly options: EntraIdAuthOptions) {}

  async verifyBearer(token: string | undefined): Promise<AuthVerifyResult> {
    if (!token) return { ok: false, error: 'missing-token' };
    const stripped = token.replace(/^Bearer\s+/i, '').trim();
    try {
      const payload = await this.options.verifyJwt(stripped);
      if (payload.tid && payload.tid !== this.options.tenantId) {
        return { ok: false, error: 'tenant-mismatch' };
      }
      const identity: AgentIdentity = {
        agentId: payload.appid ?? payload.sub,
        ...(payload.name ? { displayName: payload.name } : {}),
        ...(payload.tid ? { tenantId: payload.tid } : {}),
        authMethod: 'entra-id',
        ...(payload.iat ? { issuedAt: new Date(payload.iat * 1000).toISOString() } : {}),
        ...(payload.exp ? { expiresAt: new Date(payload.exp * 1000).toISOString() } : {}),
        scopes: (payload.scp ?? '').split(' ').filter(Boolean),
      };
      return { ok: true, identity };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'jwt-verify-failed' };
    }
  }
}

export const extractBearerFromHeaders = (
  headers: Record<string, string | string[] | undefined>,
): string | undefined => {
  const raw = headers.authorization ?? headers.Authorization;
  if (!raw) return undefined;
  return Array.isArray(raw) ? raw[0] : raw;
};
