import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { Policy } from '@arbiter/shared-types';
import type { EvalDataset } from './fixture.js';
import { renderMarkdown, runHarness } from './runner.js';

const makeDataset = (): EvalDataset => ({
  version: 'test',
  generatedAt: '2026-04-18',
  cases: [
    {
      id: 'case-allow',
      input: {
        tool: 'send_email',
        parameters: { to: 'team@example.com', subject: 's', body: 'b' },
      },
      expected_decision: 'allow',
      rationale: 'internal',
      tags: ['allow'],
    },
    {
      id: 'case-deny-hr',
      input: {
        tool: 'send_email',
        parameters: { to: 'partner@example.jp', subject: '人事評価', body: 'x' },
      },
      expected_decision: 'deny',
      rationale: 'hr keyword',
      tags: ['deny'],
    },
  ],
});

const hrPolicy: Policy = {
  policyId: 'policy-hr',
  name: 'HR 情報の禁',
  description: '',
  sensitiveCategories: ['hr'],
  rules: [
    { toolPattern: 'send_email', parameterPath: 'subject', operator: 'contains', value: '人事' },
  ],
  action: 'deny',
  enabled: true,
  createdAt: '2026-04-18',
  updatedAt: '2026-04-18',
  version: 1,
};

test('runHarness computes metrics correctly', async () => {
  const report = await runHarness(makeDataset(), { policies: [hrPolicy] });
  assert.equal(report.metrics.total, 2);
  assert.equal(report.metrics.accuracy, 1);
  assert.equal(report.metrics.truePositive, 1);
  assert.equal(report.metrics.trueNegative, 1);
  assert.equal(report.metrics.falsePositive, 0);
  assert.equal(report.metrics.falseNegative, 0);
});

test('renderMarkdown renders all-green summary when no mismatches', async () => {
  const report = await runHarness(makeDataset(), { policies: [hrPolicy] });
  const md = renderMarkdown(report);
  assert.match(md, /Accuracy: 100.0%/);
  assert.match(md, /All cases matched/);
});
