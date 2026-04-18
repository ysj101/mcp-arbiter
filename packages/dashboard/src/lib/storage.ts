import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  InMemoryStorageAdapter,
  type StorageAdapter,
  createStorageAdapter,
  loadConfig,
} from '@arbiter/core';
import type { Policy } from '@arbiter/shared-types';
import { proxyGetVerdict, proxyListVerdicts } from './arbiter-proxy';

type GlobalWithStorage = typeof globalThis & {
  __arbiterStorage?: StorageAdapter;
};

const g = globalThis as GlobalWithStorage;

// Dashboard と Proxy は別プロセスのため InMemoryStorageAdapter を使うと状態が共有されない。
// 憲法は fixtures を Dashboard 側でも seed して proxy と同じ初期値を持つ。
// 判決は runtime 生成のため、Dashboard からは Proxy の HTTP API (/verdicts) を読みに行く。
const seedPoliciesFromFixtures = async (storage: StorageAdapter): Promise<void> => {
  const fixturePath =
    process.env.ARBITER_POLICIES_FILE ??
    resolve(process.cwd(), '..', 'proxy', 'fixtures', 'default-policies.json');
  try {
    const raw = await readFile(fixturePath, 'utf8');
    const parsed = JSON.parse(raw) as { policies: Policy[] };
    for (const p of parsed.policies) await storage.upsertPolicy(p);
    process.stdout.write(
      `[dashboard] seeded ${parsed.policies.length} policies from ${fixturePath}\n`,
    );
  } catch (err) {
    process.stderr.write(
      `[dashboard] failed to seed from ${fixturePath}: ${err instanceof Error ? err.message : err}\n`,
    );
  }
};

/**
 * 判決の読み取りだけ Proxy に委譲するラッパ。policy methods は InMemory に据え置く（fixtures seed 済）。
 * Proxy 起動中は最新の判決が取れ、停止中は空配列を返して Dashboard を落とさない。
 */
const wrapWithProxyVerdicts = (inner: StorageAdapter): StorageAdapter => ({
  listPolicies: (query) => inner.listPolicies(query),
  getPolicy: (id) => inner.getPolicy(id),
  upsertPolicy: (p) => inner.upsertPolicy(p),
  deletePolicy: (id) => inner.deletePolicy(id),
  listVerdicts: (query) => proxyListVerdicts(query),
  getVerdict: (id) => proxyGetVerdict(id),
  saveVerdict: (v) => inner.saveVerdict(v),
});

export const getStorage = async (): Promise<StorageAdapter> => {
  if (g.__arbiterStorage) return g.__arbiterStorage;
  if (process.env.ARBITER_USE_COSMOS === '1') {
    const config = loadConfig();
    g.__arbiterStorage = await createStorageAdapter(config);
  } else {
    const inner = new InMemoryStorageAdapter();
    await seedPoliciesFromFixtures(inner);
    g.__arbiterStorage = wrapWithProxyVerdicts(inner);
  }
  return g.__arbiterStorage;
};
