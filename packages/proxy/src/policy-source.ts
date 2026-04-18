import { readFile } from 'node:fs/promises';
import type { StorageAdapter } from '@arbiter/core';
import type { Policy } from '@arbiter/shared-types';

export interface PolicySource {
  list(): Promise<Policy[]>;
}

export class FilePolicySource implements PolicySource {
  constructor(private readonly path: string) {}

  async list(): Promise<Policy[]> {
    const raw = await readFile(this.path, 'utf8');
    const parsed = JSON.parse(raw) as { policies: Policy[] };
    return parsed.policies;
  }
}

export class StoragePolicySource implements PolicySource {
  constructor(private readonly storage: StorageAdapter) {}

  async list(): Promise<Policy[]> {
    return this.storage.listPolicies({ enabled: true });
  }
}
