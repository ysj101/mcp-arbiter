import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AuthAdapter, PubSubAdapter, StorageAdapter } from '@arbiter/core';
import type { Policy } from '@arbiter/shared-types';
import type { ArbiterPipeline } from './arbitrate.js';
import { handleInvokeRequest } from './http-handler.js';
import { type HttpResult, readBody, sendJson } from './http-utils.js';
import type { McpDownstreamInterface } from './mcp-downstream.js';
import { streamEvents } from './routes/events.js';
import * as policies from './routes/policies.js';
import * as verdicts from './routes/verdicts.js';

export interface RouterDeps {
  mode: string;
  auth: AuthAdapter;
  storage: StorageAdapter;
  pubsub: PubSubAdapter;
  pipeline: ArbiterPipeline;
  downstream?: McpDownstreamInterface;
}

const NOT_FOUND: HttpResult = { status: 404, body: { error: 'not-found' } };

/**
 * HTTP リクエストを各ルートハンドラへ振り分けるディスパッチャを生成する。
 * 個々のルートロジックは routes/ 配下と http-handler.ts に委譲する。
 */
export function createRequestHandler(
  deps: RouterDeps,
): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  const { mode, auth, storage, pubsub, pipeline, downstream } = deps;

  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const rawUrl = req.url ?? '/';
    const parsed = new URL(rawUrl, `http://${req.headers.host ?? 'localhost'}`);
    const { pathname, searchParams } = parsed;
    const method = req.method ?? 'GET';

    if (pathname === '/healthz') {
      sendJson(res, { status: 200, body: { ok: true, mode, downstream: Boolean(downstream) } });
      return;
    }

    if (pathname === '/verdicts' && method === 'GET') {
      sendJson(res, await verdicts.listVerdicts(storage, searchParams));
      return;
    }
    if (pathname.startsWith('/verdicts/') && method === 'GET') {
      const verdictId = decodeURIComponent(pathname.slice('/verdicts/'.length));
      sendJson(res, await verdicts.getVerdict(storage, verdictId));
      return;
    }

    if (pathname === '/policies' && method === 'GET') {
      sendJson(res, await policies.listPolicies(storage, searchParams.get('enabled')));
      return;
    }
    if (pathname === '/policies' && method === 'POST') {
      const body = (await readBody(req)) as Partial<Policy> | null;
      sendJson(res, await policies.createPolicy(storage, body));
      return;
    }
    if (pathname.startsWith('/policies/') && method === 'GET') {
      const policyId = decodeURIComponent(pathname.slice('/policies/'.length));
      sendJson(res, await policies.getPolicy(storage, policyId));
      return;
    }
    if (pathname.startsWith('/policies/') && method === 'PUT') {
      const policyId = decodeURIComponent(pathname.slice('/policies/'.length));
      const body = (await readBody(req)) as Partial<Policy> | null;
      sendJson(res, await policies.updatePolicy(storage, policyId, body));
      return;
    }
    if (pathname.startsWith('/policies/') && method === 'DELETE') {
      const policyId = decodeURIComponent(pathname.slice('/policies/'.length));
      sendJson(res, await policies.deletePolicy(storage, policyId));
      return;
    }

    if (pathname === '/events' && method === 'GET') {
      streamEvents(req, res, pubsub);
      return;
    }

    if (pathname !== '/invoke') {
      sendJson(res, NOT_FOUND);
      return;
    }

    try {
      const body = await readBody(req);
      const result = await handleInvokeRequest(
        {
          auth,
          storage,
          pubsub,
          pipeline,
          ...(downstream ? { downstream } : {}),
        },
        {
          method,
          url: rawUrl,
          headers: req.headers as Record<string, string | string[] | undefined>,
          body,
        },
      );
      sendJson(res, result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      process.stderr.write(`[arbiter-proxy] invoke failed: ${message}\n`);
      sendJson(res, { status: 500, body: { error: 'internal-error', detail: message } });
    }
  };
}
