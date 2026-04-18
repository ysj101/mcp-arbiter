#!/usr/bin/env tsx
/**
 * Seed default policies into Cosmos Emulator.
 * Usage:
 *   ARBITER_USE_COSMOS=1 pnpm tsx scripts/seed-policies.ts
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createStorageAdapter, loadConfig } from '@arbiter/core';
import type { Policy } from '@arbiter/shared-types';

const main = async (): Promise<void> => {
  const config = loadConfig();
  const storage = await createStorageAdapter(config);
  const fixturePath = join(process.cwd(), 'packages', 'proxy', 'fixtures', 'default-policies.json');
  const raw = await readFile(fixturePath, 'utf8');
  const { policies } = JSON.parse(raw) as { policies: Policy[] };
  for (const policy of policies) {
    await storage.upsertPolicy(policy);
    process.stdout.write(`upserted ${policy.policyId}\n`);
  }
  process.stdout.write(`done (${policies.length} policies)\n`);
};

main().catch((err: unknown) => {
  process.stderr.write(`seed-policies failed: ${err instanceof Error ? err.message : err}\n`);
  process.exit(1);
});
