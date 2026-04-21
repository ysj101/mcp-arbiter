import { getProxyEventsUrl } from '@/lib/arbiter-proxy';

export const dynamic = 'force-dynamic';

/**
 * Proxy の /events SSE をブラウザへパススルーする。
 * Proxy と Dashboard が別プロセスでも、Proxy の InMemoryPubSub から出た verdict.decided
 * 等のイベントが Dashboard 経由で UI に届く。
 * Cloud モードでは Azure Web PubSub に直接繋ぐ想定なので、このルートは local 専用。
 */
export async function GET(req: Request) {
  const controller = new AbortController();
  req.signal.addEventListener('abort', () => controller.abort());

  const upstream = await fetch(getProxyEventsUrl(), {
    signal: controller.signal,
    headers: { accept: 'text/event-stream' },
    cache: 'no-store',
  }).catch(() => null);

  if (!upstream?.ok || !upstream.body) {
    // Proxy 未起動でも SSE 接続は確立して、クライアント側の EventSource が無限に再接続しないようにする。
    return new Response(':proxy-unavailable\n\n', {
      status: 200,
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
      },
    });
  }

  return new Response(upstream.body, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    },
  });
}
