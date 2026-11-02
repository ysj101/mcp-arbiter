import type { StorageAdapter } from '@arbiter/core';
import { generateId, type Policy } from '@arbiter/shared-types';
import type { HttpResult } from '../http-utils.js';

/** GET /policies[?enabled=true|false] */
export async function listPolicies(
  storage: StorageAdapter,
  enabledRaw: string | null,
): Promise<HttpResult> {
  const query =
    enabledRaw === 'true' ? { enabled: true } : enabledRaw === 'false' ? { enabled: false } : {};
  const policies = await storage.listPolicies(query);
  return { status: 200, body: { policies } };
}

/** POST /policies — 新規 upsert */
export async function createPolicy(
  storage: StorageAdapter,
  body: Partial<Policy> | null,
): Promise<HttpResult> {
  if (!body?.name || !body.action) {
    return { status: 400, body: { error: 'name and action are required' } };
  }
  const saved = await storage.upsertPolicy(
    buildPolicy({ ...body, name: body.name, action: body.action }),
  );
  return { status: 201, body: { policy: saved } };
}

/** GET /policies/:policyId */
export async function getPolicy(storage: StorageAdapter, policyId: string): Promise<HttpResult> {
  const policy = await storage.getPolicy(policyId);
  if (!policy) {
    return { status: 404, body: { error: 'not-found' } };
  }
  return { status: 200, body: { policy } };
}

/** PUT /policies/:policyId — 既存に対して部分更新 */
export async function updatePolicy(
  storage: StorageAdapter,
  policyId: string,
  body: Partial<Policy> | null,
): Promise<HttpResult> {
  const existing = await storage.getPolicy(policyId);
  if (!existing) {
    return { status: 404, body: { error: 'not-found' } };
  }
  const merged: Policy = {
    ...existing,
    ...(body ?? {}),
    policyId,
    updatedAt: new Date().toISOString(),
    version: existing.version + 1,
  };
  const saved = await storage.upsertPolicy(merged);
  return { status: 200, body: { policy: saved } };
}

/** DELETE /policies/:policyId */
export async function deletePolicy(storage: StorageAdapter, policyId: string): Promise<HttpResult> {
  await storage.deletePolicy(policyId);
  return { status: 200, body: { ok: true } };
}

/** 受け取った部分入力から既定値を補完して Policy を組み立てる。 */
function buildPolicy(input: Partial<Policy> & Pick<Policy, 'name' | 'action'>): Policy {
  const now = new Date().toISOString();
  return {
    policyId: input.policyId ?? generateId('policy'),
    name: input.name,
    description: input.description ?? '',
    sensitiveCategories: input.sensitiveCategories ?? [],
    rules: input.rules ?? [],
    ...(input.llmJudgePrompt ? { llmJudgePrompt: input.llmJudgePrompt } : {}),
    action: input.action,
    enabled: input.enabled ?? true,
    createdAt: input.createdAt ?? now,
    updatedAt: now,
    version: (input.version ?? 0) + 1,
  };
}
