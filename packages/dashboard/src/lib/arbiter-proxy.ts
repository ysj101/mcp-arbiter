import type { PolicyQuery, VerdictQuery } from '@arbiter/core';
import type { Policy, Verdict } from '@arbiter/shared-types';

const PROXY_URL = (process.env.ARBITER_PROXY_URL ?? 'http://localhost:7071').replace(/\/$/, '');

/** Proxy の /verdicts を叩く。ネットワーク失敗は空配列にフォールバック（Dashboard は落とさない）。 */
export const proxyListVerdicts = async (query?: VerdictQuery): Promise<Verdict[]> => {
  const url = new URL('/verdicts', PROXY_URL);
  if (query?.decision) url.searchParams.set('decision', query.decision);
  if (query?.agentId) url.searchParams.set('agentId', query.agentId);
  if (query?.limit) url.searchParams.set('limit', String(query.limit));
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return [];
    const body = (await res.json()) as { verdicts: Verdict[] };
    return body.verdicts;
  } catch {
    return [];
  }
};

export const proxyGetVerdict = async (verdictId: string): Promise<Verdict | undefined> => {
  const url = new URL(`/verdicts/${encodeURIComponent(verdictId)}`, PROXY_URL);
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return undefined;
    const body = (await res.json()) as { verdict: Verdict };
    return body.verdict;
  } catch {
    return undefined;
  }
};

export const proxyListPolicies = async (query?: PolicyQuery): Promise<Policy[]> => {
  const url = new URL('/policies', PROXY_URL);
  if (query?.enabled !== undefined) url.searchParams.set('enabled', String(query.enabled));
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return [];
    const body = (await res.json()) as { policies: Policy[] };
    return body.policies;
  } catch {
    return [];
  }
};

export const proxyGetPolicy = async (policyId: string): Promise<Policy | undefined> => {
  const url = new URL(`/policies/${encodeURIComponent(policyId)}`, PROXY_URL);
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return undefined;
    const body = (await res.json()) as { policy: Policy };
    return body.policy;
  } catch {
    return undefined;
  }
};

// upsert は "既存があれば PUT /policies/:id、無ければ POST /policies" に振り分ける。
// 既存 Policy の version / createdAt を保った更新も、同じ API 呼び出しから扱える。
export const proxyUpsertPolicy = async (policy: Policy): Promise<Policy> => {
  const existing = await proxyGetPolicy(policy.policyId);
  if (existing) {
    const url = new URL(`/policies/${encodeURIComponent(policy.policyId)}`, PROXY_URL);
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(policy),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`proxyUpsertPolicy PUT failed: ${res.status}`);
    const body = (await res.json()) as { policy: Policy };
    return body.policy;
  }
  const url = new URL('/policies', PROXY_URL);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(policy),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`proxyUpsertPolicy POST failed: ${res.status}`);
  const body = (await res.json()) as { policy: Policy };
  return body.policy;
};

export const proxyDeletePolicy = async (policyId: string): Promise<void> => {
  const url = new URL(`/policies/${encodeURIComponent(policyId)}`, PROXY_URL);
  await fetch(url, { method: 'DELETE', cache: 'no-store' });
};

export const getProxyEventsUrl = (): string => `${PROXY_URL}/events`;
