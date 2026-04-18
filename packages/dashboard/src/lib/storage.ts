import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  InMemoryStorageAdapter,
  type StorageAdapter,
  createStorageAdapter,
  loadConfig,
} from '@arbiter/core';
import type { Policy } from '@arbiter/shared-types';

type GlobalWithStorage = typeof globalThis & {
  __arbiterStorage?: StorageAdapter;
};

const g = globalThis as GlobalWithStorage;

// Dashboard と Proxy は別プロセスのため InMemoryStorageAdapter を使うと状態が共有されない。
// local モードでは Dashboard 側も Proxy と同じ fixtures をシードして、UI に既定憲法が見える状態にする。
// Cosmos 経由 (ARBITER_USE_COSMOS=1) ならシード不要（Proxy が upsert した内容を直接読める）。
const seedFromFixtures = async (storage: StorageAdapter): Promise<void> => {
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

export const getStorage = async (): Promise<StorageAdapter> => {
  if (g.__arbiterStorage) return g.__arbiterStorage;
  if (process.env.ARBITER_USE_COSMOS === '1') {
    const config = loadConfig();
    g.__arbiterStorage = await createStorageAdapter(config);
  } else {
    const storage = new InMemoryStorageAdapter();
    await seedFromFixtures(storage);
    g.__arbiterStorage = storage;
  }
  return g.__arbiterStorage;
};
