import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { Intent, Policy, SubAgentOpinion } from '@arbiter/shared-types';
import { DefaultDecisionEngine } from './decision-engine.js';

const makeIntent = (): Intent => ({
  intentId: 'i-1',
  agentId: 'agent-007',
  tool: 'send_email',
  parameters: { to: 'partner@example.jp', subject: '人事評価', body: 'B+' },
  extractedContext: { recipients: ['partner@example.jp'] },
  createdAt: new Date().toISOString(),
  traceId: 't-42',
});

const hrPolicy: Policy = {
  policyId: 'policy-hr',
  name: '人事情報漏洩の禁',
  description: '',
  sensitiveCategories: ['hr'],
  rules: [],
  action: 'deny',
  enabled: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  version: 1,
};

test('DefaultDecisionEngine: rule match forces deny with judgment text', async () => {
  const engine = new DefaultDecisionEngine();
  const verdict = await engine.decide({
    intent: makeIntent(),
    ruleMatches: [
      {
        policy: hrPolicy,
        rule: { parameterPath: 'subject', operator: 'contains', value: '人事' },
        evidence: { location: 'parameters.subject', excerpt: '人事評価' },
      },
    ],
    opinions: [],
    llmDecision: 'allow',
    llmConfidence: 0.5,
  });
  assert.equal(verdict.decision, 'deny');
  assert.equal(verdict.charge, '人事情報漏洩の禁');
  assert.equal(verdict.policyRef, 'policy-hr');
  assert.ok(verdict.judgment.includes('棄却'));
  assert.ok(verdict.judgment.includes('partner@example.jp'));
  assert.equal(verdict.traceId, 't-42');
  assert.ok(verdict.confidence >= 0.9);
});

test('DefaultDecisionEngine: rule-pass + llm deny still denies', async () => {
  const opinions: SubAgentOpinion[] = [
    { subAgentId: 'm-hr', role: 'hr', verdict: 'deny', confidence: 0.9, rationale: 'hr leak' },
    {
      subAgentId: 'm-priv',
      role: 'privacy',
      verdict: 'deny',
      confidence: 0.85,
      rationale: 'pii leak',
    },
  ];
  const engine = new DefaultDecisionEngine();
  const verdict = await engine.decide({
    intent: makeIntent(),
    ruleMatches: [],
    opinions,
    llmDecision: 'deny',
    llmConfidence: 0.88,
  });
  assert.equal(verdict.decision, 'deny');
  assert.equal(verdict.evidence.length, 0);
  assert.equal(verdict.subAgentOpinions.length, 2);
  assert.ok(verdict.judgment.includes('・hr'));
});

test('DefaultDecisionEngine: allow path omits charge/policyRef', async () => {
  const engine = new DefaultDecisionEngine();
  const verdict = await engine.decide({
    intent: makeIntent(),
    ruleMatches: [],
    opinions: [],
    llmDecision: 'allow',
    llmConfidence: 0.8,
  });
  assert.equal(verdict.decision, 'allow');
  assert.equal(verdict.charge, undefined);
  assert.equal(verdict.policyRef, undefined);
  assert.ok(verdict.judgment.includes('許可'));
});
