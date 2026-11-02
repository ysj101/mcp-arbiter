import type { StorageAdapter } from '@arbiter/core';
import type { HttpResult } from '../http-utils.js';

/** GET /verdicts[?decision=&agentId=&limit=] */
export async function listVerdicts(
  storage: StorageAdapter,
  searchParams: URLSearchParams,
): Promise<HttpResult> {
  const decision = searchParams.get('decision');
  const agentId = searchParams.get('agentId');
  const limitRaw = searchParams.get('limit');
  const verdicts = await storage.listVerdicts({
    ...(decision === 'allow' || decision === 'deny' ? { decision } : {}),
    ...(agentId ? { agentId } : {}),
    ...(limitRaw ? { limit: Number(limitRaw) } : {}),
  });
  return { status: 200, body: { verdicts } };
}

/** GET /verdicts/:verdictId */
export async function getVerdict(storage: StorageAdapter, verdictId: string): Promise<HttpResult> {
  const verdict = await storage.getVerdict(verdictId);
  if (!verdict) {
    return { status: 404, body: { error: 'not-found' } };
  }
  return { status: 200, body: { verdict } };
}
