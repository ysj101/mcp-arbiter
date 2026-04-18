import type { AuthAdapter, PubSubAdapter, StorageAdapter } from '@arbiter/core';
import type { ArbiterPipeline } from './arbitrate.js';
import type { McpDownstreamInterface } from './mcp-downstream.js';
import { authenticate } from './middleware.js';

export interface ProxyDeps {
  auth: AuthAdapter;
  storage: StorageAdapter;
  pubsub: PubSubAdapter;
  pipeline: ArbiterPipeline;
  downstream?: McpDownstreamInterface;
}

export interface HttpRequestLike {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
}

export interface HttpResponseLike {
  status: number;
  body: unknown;
}

export const handleInvokeRequest = async (
  deps: ProxyDeps,
  req: HttpRequestLike,
): Promise<HttpResponseLike> => {
  if (req.method !== 'POST') {
    return { status: 405, body: { error: 'method-not-allowed' } };
  }

  const body = req.body as {
    tool?: string;
    parameters?: Record<string, unknown>;
    traceId?: string;
  } | null;
  if (!body || typeof body.tool !== 'string') {
    return { status: 400, body: { error: 'invalid-body' } };
  }

  const authResult = await authenticate(deps.auth, {
    headers: req.headers,
    tool: body.tool,
    parameters: body.parameters ?? {},
    ...(body.traceId ? { traceId: body.traceId } : {}),
  });

  if (authResult.status === 'deny') {
    return {
      status: authResult.httpStatus,
      body: { error: authResult.error },
    };
  }

  const now = new Date().toISOString();
  const { intent, verdict } = await deps.pipeline({
    identity: authResult.identity,
    tool: body.tool,
    parameters: body.parameters ?? {},
    ...(body.traceId ? { traceId: body.traceId } : {}),
  });

  await deps.pubsub.publish({ type: 'intent.received', intent, occurredAt: now });
  await deps.pubsub.publish({
    type: 'policy.evaluating',
    intentId: intent.intentId,
    occurredAt: new Date().toISOString(),
  });
  await deps.storage.saveVerdict(verdict);
  await deps.pubsub.publish({
    type: 'verdict.decided',
    verdict,
    occurredAt: new Date().toISOString(),
  });

  if (verdict.decision === 'allow' && deps.downstream) {
    try {
      const toolResult = await deps.downstream.callTool(body.tool, body.parameters ?? {});
      return { status: 200, body: { intent, verdict, toolResult } };
    } catch (err) {
      return {
        status: 502,
        body: {
          intent,
          verdict,
          error: `downstream-failed: ${err instanceof Error ? err.message : 'unknown'}`,
        },
      };
    }
  }

  return {
    status: verdict.decision === 'allow' ? 200 : 403,
    body: { intent, verdict },
  };
};
