import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export type EvalDecision = 'allow' | 'deny';

export interface EvalCase {
  id: string;
  input: {
    tool: string;
    parameters: Record<string, unknown>;
  };
  expected_decision: EvalDecision;
  rationale: string;
  tags: string[];
}

export interface EvalDataset {
  $schema?: string;
  version: string;
  generatedAt: string;
  cases: EvalCase[];
}

const DEFAULT_FIXTURE = join(process.cwd(), 'harness', 'fixtures', 'policy-engine.v1.json');

export const loadDataset = async (path: string = DEFAULT_FIXTURE): Promise<EvalDataset> => {
  const raw = await readFile(path, 'utf8');
  const parsed = JSON.parse(raw) as EvalDataset;
  validateDataset(parsed);
  return parsed;
};

export const validateDataset = (ds: EvalDataset): void => {
  if (!ds || !Array.isArray(ds.cases)) {
    throw new Error('Invalid dataset: missing cases[]');
  }
  const seen = new Set<string>();
  for (const c of ds.cases) {
    if (!c.id) throw new Error('Case without id');
    if (seen.has(c.id)) throw new Error(`Duplicate case id: ${c.id}`);
    seen.add(c.id);
    if (c.expected_decision !== 'allow' && c.expected_decision !== 'deny') {
      throw new Error(`Case ${c.id}: invalid expected_decision`);
    }
    if (!c.input?.tool) throw new Error(`Case ${c.id}: missing input.tool`);
  }
};
