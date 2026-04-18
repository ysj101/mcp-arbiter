import type { ArbiterConfig } from '../config.js';
import { InMemoryPubSubAdapter, type PubSubAdapter } from './pubsub-adapter.js';
import { WebPubSubAdapter } from './webpubsub-adapter.js';

export interface PubSubFactoryOptions {
  hub?: string;
  forceRemote?: boolean;
}

export const createPubSubAdapter = (
  config: ArbiterConfig,
  options: PubSubFactoryOptions = {},
): PubSubAdapter => {
  const useRemote = options.forceRemote || config.mode === 'cloud';
  if (useRemote) {
    if (!config.signalr.connectionString) {
      throw new Error('cloud mode requires SIGNALR_CONNECTION_STRING');
    }
    return new WebPubSubAdapter({
      connectionString: config.signalr.connectionString,
      hub: options.hub ?? 'arbiter',
    });
  }
  return new InMemoryPubSubAdapter();
};
