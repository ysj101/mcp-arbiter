import type { IncomingMessage, ServerResponse } from 'node:http';
import type { PubSubAdapter } from '@arbiter/core';

const HEARTBEAT_INTERVAL_MS = 15000;

/**
 * GET /events — Server-Sent Events. Dashboard / CLI tail の入り口。
 * pubsub に流れる ArbiterEvent をそのまま SSE として配信する。
 */
export function streamEvents(
  req: IncomingMessage,
  res: ServerResponse,
  pubsub: PubSubAdapter,
): void {
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
  });
  res.write(':connected\n\n');
  const unsubscribe = pubsub.subscribe((event) => {
    res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  });
  const heartbeat = setInterval(() => {
    res.write(':heartbeat\n\n');
  }, HEARTBEAT_INTERVAL_MS);
  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
}
