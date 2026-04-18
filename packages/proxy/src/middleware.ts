import type { AuthAdapter } from '@arbiter/core';
import type { AgentIdentity } from '@arbiter/shared-types';

export interface ProxyRequest {
  headers: Record<string, string | string[] | undefined>;
  tool: string;
  parameters: Readonly<Record<string, unknown>>;
  traceId?: string;
}

export interface ProxyAllowResponse {
  status: 'allow';
  identity: AgentIdentity;
}

export interface ProxyDenyResponse {
  status: 'deny';
  httpStatus: 401 | 403;
  error: string;
}

export type MiddlewareResult = ProxyAllowResponse | ProxyDenyResponse;

export const authenticate = async (
  auth: AuthAdapter,
  req: ProxyRequest,
): Promise<MiddlewareResult> => {
  const raw = req.headers.authorization ?? req.headers.Authorization;
  const token = Array.isArray(raw) ? raw[0] : raw;
  const result = await auth.verifyBearer(token);
  if (!result.ok || !result.identity) {
    return {
      status: 'deny',
      httpStatus: 401,
      error: result.error ?? 'unauthorized',
    };
  }
  return { status: 'allow', identity: result.identity };
};
