import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { MockLLMAdapter } from '@arbiter/core';
import type { Policy } from '@arbiter/shared-types';
import { buildPipeline } from './arbitrate.js';
import { DefaultDecisionEngine } from './decision-engine.js';
import { RuleBasedIntentAnalyzer } from './intent-analyzer.js';
import { LLMConsensusEngine } from './llm-consensus.js';
import type { PolicySource } from './policy-source.js';

const ruleHrPolicy: Policy = {
  policyId: 'policy-hr-rule',
  name: '人事キーワード禁',
  description: '',
  sensitiveCategories: ['hr'],
  rules: [
    { toolPattern: 'send_email', parameterPath: 'subject', operator: 'contains', value: '人事' },
  ],
  action: 'deny',
  enabled: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  version: 1,
};

const makeDeps = (policies: Policy[]) => {
  const source: PolicySource = { list: async () => policies };
  return {
    analyzer: new RuleBasedIntentAnalyzer(),
    policySource: source,
    consensus: new LLMConsensusEngine(new MockLLMAdapter()),
    decision: new DefaultDecisionEngine(),
  };
};

test('pipeline: rule match -> deny (no LLM call)', async () => {
  const pipeline = buildPipeline(makeDeps([ruleHrPolicy]));
  const { verdict } = await pipeline({
    identity: { agentId: 'agent-1', authMethod: 'bearer' },
    tool: 'send_email',
    parameters: { to: 'out@partner.co.jp', subject: '人事評価', body: 'x' },
  });
  assert.equal(verdict.decision, 'deny');
  assert.equal(verdict.policyRef, 'policy-hr-rule');
  assert.equal(verdict.subAgentOpinions.length, 0);
});

test('pipeline: no rule hit + routine internal -> allow via consensus', async () => {
  const pipeline = buildPipeline(makeDeps([]));
  const { verdict } = await pipeline({
    identity: { agentId: 'agent-1', authMethod: 'bearer' },
    tool: 'send_email',
    parameters: { to: 'team@example.com', subject: 'daily', body: 'update' },
  });
  assert.equal(verdict.decision, 'allow');
  assert.equal(verdict.subAgentOpinions.length, 3);
});

test('pipeline: no rule hit + external sensitive -> deny via consensus', async () => {
  const pipeline = buildPipeline(makeDeps([]));
  const { verdict } = await pipeline({
    identity: { agentId: 'agent-1', authMethod: 'bearer' },
    tool: 'send_email',
    parameters: {
      to: 'leak@partner.co.jp',
      subject: '機密メモ',
      body: '給与と評価を共有します',
    },
  });
  assert.equal(verdict.decision, 'deny');
  assert.ok(verdict.subAgentOpinions.some((o) => o.verdict === 'deny'));
});
