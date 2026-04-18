import type { Intent, Verdict } from '@arbiter/shared-types';

export type ArbiterEvent =
  | { type: 'intent.received'; intent: Intent; occurredAt: string }
  | { type: 'policy.evaluating'; intentId: string; occurredAt: string }
  | { type: 'verdict.decided'; verdict: Verdict; occurredAt: string };

export interface PubSubAdapter {
  publish(event: ArbiterEvent): Promise<void>;
  subscribe(handler: (event: ArbiterEvent) => void | Promise<void>): () => void;
}

export class InMemoryPubSubAdapter implements PubSubAdapter {
  private readonly handlers = new Set<(event: ArbiterEvent) => void | Promise<void>>();

  async publish(event: ArbiterEvent): Promise<void> {
    for (const handler of this.handlers) {
      await handler(event);
    }
  }

  subscribe(handler: (event: ArbiterEvent) => void | Promise<void>): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }
}
