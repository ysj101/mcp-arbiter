import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { StorageAdapter } from '@arbiter/core';
import type { Verdict } from '@arbiter/shared-types';
import { getVerdict, listVerdicts } from './verdicts.js';

const sampleVerdict = (overrides: Partial<Verdict> = {}): Verdict => ({
  verdictId: 'verdict-1',
  intentId: 'intent-1',
  agentId: 'agent-1',
  decision: 'allow',
  evidence: [],
  judgment: '',
  confidence: 0.5,
  subAgentOpinions: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

function buildStorage(seed: Verdict[] = []): StorageAdapter {
  return {
    upsertPolicy: async (p) => p,
    listPolicies: async () => [],
    getPolicy: async () => undefined,
    deletePolicy: async () => undefined,
    saveVerdict: async (v) => v,
    getVerdict: async (id) => seed.find((v) => v.verdictId === id),
    listVerdicts: async (query) => {
      let result = seed;
      if (query?.decision) result = result.filter((v) => v.decision === query.decision);
      if (query?.limit !== undefined) result = result.slice(0, query.limit);
      return result;
    },
  };
}

test('getVerdict は存在しない ID で 404 を返す', async () => {
  const res = await getVerdict(buildStorage(), 'missing');
  assert.equal(res.status, 404);
});

test('getVerdict は該当 Verdict を 200 で返す', async () => {
  const res = await getVerdict(buildStorage([sampleVerdict()]), 'verdict-1');
  assert.equal(res.status, 200);
  assert.equal((res.body as { verdict: Verdict }).verdict.verdictId, 'verdict-1');
});

test('listVerdicts は decision クエリで絞り込む', async () => {
  const storage = buildStorage([
    sampleVerdict({ verdictId: 'a', decision: 'allow' }),
    sampleVerdict({ verdictId: 'b', decision: 'deny' }),
  ]);
  const res = await listVerdicts(storage, new URLSearchParams('decision=deny'));
  assert.equal((res.body as { verdicts: Verdict[] }).verdicts.length, 1);
});
