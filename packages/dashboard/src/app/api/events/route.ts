import { getPubSub } from '@/lib/pubsub';

export const dynamic = 'force-dynamic';

/**
 * Server-Sent Events endpoint. Dashboard clients subscribe here when running in local mode.
 * In cloud mode, the same events are fanned out via Azure Web PubSub and the browser
 * should connect to that service instead.
 */
export async function GET() {
  const bus = getPubSub();
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const unsubscribe = bus.subscribe((event) => {
        const chunk = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          unsubscribe();
        }
      });
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(':heartbeat\n\n'));
        } catch {
          clearInterval(heartbeat);
          unsubscribe();
        }
      }, 15000);
      controller.enqueue(encoder.encode(':connected\n\n'));
      return () => {
        clearInterval(heartbeat);
        unsubscribe();
      };
    },
  });
  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    },
  });
}
