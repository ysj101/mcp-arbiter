import { type StorageAdapter, createStorageAdapter, loadConfig } from '@arbiter/core';
import type { Verdict } from '@arbiter/shared-types';
import {
  proxyDeletePolicy,
  proxyGetPolicy,
  proxyGetVerdict,
  proxyListPolicies,
  proxyListVerdicts,
  proxyUpsertPolicy,
} from './arbiter-proxy';

type GlobalWithStorage = typeof globalThis & {
  __arbiterStorage?: StorageAdapter;
};

const g = globalThis as GlobalWithStorage;

// local モードでは Proxy を policy / verdict の single source of truth として扱い、
// Dashboard 側では InMemory を持たない。Proxy が fixtures から seed した policy も、
// arbitrate 経由で生成された verdict も、Dashboard はここから HTTP で取りに行く。
// Proxy 未起動時はネットワーク失敗が空配列に丸め込まれて、Dashboard は "0 件" 表示のまま立つ。
// Cloud モード / ARBITER_USE_COSMOS=1 ではこの経路は使わず Cosmos を直接読む。
const createProxyHttpStorage = (): StorageAdapter => ({
  listPolicies: (query) => proxyListPolicies(query),
  getPolicy: (id) => proxyGetPolicy(id),
  upsertPolicy: (policy) => proxyUpsertPolicy(policy),
  deletePolicy: (id) => proxyDeletePolicy(id),
  listVerdicts: (query) => proxyListVerdicts(query),
  getVerdict: (id) => proxyGetVerdict(id),
  // verdict は Proxy が /invoke 経由でしか生成しないため、Dashboard から直接 save する経路は提供しない。
  saveVerdict: async (_v: Verdict) => {
    throw new Error(
      'saveVerdict is not supported from Dashboard in local mode; use POST /invoke on Proxy',
    );
  },
});

export const getStorage = async (): Promise<StorageAdapter> => {
  if (g.__arbiterStorage) return g.__arbiterStorage;
  if (process.env.ARBITER_USE_COSMOS === '1') {
    const config = loadConfig();
    g.__arbiterStorage = await createStorageAdapter(config);
  } else {
    g.__arbiterStorage = createProxyHttpStorage();
  }
  return g.__arbiterStorage;
};
