import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { DemoAgentClient } from './demo-agent.js';

const makeFakeFetch = (status: number, body: unknown): typeof fetch => {
  return async (_url, init) => {
    const headers = init?.headers as Record<string, string> | undefined;
    const capturedAuth = headers?.authorization ?? headers?.Authorization ?? '';
    const responseBody = JSON.stringify(
      body && typeof body === 'object' ? { ...body, __auth: capturedAuth } : body,
    );
    return new Response(responseBody, {
      status,
      headers: { 'content-type': 'application/json' },
    });
  };
};

test('DemoAgentClient sends Bearer token', async () => {
  const client = new DemoAgentClient({
    proxyUrl: 'http://proxy.local',
    bearerToken: 'secret',
    fetchImpl: makeFakeFetch(200, {
      intent: {
        intentId: 'i',
        agentId: 'a',
        tool: 't',
        parameters: {},
        extractedContext: {},
        createdAt: 'x',
      },
      verdict: {
        verdictId: 'v',
        intentId: 'i',
        agentId: 'a',
        decision: 'allow',
        evidence: [],
        judgment: 'ok',
        confidence: 1,
        subAgentOpinions: [],
        createdAt: 'x',
      },
    }),
  });
  const result = await client.invoke({ tool: 'send_email', parameters: { to: 'a@b' } });
  assert.equal(result.status, 200);
  assert.equal(result.verdict?.decision, 'allow');
});

test('DemoAgentClient handles 401 as error', async () => {
  const client = new DemoAgentClient({
    proxyUrl: 'http://proxy.local',
    fetchImpl: makeFakeFetch(401, { error: 'missing-token' }),
  });
  const result = await client.invoke({ tool: 'send_email', parameters: {} });
  assert.equal(result.status, 401);
  assert.equal(result.error, 'missing-token');
});
