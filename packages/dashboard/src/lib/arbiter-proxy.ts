import type { VerdictQuery } from '@arbiter/core';
import type { Verdict } from '@arbiter/shared-types';

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

export const getProxyEventsUrl = (): string => `${PROXY_URL}/events`;
