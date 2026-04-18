import {
  InMemoryStorageAdapter,
  type StorageAdapter,
  createStorageAdapter,
  loadConfig,
} from '@arbiter/core';

type GlobalWithStorage = typeof globalThis & {
  __arbiterStorage?: StorageAdapter;
};

const g = globalThis as GlobalWithStorage;

export const getStorage = async (): Promise<StorageAdapter> => {
  if (g.__arbiterStorage) return g.__arbiterStorage;
  if (process.env.ARBITER_USE_COSMOS === '1') {
    const config = loadConfig();
    g.__arbiterStorage = await createStorageAdapter(config);
  } else {
    g.__arbiterStorage = new InMemoryStorageAdapter();
  }
  return g.__arbiterStorage;
};
