import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { MockLLMAdapter } from '@arbiter/core';
import type { Intent } from '@arbiter/shared-types';
import { LLMConsensusEngine } from './llm-consensus.js';

const makeIntent = (override: Partial<Intent> = {}): Intent => ({
  intentId: 'i-1',
  agentId: 'a-1',
  tool: 'send_email',
  parameters: { to: 'x@example.com', subject: 's', body: 'hello' },
  extractedContext: { recipients: ['x@example.com'] },
  createdAt: new Date().toISOString(),
  ...override,
});

test('LLMConsensusEngine reaches allow for routine internal email', async () => {
  const engine = new LLMConsensusEngine(new MockLLMAdapter());
  const result = await engine.deliberate(makeIntent());
  assert.equal(result.decision, 'allow');
  assert.equal(result.opinions.length, 3);
});

test('LLMConsensusEngine reaches deny for external sensitive email', async () => {
  const engine = new LLMConsensusEngine(new MockLLMAdapter());
  const result = await engine.deliberate(
    makeIntent({
      parameters: {
        to: 'out@partner.co.jp',
        subject: '人事評価ドラフト',
        body: '佐藤さんの評価 B+',
      },
      extractedContext: { recipients: ['out@partner.co.jp'] },
    }),
  );
  assert.equal(result.decision, 'deny');
  assert.ok(result.confidence > 0);
});

test('LLMConsensusEngine respects custom denyThreshold', async () => {
  const engine = new LLMConsensusEngine(new MockLLMAdapter(), { denyThreshold: 1 });
  const result = await engine.deliberate(
    makeIntent({
      parameters: {
        to: 'out@partner.co.jp',
        subject: '人事評価',
        body: 'confidential',
      },
      extractedContext: { recipients: ['out@partner.co.jp'] },
    }),
  );
  // with threshold=1 all must deny; MockLLMAdapter returns deny for all 3 judges in this case
  assert.equal(result.decision, 'deny');
});
