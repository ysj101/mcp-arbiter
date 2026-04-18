import { WebPubSubServiceClient } from '@azure/web-pubsub';
import type { ArbiterEvent, PubSubAdapter } from './pubsub-adapter.js';

export interface WebPubSubAdapterOptions {
  connectionString: string;
  hub: string;
}

export class WebPubSubAdapter implements PubSubAdapter {
  private readonly client: WebPubSubServiceClient;
  private readonly localSubscribers = new Set<(event: ArbiterEvent) => void | Promise<void>>();

  constructor(options: WebPubSubAdapterOptions) {
    this.client = new WebPubSubServiceClient(options.connectionString, options.hub);
  }

  async publish(event: ArbiterEvent): Promise<void> {
    await this.client.sendToAll(event as unknown as Record<string, unknown>);
    for (const handler of this.localSubscribers) {
      await handler(event);
    }
  }

  subscribe(handler: (event: ArbiterEvent) => void | Promise<void>): () => void {
    this.localSubscribers.add(handler);
    return () => {
      this.localSubscribers.delete(handler);
    };
  }
}
