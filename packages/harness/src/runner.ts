import { MockLLMAdapter } from '@arbiter/core';
import {
  buildPipeline,
  DefaultDecisionEngine,
  LLMConsensusEngine,
  type PolicySource,
  RuleBasedIntentAnalyzer,
} from '@arbiter/proxy';
import type { Policy } from '@arbiter/shared-types';
import type { EvalCase, EvalDataset } from './fixture.js';

export interface CaseResult {
  id: string;
  expected: 'allow' | 'deny';
  actual: 'allow' | 'deny';
  correct: boolean;
  judgment: string;
  tags: string[];
}

export interface MetricsSummary {
  total: number;
  accuracy: number;
  precisionDeny: number;
  recallDeny: number;
  truePositive: number;
  falsePositive: number;
  trueNegative: number;
  falseNegative: number;
}

export interface RunReport {
  version: string;
  generatedAt: string;
  metrics: MetricsSummary;
  results: CaseResult[];
}

export interface RunnerOptions {
  policies: Policy[];
  agentId?: string;
}

const runCase = async (
  pipeline: ReturnType<typeof buildPipeline>,
  c: EvalCase,
  agentId: string,
): Promise<CaseResult> => {
  const { verdict } = await pipeline({
    identity: { agentId, authMethod: 'bearer' },
    tool: c.input.tool,
    parameters: c.input.parameters,
  });
  return {
    id: c.id,
    expected: c.expected_decision,
    actual: verdict.decision,
    correct: verdict.decision === c.expected_decision,
    judgment: verdict.judgment.split('\n')[0] ?? '',
    tags: c.tags,
  };
};

const computeMetrics = (results: readonly CaseResult[]): MetricsSummary => {
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;
  for (const r of results) {
    if (r.expected === 'deny' && r.actual === 'deny') tp += 1;
    else if (r.expected === 'allow' && r.actual === 'deny') fp += 1;
    else if (r.expected === 'allow' && r.actual === 'allow') tn += 1;
    else if (r.expected === 'deny' && r.actual === 'allow') fn += 1;
  }
  const total = results.length;
  const accuracy = total === 0 ? 0 : (tp + tn) / total;
  const precisionDeny = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recallDeny = tp + fn === 0 ? 0 : tp / (tp + fn);
  return {
    total,
    accuracy,
    precisionDeny,
    recallDeny,
    truePositive: tp,
    falsePositive: fp,
    trueNegative: tn,
    falseNegative: fn,
  };
};

export const runHarness = async (dataset: EvalDataset, opts: RunnerOptions): Promise<RunReport> => {
  const policySource: PolicySource = {
    list: async () => opts.policies,
  };
  // Harness は再現性を優先するため常に MockLLMAdapter を使う。
  // Proxy 側の claude-cli 経路はデモ/手動検証用。
  const llm = new MockLLMAdapter();
  const pipeline = buildPipeline({
    analyzer: new RuleBasedIntentAnalyzer(),
    policySource,
    consensus: new LLMConsensusEngine(llm),
    decision: new DefaultDecisionEngine(llm),
  });

  const results: CaseResult[] = [];
  for (const c of dataset.cases) {
    results.push(await runCase(pipeline, c, opts.agentId ?? 'harness-runner'));
  }

  return {
    version: dataset.version,
    generatedAt: new Date().toISOString(),
    metrics: computeMetrics(results),
    results,
  };
};

export const renderMarkdown = (report: RunReport): string => {
  const { metrics } = report;
  const lines: string[] = [];
  lines.push(`# Arbiter Harness Report (${report.version})`);
  lines.push('');
  lines.push(`Generated at: ${report.generatedAt}`);
  lines.push('');
  lines.push('## Metrics');
  lines.push(`- Total: ${metrics.total}`);
  lines.push(`- Accuracy: ${(metrics.accuracy * 100).toFixed(1)}%`);
  lines.push(`- Precision (deny): ${(metrics.precisionDeny * 100).toFixed(1)}%`);
  lines.push(`- Recall (deny): ${(metrics.recallDeny * 100).toFixed(1)}%`);
  lines.push(
    `- TP=${metrics.truePositive} / FP=${metrics.falsePositive} / TN=${metrics.trueNegative} / FN=${metrics.falseNegative}`,
  );
  const wrong = report.results.filter((r) => !r.correct);
  if (wrong.length > 0) {
    lines.push('');
    lines.push('## Mismatches');
    for (const r of wrong) {
      lines.push(`- [${r.id}] expected=${r.expected} actual=${r.actual} (${r.tags.join(', ')})`);
      lines.push(`  - ${r.judgment}`);
    }
  } else {
    lines.push('');
    lines.push('All cases matched the expected decision.');
  }
  return lines.join('\n');
};
