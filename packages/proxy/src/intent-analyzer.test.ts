import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  RuleBasedIntentAnalyzer,
  extractContext,
  extractRecipients,
  scoreSensitivity,
  summarizeScope,
} from './intent-analyzer.js';

test('extractRecipients collects to / cc / recipients', () => {
  const list = extractRecipients({
    to: 'a@example.com',
    cc: ['b@example.com', 'c@partner.co.jp'],
    recipients: ['d@example.com'],
    subject: 'x',
  });
  assert.deepEqual(list, ['a@example.com', 'd@example.com', 'b@example.com', 'c@partner.co.jp']);
});

test('summarizeScope classifies external vs internal', () => {
  assert.equal(summarizeScope(['a@example.com']), 'internal');
  assert.equal(summarizeScope(['a@partner.co.jp']), 'external');
  assert.equal(summarizeScope(['a@example.com', 'b@partner.co.jp']), 'external');
  assert.equal(summarizeScope([]), 'unknown');
});

test('scoreSensitivity scales with keyword count', () => {
  assert.equal(scoreSensitivity('日次報告'), 'low');
  assert.equal(scoreSensitivity('人事連絡'), 'medium');
  assert.equal(scoreSensitivity('人事評価 / 給与明細'), 'high');
});

test('extractContext for send_email produces full context', () => {
  const ctx = extractContext('send_email', {
    to: 'external@partner.co.jp',
    subject: '人事評価ドラフト',
    body: 'confidential 情報を送ります',
  });
  assert.equal(ctx.targetResource, 'email-outbox');
  assert.equal(ctx.scope, 'external');
  assert.equal(ctx.sensitivityHint, 'high');
  assert.deepEqual(ctx.recipients, ['external@partner.co.jp']);
});

test('analyzer attaches traceId and generates unique intentId', async () => {
  const analyzer = new RuleBasedIntentAnalyzer();
  const a = await analyzer.analyze({
    agentId: 'agent-1',
    tool: 'send_email',
    parameters: { to: 'a@example.com', subject: 's', body: 'b' },
    traceId: 't-1',
  });
  const b = await analyzer.analyze({
    agentId: 'agent-1',
    tool: 'send_email',
    parameters: { to: 'a@example.com', subject: 's', body: 'b' },
  });
  assert.equal(a.traceId, 't-1');
  assert.notEqual(a.intentId, b.intentId);
});
