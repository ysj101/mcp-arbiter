import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { Intent, Policy } from '@arbiter/shared-types';
import { evaluateRules } from './rule-filter.js';

const baseIntent = (params: Record<string, unknown>): Intent => ({
  intentId: 'i-1',
  agentId: 'a-1',
  tool: 'send_email',
  parameters: params,
  extractedContext: {},
  createdAt: new Date().toISOString(),
});

const basePolicy = (overrides: Partial<Policy>): Policy => ({
  policyId: 'p-1',
  name: 'test-policy',
  description: '',
  sensitiveCategories: [],
  rules: [],
  action: 'deny',
  enabled: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  version: 1,
  ...overrides,
});

test('evaluateRules denies when parameter matches contains', () => {
  const intent = baseIntent({ subject: '給与データ送付', body: 'x' });
  const policy = basePolicy({
    rules: [
      { toolPattern: 'send_email', parameterPath: 'subject', operator: 'contains', value: '給与' },
    ],
    sensitiveCategories: ['salary'],
  });
  const result = evaluateRules(intent, [policy]);
  assert.equal(result.decision, 'deny');
  if (result.decision === 'deny') {
    assert.equal(result.matches[0]?.evidence.detectedCategory, 'salary');
  }
});

test('evaluateRules passes when no rule matches', () => {
  const intent = baseIntent({ subject: 'hello', body: '' });
  const policy = basePolicy({
    rules: [
      { toolPattern: 'send_email', parameterPath: 'subject', operator: 'contains', value: '給与' },
    ],
  });
  const result = evaluateRules(intent, [policy]);
  assert.equal(result.decision, 'pass');
});

test('evaluateRules respects enabled flag', () => {
  const intent = baseIntent({ subject: '給与' });
  const policy = basePolicy({
    enabled: false,
    rules: [{ parameterPath: 'subject', operator: 'contains', value: '給与' }],
  });
  const result = evaluateRules(intent, [policy]);
  assert.equal(result.decision, 'pass');
});

test('evaluateRules ignores non-deny policies', () => {
  const intent = baseIntent({ subject: '給与' });
  const policy = basePolicy({
    action: 'allow',
    rules: [{ parameterPath: 'subject', operator: 'contains', value: '給与' }],
  });
  const result = evaluateRules(intent, [policy]);
  assert.equal(result.decision, 'pass');
});

test('evaluateRules regex match', () => {
  const intent = baseIntent({ to: 'me@gmail.com' });
  const policy = basePolicy({
    rules: [{ parameterPath: 'to', operator: 'matches', value: '@gmail\\.com$' }],
  });
  const result = evaluateRules(intent, [policy]);
  assert.equal(result.decision, 'deny');
});

test('evaluateRules toolPattern wildcard', () => {
  const intent = { ...baseIntent({ subject: '給与' }), tool: 'send_email_v2' };
  const policy = basePolicy({
    rules: [
      { toolPattern: 'send_email*', parameterPath: 'subject', operator: 'contains', value: '給与' },
    ],
  });
  const result = evaluateRules(intent, [policy]);
  assert.equal(result.decision, 'deny');
});
