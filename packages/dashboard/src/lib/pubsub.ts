import { InMemoryPubSubAdapter, type PubSubAdapter } from '@arbiter/core';

type GlobalWithBus = typeof globalThis & {
  __arbiterBus?: PubSubAdapter;
};

const g = globalThis as GlobalWithBus;

export const getPubSub = (): PubSubAdapter => {
  if (!g.__arbiterBus) {
    g.__arbiterBus = new InMemoryPubSubAdapter();
  }
  return g.__arbiterBus;
};
