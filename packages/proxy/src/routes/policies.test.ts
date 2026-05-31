import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { StorageAdapter } from '@arbiter/core';
import type { Policy } from '@arbiter/shared-types';
import { createPolicy, deletePolicy, getPolicy, listPolicies, updatePolicy } from './policies.js';

function buildStorage(seed: Policy[] = []): StorageAdapter & { store: Map<string, Policy> } {
  const store = new Map<string, Policy>(seed.map((p) => [p.policyId, p]));
  return {
    store,
    upsertPolicy: async (p) => {
      store.set(p.policyId, p);
      return p;
    },
    listPolicies: async (query) => {
      const all = [...store.values()];
      if (query?.enabled === undefined) return all;
      return all.filter((p) => p.enabled === query.enabled);
    },
    getPolicy: async (id) => store.get(id),
    deletePolicy: async (id) => {
      store.delete(id);
    },
    saveVerdict: async (v) => v,
    getVerdict: async () => undefined,
    listVerdicts: async () => [],
  };
}

const samplePolicy = (overrides: Partial<Policy> = {}): Policy => ({
  policyId: 'policy-1',
  name: 'no-external-secrets',
  description: '',
  sensitiveCategories: [],
  rules: [],
  action: { onMatch: 'deny' },
  enabled: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  version: 1,
  ...overrides,
});

test('createPolicy は name/action 欠如で 400 を返す', async () => {
  const storage = buildStorage();
  const res = await createPolicy(storage, { description: 'x' });
  assert.equal(res.status, 400);
});

test('createPolicy は既定値を補完し policyId/version を採番する', async () => {
  const storage = buildStorage();
  const res = await createPolicy(storage, { name: 'p', action: { onMatch: 'flag' } });
  assert.equal(res.status, 201);
  const { policy } = res.body as { policy: Policy };
  assert.ok(policy.policyId.startsWith('policy-'));
  assert.equal(policy.version, 1);
  assert.equal(policy.enabled, true);
  assert.equal(storage.store.size, 1);
});

test('getPolicy は存在しない ID で 404 を返す', async () => {
  const storage = buildStorage();
  const res = await getPolicy(storage, 'missing');
  assert.equal(res.status, 404);
});

test('updatePolicy は version をインクリメントしてマージする', async () => {
  const storage = buildStorage([samplePolicy({ version: 3 })]);
  const res = await updatePolicy(storage, 'policy-1', { description: 'updated' });
  assert.equal(res.status, 200);
  const { policy } = res.body as { policy: Policy };
  assert.equal(policy.version, 4);
  assert.equal(policy.description, 'updated');
});

test('updatePolicy は存在しない ID で 404 を返す', async () => {
  const storage = buildStorage();
  const res = await updatePolicy(storage, 'missing', {});
  assert.equal(res.status, 404);
});

test('listPolicies は enabled クエリで絞り込む', async () => {
  const storage = buildStorage([
    samplePolicy({ policyId: 'a', enabled: true }),
    samplePolicy({ policyId: 'b', enabled: false }),
  ]);
  const res = await listPolicies(storage, 'true');
  assert.equal((res.body as { policies: Policy[] }).policies.length, 1);
});

test('deletePolicy はストアから削除して ok を返す', async () => {
  const storage = buildStorage([samplePolicy()]);
  const res = await deletePolicy(storage, 'policy-1');
  assert.equal(res.status, 200);
  assert.equal(storage.store.size, 0);
});
