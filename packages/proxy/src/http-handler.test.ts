import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  InMemoryPubSubAdapter,
  InMemoryStorageAdapter,
  LocalBearerAuthAdapter,
} from '@arbiter/core';
import { createSkeletonPipeline } from './arbitrate.js';
import { handleInvokeRequest } from './http-handler.js';

const makeDeps = () => ({
  auth: new LocalBearerAuthAdapter({ sharedSecret: 'secret' }),
  storage: new InMemoryStorageAdapter(),
  pubsub: new InMemoryPubSubAdapter(),
  pipeline: createSkeletonPipeline(),
});

test('handleInvokeRequest returns 401 without token', async () => {
  const res = await handleInvokeRequest(makeDeps(), {
    method: 'POST',
    url: '/invoke',
    headers: {},
    body: { tool: 'send_email', parameters: {} },
  });
  assert.equal(res.status, 401);
});

test('handleInvokeRequest returns 200 with valid token (skeleton allows all)', async () => {
  const deps = makeDeps();
  const res = await handleInvokeRequest(deps, {
    method: 'POST',
    url: '/invoke',
    headers: { authorization: 'Bearer secret' },
    body: { tool: 'send_email', parameters: { to: 'a@example.com' } },
  });
  assert.equal(res.status, 200);
  const body = res.body as { verdict: { decision: string; agentId: string } };
  assert.equal(body.verdict.decision, 'allow');
  assert.equal(body.verdict.agentId, 'local-demo-agent');
});

test('handleInvokeRequest rejects wrong method', async () => {
  const res = await handleInvokeRequest(makeDeps(), {
    method: 'GET',
    url: '/invoke',
    headers: { authorization: 'Bearer secret' },
    body: null,
  });
  assert.equal(res.status, 405);
});

test('handleInvokeRequest rejects invalid body', async () => {
  const res = await handleInvokeRequest(makeDeps(), {
    method: 'POST',
    url: '/invoke',
    headers: { authorization: 'Bearer secret' },
    body: null,
  });
  assert.equal(res.status, 400);
});

test('handleInvokeRequest persists verdict and publishes events', async () => {
  const deps = makeDeps();
  const events: string[] = [];
  deps.pubsub.subscribe((e) => {
    events.push(e.type);
  });
  await handleInvokeRequest(deps, {
    method: 'POST',
    url: '/invoke',
    headers: { authorization: 'Bearer secret' },
    body: { tool: 'send_email', parameters: {}, traceId: 't-1' },
  });
  const verdicts = await deps.storage.listVerdicts();
  assert.equal(verdicts.length, 1);
  assert.equal(verdicts[0]?.traceId, 't-1');
  assert.deepEqual(events, ['intent.received', 'policy.evaluating', 'verdict.decided']);
});
