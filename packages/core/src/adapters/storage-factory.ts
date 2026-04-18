import type { ArbiterConfig } from '../config.js';
import { CosmosStorageAdapter } from './cosmos-storage-adapter.js';
import { InMemoryStorageAdapter, type StorageAdapter } from './storage-adapter.js';

export const createStorageAdapter = async (config: ArbiterConfig): Promise<StorageAdapter> => {
  if (config.mode === 'cloud' || process.env.ARBITER_USE_COSMOS === '1') {
    if (!config.cosmos.endpoint || !config.cosmos.key) {
      throw new Error('Cosmos endpoint/key are required');
    }
    const adapter = new CosmosStorageAdapter({
      endpoint: config.cosmos.endpoint,
      key: config.cosmos.key,
      databaseId: config.cosmos.database,
    });
    await adapter.init();
    return adapter;
  }
  return new InMemoryStorageAdapter();
};
