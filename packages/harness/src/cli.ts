#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Policy } from '@arbiter/shared-types';
import { loadDataset } from './fixture.js';
import { renderMarkdown, runHarness } from './runner.js';

interface CliOptions {
  fixtures?: string;
  policies?: string;
  markdown?: string;
  json?: string;
  threshold?: number;
}

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  const out: CliOptions = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const v = args[i + 1];
    if (a === '--fixtures' && v) {
      out.fixtures = v;
      i += 1;
    } else if (a === '--policies' && v) {
      out.policies = v;
      i += 1;
    } else if (a === '--markdown' && v) {
      out.markdown = v;
      i += 1;
    } else if (a === '--json' && v) {
      out.json = v;
      i += 1;
    } else if (a === '--accuracy-threshold' && v) {
      out.threshold = Number(v);
      i += 1;
    }
  }
  return out;
};

const main = async (): Promise<void> => {
  const opts = parseArgs();
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = join(here, '..', '..', '..');
  const fixturesPath =
    opts.fixtures ?? join(repoRoot, 'harness', 'fixtures', 'policy-engine.v1.json');
  const policiesPath =
    opts.policies ?? join(repoRoot, 'packages', 'proxy', 'fixtures', 'default-policies.json');

  const dataset = await loadDataset(fixturesPath);
  const policiesRaw = await readFile(policiesPath, 'utf8');
  const policies = (JSON.parse(policiesRaw) as { policies: Policy[] }).policies;

  const report = await runHarness(dataset, { policies });

  const md = renderMarkdown(report);
  process.stdout.write(`${md}\n`);

  if (opts.markdown) await writeFile(opts.markdown, md, 'utf8');
  if (opts.json) await writeFile(opts.json, JSON.stringify(report, null, 2), 'utf8');

  const threshold = opts.threshold;
  if (threshold !== undefined && report.metrics.accuracy < threshold) {
    process.stderr.write(`accuracy ${report.metrics.accuracy} is below threshold ${threshold}\n`);
    process.exit(1);
  }
};

main().catch((err: unknown) => {
  process.stderr.write(`harness failed: ${err instanceof Error ? err.message : err}\n`);
  process.exit(1);
});
